"""Demucs 4.0.1 bridge using the project's FFmpeg and soundfile for I/O.

Recent TorchAudio releases require TorchCodec for load/save. This bridge feeds
Demucs decoded WAV data directly and writes its stems with soundfile instead.
"""

import argparse
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from demucs import separate


def load_wav(path, channels, samplerate):
    audio, rate = sf.read(path, dtype="float32", always_2d=True)
    if rate != samplerate or audio.shape[1] != channels:
        raise ValueError("Decoded audio must be stereo 44.1 kHz WAV")
    return torch.from_numpy(audio.T.copy())


def save_wav(wav, path, samplerate, clip="rescale", bits_per_sample=16, as_float=False, **_):
    audio = wav.detach().cpu().numpy().T
    peak = float(np.max(np.abs(audio)))
    if peak > 1:
        if clip == "rescale":
            audio = audio / peak
        elif clip == "clamp":
            audio = np.clip(audio, -1, 1)
    subtype = "FLOAT" if as_float else "PCM_24" if bits_per_sample == 24 else "PCM_16"
    sf.write(path, audio, samplerate, subtype=subtype)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    separate.load_track = load_wav
    separate.save_audio = save_wav
    separate.main(["--two-stems=vocals", "-n", "htdemucs", "-d", "cpu",
                   "-o", str(args.output), str(args.source)])


if __name__ == "__main__":
    main()
