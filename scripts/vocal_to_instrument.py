"""Replace a lead vocal with a synthesized melody, entirely on this machine.

Demucs separates a mixed song. librosa tracks the isolated vocal pitch; the
resulting contour drives a small instrument synthesizer. FFmpeg mixes that
instrument with the vocal-free backing. No audio leaves the computer.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import median_filter, uniform_filter1d
from scipy.signal import resample_poly
from math import gcd


SAMPLE_RATE = 22050
HOP = 256
INSTRUMENTS = ("flute", "synth", "organ")


def report(stage):
    print(json.dumps({"stage": stage}), flush=True)


def find_stems(source, output, ffmpeg_path):
    separated = output / "separated"
    decoded = output / "decoded.wav"
    report("separating")
    try:
        subprocess.run([ffmpeg_path, "-hide_banner", "-loglevel", "error", "-y",
                        "-i", str(source), "-ac", "2", "-ar", "44100", str(decoded)],
                       check=True, capture_output=True, text=True, timeout=180)
        subprocess.run(
            [sys.executable, str(Path(__file__).with_name("demucs_bridge.py")),
             str(decoded), str(separated)],
            check=True, capture_output=True, text=True, timeout=1200,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        detail = getattr(exc, "stderr", "") or str(exc)
        raise RuntimeError(f"Разделение дорожек не удалось: {detail[-800:]}") from exc
    except Exception as exc:
        raise RuntimeError("Для разделения установите зависимости из requirements-audio.txt") from exc
    stem_dir = separated / "htdemucs" / decoded.stem
    vocals, backing = stem_dir / "vocals.wav", stem_dir / "no_vocals.wav"
    if not vocals.is_file() or not backing.is_file():
        raise RuntimeError("Разделитель не создал вокал и аккомпанемент")
    return vocals, backing


def bridge_short_gaps(mask, max_frames=8):
    result = mask.copy()
    starts = np.flatnonzero(np.diff(np.r_[False, mask, False].astype(np.int8)) == -1)
    ends = np.flatnonzero(np.diff(np.r_[False, mask, False].astype(np.int8)) == 1)
    for end, start in zip(starts[:-1], ends[1:]):
        if 0 < start - end <= max_frames:
            result[end:start] = True
    return result


def track_pitch(vocal):
    """Estimate one lead note per frame with FFT autocorrelation."""
    window_size = 2048
    window = np.hanning(window_size)
    count = 1 + max(0, (len(vocal) - window_size) // HOP)
    pitch = np.full(count, np.nan, dtype=np.float32)
    rms = np.zeros(count, dtype=np.float32)
    confidence = np.zeros(count, dtype=np.float32)
    min_lag = int(SAMPLE_RATE / 1046.5)  # C6
    max_lag = int(SAMPLE_RATE / 65.4)    # C2
    for index in range(count):
        frame = vocal[index * HOP:index * HOP + window_size]
        rms[index] = np.sqrt(np.mean(frame * frame))
        if rms[index] < 0.002:
            continue
        spectrum = np.fft.rfft((frame - frame.mean()) * window, n=4096)
        correlation = np.fft.irfft(spectrum * spectrum.conj(), n=4096).real
        candidates = correlation[min_lag:max_lag + 1]
        peak = int(np.argmax(candidates)) + min_lag
        confidence[index] = correlation[peak] / max(correlation[0], 1e-9)
        if confidence[index] >= 0.30:
            # Parabolic peak refinement improves pitch between FFT lag bins.
            left, middle, right = correlation[peak - 1:peak + 2]
            denom = left - 2 * middle + right
            offset = 0.5 * (left - right) / denom if abs(denom) > 1e-9 else 0
            pitch[index] = SAMPLE_RATE / (peak + np.clip(offset, -0.5, 0.5))
    valid = np.isfinite(pitch)
    if valid.any():
        filled = np.interp(np.arange(count), np.flatnonzero(valid), pitch[valid])
        pitch[valid] = median_filter(filled, size=5)[valid]
    return pitch, rms, confidence


def render_melody(vocal_path, output_path, instrument, lead_pitch=0):
    if instrument not in INSTRUMENTS:
        raise ValueError("Неизвестный инструмент")
    report("melody")
    vocal, source_rate = sf.read(vocal_path, dtype="float32", always_2d=True)
    vocal = vocal.mean(axis=1)
    if source_rate != SAMPLE_RATE:
        divisor = gcd(source_rate, SAMPLE_RATE)
        vocal = resample_poly(vocal, SAMPLE_RATE // divisor, source_rate // divisor).astype(np.float32)
    if len(vocal) < SAMPLE_RATE:
        raise RuntimeError("Вокальная дорожка слишком короткая")
    f0, rms, confidence = track_pitch(vocal)
    count = min(len(f0), len(rms))
    f0, rms = f0[:count], rms[:count]
    active = np.isfinite(f0) & (confidence >= 0.30) & (rms > max(0.002, np.percentile(rms, 90) * 0.08))
    if active.sum() < SAMPLE_RATE / HOP:
        raise RuntimeError("Не удалось уверенно определить вокальную мелодию")
    active = bridge_short_gaps(active)
    frame_times = np.arange(count) * HOP / SAMPLE_RATE
    sample_times = np.arange(len(vocal), dtype=np.float64) / SAMPLE_RATE
    good = np.flatnonzero(active)
    frequency = np.interp(sample_times, frame_times[good], f0[good]).astype(np.float32)
    frequency *= 2 ** (lead_pitch / 12)
    activity = np.interp(sample_times, frame_times, active.astype(float))
    energy = np.interp(sample_times, frame_times, rms)
    reference = max(float(np.percentile(rms[active], 90)), 0.005)
    amplitude = np.clip(energy / reference, 0, 1.3) * 0.28 * activity
    # Smooth consonant gaps and note boundaries so the new instrument does not click.
    amplitude = uniform_filter1d(amplitude.astype(np.float32), size=221)
    phase = np.cumsum(2 * np.pi * frequency / SAMPLE_RATE, dtype=np.float64)
    if instrument == "flute":
        tone = np.sin(phase) + 0.12 * np.sin(2 * phase)
    elif instrument == "organ":
        tone = np.sin(phase) + 0.52 * np.sin(2 * phase) + 0.24 * np.sin(3 * phase)
    else:
        tone = np.sin(phase) + 0.32 * np.sin(2 * phase) + 0.18 * np.sin(3 * phase)
    melody = np.clip(tone * amplitude, -0.95, 0.95).astype(np.float32)
    sf.write(output_path, melody, SAMPLE_RATE, subtype="PCM_24")
    return {"voicedSeconds": round(float(active.sum() * HOP / SAMPLE_RATE), 1)}


def mix(ffmpeg, backing, melody, output, tempo_percent=100, key_shift=0):
    report("mixing")
    filters = "[0:a][1:a]amix=inputs=2:duration=first:normalize=0"
    if tempo_percent != 100 or key_shift != 0:
        tempo = tempo_percent / 100
        pitch = 2 ** (key_shift / 12)
        filters += f",rubberband=tempo={tempo:.4f}:pitch={pitch:.8f}"
    filters += ",alimiter=limit=0.95[out]"
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
               "-i", str(backing), "-i", str(melody), "-filter_complex",
               filters,
               "-map", "[out]", "-codec:a", "libmp3lame", "-b:a", "256k", str(output)]
    subprocess.run(command, check=True, capture_output=True, text=True, timeout=600)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--vocals", type=Path)
    parser.add_argument("--backing", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--instrument", choices=INSTRUMENTS, default="flute")
    parser.add_argument("--lead-pitch", type=int, choices=range(-12, 13), default=0)
    parser.add_argument("--tempo-percent", type=int, choices=range(75, 126), default=100)
    parser.add_argument("--key-shift", type=int, choices=range(-6, 7), default=0)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    try:
        if args.vocals and args.backing:
            vocals, backing = args.vocals, args.backing
        elif args.source:
            vocals, backing = find_stems(args.source, args.output, args.ffmpeg)
        else:
            parser.error("Provide --source or both --vocals and --backing")
        stats = render_melody(vocals, args.output / "melody.wav", args.instrument, args.lead_pitch)
        mix(args.ffmpeg, backing, args.output / "melody.wav", args.output / "result.mp3",
            args.tempo_percent, args.key_shift)
        report("complete")
        print(json.dumps({"ok": True, "instrument": args.instrument,
                          "leadPitch": args.lead_pitch, "tempoPercent": args.tempo_percent,
                          "keyShift": args.key_shift, **stats}), flush=True)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
