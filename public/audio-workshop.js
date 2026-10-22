(() => {
  const fileInput = document.getElementById("workshop-file");
  const button = document.getElementById("workshop-run");
  const status = document.getElementById("workshop-status");
  const result = document.getElementById("workshop-result");
  const player = document.getElementById("workshop-player");
  const download = document.getElementById("workshop-download");
  if (!fileInput) return;

  const pitch = document.getElementById("workshop-pitch");
  const tempo = document.getElementById("workshop-tempo");
  const key = document.getElementById("workshop-key");
  const signed = (value) => Number(value) > 0 ? `+${value}` : String(value);
  for (const [input, output, format] of [
    [pitch, document.getElementById("workshop-pitch-value"), signed],
    [tempo, document.getElementById("workshop-tempo-value"), (value) => `${value}%`],
    [key, document.getElementById("workshop-key-value"), signed]
  ]) {
    const update = () => { output.value = format(input.value); };
    input.addEventListener("input", update);
    update();
  }

  const messages = {
    ru: { file: "Выберите аудиофайл", size: "Файл превышает 25 МБ", owner: "Сначала откройте доступ владельца в карточке «ДНК-декодер трека» на вкладке AI Lab.",
      local: "На бесплатном Render обработка недоступна. Откройте локальную версию программы на этом компьютере.",
      setup: "Установите аудиомодули командой ./scripts/install-audio.ps1 и перезапустите программу.",
      queued: "Ожидание…", separating: "Отделяю вокал от музыки…", melody: "Определяю вокальную мелодию и создаю партию инструмента…",
      mixing: "Свожу инструмент с аккомпанементом…", ready: "Готово. Послушайте и скачайте результат.", timeout: "Обработка заняла слишком много времени." },
    en: { file: "Choose an audio file", size: "File exceeds 25 MB", owner: "Unlock owner access in the Track DNA Decoder card on the AI Lab tab first.",
      local: "Processing is unavailable on the free Render service. Open the local app on this computer.",
      setup: "Install audio modules with ./scripts/install-audio.ps1, then restart the app.",
      queued: "Queued…", separating: "Separating vocal and backing…", melody: "Tracing vocal melody and rendering the instrument…",
      mixing: "Mixing instrument with backing…", ready: "Done. Listen and download the result.", timeout: "Processing took too long." }
  };
  const m = () => messages[localStorage.getItem("ss_lang") === "en" ? "en" : "ru"];
  const show = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle("error", error);
  };
  let objectUrl;
  fetch("/api/audio/capabilities").then((r) => r.json()).then((data) => {
    if (!data.localProcessing || !data.ready) {
      button.disabled = true;
      show(data.localProcessing ? m().setup : m().local, true);
    }
  }).catch(() => {});

  async function request(url, options = {}) {
    const token = localStorage.getItem("siliconsense_unlock");
    if (!token) throw new Error(m().owner);
    const response = await fetch(url, { ...options, headers: { ...(options.headers || {}), "X-Unlock-Token": token } });
    if (response.status === 403) throw new Error(m().owner);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return response;
  }

  button.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) return show(m().file, true);
    if (file.size > 25 * 1024 * 1024) return show(m().size, true);
    button.disabled = true;
    result.classList.add("hidden");
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    show(m().queued);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("instrument", document.getElementById("workshop-instrument").value);
      body.append("pitchShift", pitch.value);
      body.append("tempoPercent", tempo.value);
      body.append("keyShift", key.value);
      const started = await (await request("/api/audio/vocal-instrument", { method: "POST", body })).json();
      const id = encodeURIComponent(started.jobId);
      let job;
      for (let attempt = 0; attempt < 500; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        job = await (await request(`/api/audio/vocal-instrument/${id}`)).json();
        show(m()[job.stage] || m().queued);
        if (job.status !== "running") break;
      }
      if (job?.status === "failed") throw new Error(job.error || "Processing failed");
      if (job?.status !== "complete") throw new Error(m().timeout);
      const audio = await (await request(`/api/audio/vocal-instrument/${id}/download`)).blob();
      objectUrl = URL.createObjectURL(audio);
      player.src = objectUrl;
      download.href = objectUrl;
      result.classList.remove("hidden");
      show(m().ready);
    } catch (error) {
      show(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
})();
