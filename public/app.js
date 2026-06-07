const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const api = async (url, opts) => (await fetch(url, opts)).json();

const GATE_KEY = "siliconsense_token";
const UNLOCK_KEY = "siliconsense_unlock";
const SAVED_KEY = "siliconsense_saved";

const state = { language: "", era: "", genre: "", mood: "", q: "", free: false, isNew: false, page: 1 };
let facets = null;
let canGenerate = false; // set from /api/status

/* ── i18n ───────────────────────────────────────────────────────────────── */
let currentLang = localStorage.getItem("ss_lang") || "ru";

const LANG = {
  en: {
    "nav.catalog":"⌕ Catalog","nav.anchor":"🎙 Vocal Anchor","nav.reference":"♪ Reference",
    "nav.cover":"▦ Cover Art","nav.structure":"⊞ Structure","nav.lyrics":"✎ Lyrics",
    "nav.constructor":"🎛 Constructor","nav.ailab":"🧪 AI Lab","nav.saved":"★ Saved",
    "gate.hint":"Enter your access code to continue.",
    "gate.ph":"ACCESS CODE","gate.btn":"Unlock →",
    "gate.demo":"Demo codes:",
    "cat.title":"Prompt Catalog",
    "cat.sub":"Ready 60–90 word style descriptions: era, instruments, production, vocal anchor. No artist names — passes Suno's filter.",
    "cat.unlock":"🔓 Unlock all","cat.search.ph":"Search style, genre, sub-genre…","cat.search.btn":"Search","cat.mood.all":"All moods",
    "cat.lang.all":"All","cat.era.all":"All eras","cat.new":"New","cat.free":"★ Free","cat.genre.all":"All genres",
    "saved.empty":"Nothing saved yet. Tap ★ on any prompt to save it here.",
    "pager.prev":"← Prev","pager.next":"Next →","pager.info":"Page {p} / {t} · {n} styles",
    "ctor.placeholder":"Pick chips on the left — prompt builds here…",
    "anchor.title":"Vocal Anchor Builder",
    "anchor.sub":"Shape a unique vocal along 5 axes. Add a donor for spirit, not imitation.",
    "anchor.pitch":"Pitch","anchor.timbre":"Timbre","anchor.delivery":"Delivery",
    "anchor.texture":"Texture","anchor.age":"Age","anchor.donor":"Donor (optional)",
    "anchor.donor.ph":"e.g. a smoky jazz crooner","anchor.btn":"Build Anchor",
    "analyze.title":"Reference Analysis",
    "analyze.sub":"Drop an audio file — real metadata (duration, bitrate, codec, tags) is read from it, then turned into a Suno prompt plus the 3 closest catalog styles.",
    "analyze.drop":"Click or drop an audio file here","analyze.btn":"Analyze",
    "cover.title":"Album Cover Concept",
    "cover.sub":"Generate a 2048×2048 cover concept for Spotify / Apple Music / Yandex.",
    "cover.title.ph":"Album title","cover.artist.ph":"Artist name","cover.genre.ph":"Genre / vibe",
    "cover.logo":"Include wordmark logo","cover.btn":"Generate Concept",
    "struct.title":"Song Structure",
    "struct.sub":"Generate a Suno-ready arrangement with [Section] tags and production hints.",
    "struct.style.ph":"Style (e.g. 80s synthwave, female vocal)","struct.title.ph":"Title (optional)",
    "struct.preset":"Preset","struct.btn":"Build Structure",
    "lyrics.title":"Lyrics Generator",
    "lyrics.sub":"Draft original lyrics with verse/chorus tags. Full lyrics need an AI key — otherwise you get a structured skeleton.",
    "lyrics.theme.ph":"Theme (e.g. late-night city drive)","lyrics.style.ph":"Musical style (optional)",
    "lyrics.mood.ph":"Mood (e.g. hopeful)","lyrics.lang.ph":"Language (e.g. English)","lyrics.btn":"Write Lyrics",
    "ctor.title":"🎛 Prompt Constructor",
    "ctor.sub":"Build the perfect Suno prompt. Correct word order — automatic. Reference + Generate — right here.",
    "ctor.label.era":"ERA","ctor.label.genre":"GENRE","ctor.label.mood":"MOOD",
    "ctor.label.vgender":"VOCAL — GENDER","ctor.label.vtimbre":"VOCAL — TIMBRE",
    "ctor.label.vdelivery":"VOCAL — DELIVERY","ctor.label.vfx":"VOCAL — FX",
    "ctor.label.instruments":"INSTRUMENTS","ctor.label.production":"PRODUCTION",
    "ctor.label.tempo":"TEMPO","ctor.label.key":"KEY / TONALITY",
    "ctor.label.carattere":"CARATTERE","ctor.label.usecase":"USE CASE","ctor.label.theme":"LYRIC THEME",
    "ctor.hint.23":"2–3","ctor.hint.to3":"up to 3","ctor.hint.25":"2–5",
    "ctor.hint.opt":"opt.","ctor.hint.opt2":"opt., up to 2","ctor.hint.opt3":"opt., up to 3",
    "ctor.genre.ph":"— select —","ctor.theme.ph":"love and longing / midnight city / inner conflict…",
    "ctor.bpm.auto":"Auto",
    "ctor.out.label":"SUNO v5.5 · STYLE",
    "ctor.copy":"Copy","ctor.reset":"Reset",
    "ctor.ref.none":"No reference","ctor.ref.file":"📁 File","ctor.ref.mic":"🎙 Mic",
    "ctor.ref.divider":"— or generate with reference —",
    "ctor.mic.record":"🎙 Record","ctor.mic.redo":"🔄 Re-record",
    "ctor.ref.influence":"Reference influence","ctor.dz.text":"MP3 / WAV up to 25MB",
    "ctor.gen":"🎵 Create Track",
    "ctor.hint.vocal":"💡 Add vocal gender — without it Suno picks randomly",
    "ctor.hint.short":"💡 Add genre, mood, instruments (target 15–30 words)",
    "ctor.hint.long":"⚠ Over 40 words — risk of contradictions",
    "ctor.hint.chars":"⚠ 1000-char limit — Suno will cut silently",
    "ctor.wc.words":" words","ctor.wc.few":" · too few","ctor.wc.ok":" · optimal ✓",
    "ctor.wc.many":" · too many","ctor.wc.over":" · conflict risk",
    "ctor.slop.label":"Anti-Slop","btn.copied":"✓ Copied!","ctor.sel":" sel.",
    "ailab.title":"🧪 AI Lab",
    "ailab.sub":"AI-powered tools. Free tier — 3 requests/day per IP. Unlock code removes the limit.",
    "gen.title":"🎵 Generate Track","gen.badge":"Suno live",
    "gen.sub":"Paste a prompt — get a real Suno track right here. Same model as suno.com, via API.",
    "gen.prompt.ph":"Style/prompt: synthwave, female vocal, cinematic, 120 BPM, A minor",
    "gen.lyrics.ph":"Lyrics (optional, with [Verse] [Chorus] tags). Empty = Suno writes itself.",
    "gen.title.ph":"Track title (optional)","gen.model":"Model","gen.vocal":"Vocal",
    "gen.vocal.any":"any","gen.vocal.f":"Female","gen.vocal.m":"Male",
    "gen.instr":"Instrumental","gen.btn":"🎵 Generate (≈6 quota)",
    "reftrack.title":"🎵 Reference → Track","reftrack.badge":"new",
    "reftrack.sub":"Upload MP3 or record a melody with your mic — Suno generates a new track in the same style.",
    "reftrack.file":"📁 Upload file","reftrack.mic":"🎙 Record from mic",
    "reftrack.drop":"Click or drop reference MP3 / WAV (up to 25MB)",
    "reftrack.start":"🎙 Start recording","reftrack.use":"✓ Use as reference","reftrack.redo":"🔄 Re-record",
    "reftrack.from":"Fragment from","reftrack.to":"to",
    "reftrack.influence":"Reference influence",
    "reftrack.desc.ph":"Style description (optional): add epic strings, darker mood…",
    "reftrack.btn":"🎵 Create Track (~6.5 quota)",
    "voice.title":"🎙 Voice Memo → Prompt",
    "voice.sub":"Speak — get a prompt. Describe genre, mood, instruments, era. Whisper + AI builds a Suno prompt in seconds.",
    "voice.start":"🎙 Start recording","voice.send":"✨ Create Prompt","voice.redo":"🔄 Re-record",
    "genome.title":"🧬 Style Genome",
    "genome.sub":"Cross-breed 2–3 artists by weight → get a hybrid Suno prompt. Dominant sets the skeleton, others add DNA proportionally.",
    "genome.a1.ph":"Artist 1 (dominant): Drake, Radiohead…","genome.a2.ph":"Artist 2: adds flavor…",
    "genome.a3.ph":"Artist 3: final touch…","genome.add":"+ Artist 3","genome.btn":"🧬 Blend Styles",
    "tm.title":"🕰 Style Time Machine",
    "tm.sub":"What would [artist] sound like in [era]? Drake in 1975? Kino in witch house era? Artist signature × production from another time.",
    "tm.artist.ph":"Artist: Drake, Kino, Nirvana, Alla Pugacheva…","tm.era":"Era:",
    "tm.note.ph":"Additional context (optional): dark ambient, lo-fi, USSR…","tm.btn":"🕰 Time-travel",
    "ls.title":"🎼 Lyrics Sync Conductor",
    "ls.sub":"Paste lyrics — AI inserts Suno inline tags [High Energy] [Vocal: raspy] [Drop] by emotional arc. Inline tags work 10× stronger than style field.",
    "ls.style.ph":"Genre / style (optional): dark pop, Russian rock, trap…",
    "ls.btn":"🎼 Apply Tags",
    "dna.title":"🔬 Track DNA Decoder",
    "dna.sub":"Upload any MP3/WAV — Whisper transcribes, AI identifies era, genre, instruments, production and finds 3 closest artists from 747 in the catalog. Plus a ready Suno prompt.",
    "dna.drop":"Click or drop audio (MP3 / WAV / OGG, max 25MB)","dna.btn":"Decode DNA",
    "slop.title":"🛡 Anti-Slop Filter",
    "slop.sub":"Paste a prompt — instant strength score 0–100 with cliché highlighting. Fix button rewrites weak tokens into specific ones. No clichés — we fight them.",
    "slop.ph":"Paste Suno prompt: epic cinematic orchestral, beautiful emotional, powerful drums…",
    "slop.btn":"🛡 Fix Clichés",
    "mood.title":"🎭 Mood from Image",
    "mood.sub":"Drop a picture, meme, or film still — Claude Vision describes how it sounds.",
    "mood.drop":"Click or drop an image (max 5MB)","mood.btn":"Analyze Mood",
    "scene.title":"🎬 Cinematic Scene → Score",
    "scene.sub":"Describe a scene in words — get a prompt and structure [Intro][Build][Drop][Outro].",
    "scene.ph":"Example: night chase through an empty city, neon in puddles, rain, protagonist running to the bridge…",
    "scene.lang":"Structure in Russian","scene.btn":"Compose Score",
    "mirror.title":"🔁 RU → EN Mirror Mode",
    "mirror.sub":"Suno pronounces English cleaner. Translation preserving rhyme and syllable count — for a bilingual track version.",
    "mirror.ph":"Paste Russian lyrics with [Verse] [Chorus] tags…","mirror.btn":"Mirror to English",
    "saved.title":"Saved Prompts","saved.sub":"Everything you star is kept in this browser. Export to take it with you.",
    "saved.json":"⭳ Export JSON","saved.txt":"⭳ Export TXT","saved.clear":"Clear all",
    "mood.loading":"Claude Vision is reading the image…","scene.loading":"Claude is scoring the scene…","mirror.loading":"Mirroring to English, preserving rhyme…",
    "scene.empty":"Describe a scene","mirror.empty":"Paste Russian lyrics",
    "mood.atmo":"Atmosphere","ai.prompt.label":"Suno Prompt",
    "scene.style.label":"Style (prompt)","scene.struct.label":"Structure (for Lyrics field)",
    "mirror.label":"English mirror","mirror.syllab":"· syllables matched","mirror.rhyme":"Rhyme notes",
    "quota.unlocked":"● Unlocked — unlimited","quota.remaining":"{n} of {limit} free requests left today",
    "quota.unlock.cta":"Enter an unlock code to continue.","ai.gen.btn":"🎵 Generate in Suno",
    "gen.modal.sending":"Sending to Suno…","gen.modal.gen":"Suno is generating… {p}","gen.modal.time":"(30–90 sec)",
    "gen.modal.fail":"Suno returned an error","gen.modal.timeout":"Timeout — try again",
    "voice.record.start":"🎙 Start recording","voice.record.stop":"⏹ Stop",
    "voice.mic.error":"No microphone access: ","voice.loading":"Whisper is listening… then AI builds the prompt…","voice.heard":"I heard:",
    "unlock.ph":"Unlock code","unlock.btn":"🔓 Unlock","unlock.success":"✓ Unlocked!","unlock.invalid":"Invalid code",
    "playlist.title":"🎵 Playlist Builder","playlist.sub":"Set a style — get 8 coherent tracks with a shared album concept.",
    "playlist.style.ph":"Style: dark synthwave, female vocal, 80s production…","playlist.theme.ph":"Album theme (opt.): neon city, solitude…",
    "playlist.tracks":"Tracks","playlist.btn":"🎵 Build Playlist","playlist.loading":"AI is building your album…","playlist.copy.all":"Copy all prompts",
    "master.title":"🎚 Track Mastering","master.sub":"Improve Suno track quality via Auphonic: noise cleanup, EQ balance, loudness normalization. 2 hours/month free.",
    "master.url.ph":"MP3 file URL (e.g. from generated track result)","master.loudness":"Loudness",
    "master.btn":"🎚 Master","master.loading":"Auphonic is mastering…","master.progress":"Mastering… {p}%",
    "master.done":"🎚 Mastering complete","master.download":"⭳ Download mastered MP3","master.fail":"Mastering failed",
    "master.btn.inline":"🎚 Master this track",
    "card.badge.new":"New","copy.prompt":"Copy prompt",
    "cat.noresults":"No styles match these filters.",
    "pill.unlocked":"✓ full access","pill.free":"🔒 free tier",
    "saved.count":"{n} saved",
    "card.gen.btn":"🎵 Create Track","card.gen.title":"Generate track in Suno",
    "analyze.closest":"3 closest catalog styles",
    "card.locked":"LOCKED","card.locked.hint":"Unlock all to reveal this prompt",
    "copy":"Copy",
    "ai.concept":"Concept","ai.prompt.ready":"Ready Suno prompt",
    "dna.transcript.label":"Lyrics (Whisper)","dna.artists":"🎯 Closest artists in catalog","dna.breakdown":"DNA by artist",
    "analyze.detected":"Detected",
    "pricing.title":"SiliconSense Plans","pricing.sub":"Choose the plan that fits your workflow",
    "pricing.per.mo":"/mo",
    "pricing.free.f1":"✓ Full 812-artist catalog","pricing.free.f2":"✓ Prompt constructor",
    "pricing.free.f3":"✓ 3 AI requests / day","pricing.free.f4":"✗ Track generation","pricing.free.f5":"✗ Mastering",
    "pricing.free.btn":"Current plan",
    "pricing.creator.f1":"✓ Unlimited AI features","pricing.creator.f2":"✓ Voice Memo, DNA Decoder",
    "pricing.creator.f3":"✓ Playlist Builder","pricing.creator.f4":"✓ Style Time Machine",
    "pricing.creator.f5":"✓ 5 track generations / mo","pricing.creator.f6":"✗ Mastering",
    "pricing.creator.btn":"Subscribe Creator",
    "pricing.pro.f1":"✓ Everything in Creator","pricing.pro.f2":"✓ 25 track generations / mo",
    "pricing.pro.f3":"✓ 15 masterings / mo","pricing.pro.f4":"✓ Reference → Track upload",
    "pricing.pro.f5":"✓ Priority support","pricing.pro.btn":"Subscribe Pro",
    "pricing.activate.sub":"Already subscribed? Enter your payment email to activate:",
    "pricing.activate.btn":"Activate","pricing.activate.link":"Already subscribed? Activate →",
    "reftrack.rec.size":"Recording: {n} KB","reftrack.rec.ready":"· ready to use ✓",
    "slop.clean":"clean, no clichés found","slop.loading":"AI is rewriting clichés into specifics…",
    "slop.result.label":"Fixed prompt","slop.changes.label":"What changed",
    "tm.from.era":"From {era}","tm.retained":"Retained from {artist}",
    "ls.result.label":"Lyrics with tags","ls.tags.added":"added","ls.why":"What and why",
    "dna.tech":"Technical data","dna.analysis":"Track analysis",
    "dna.vocals":"Vocals","dna.production":"Production",
  },
  ru: {
    "nav.catalog":"⌕ Каталог","nav.anchor":"🎙 Вокал","nav.reference":"♪ Референс",
    "nav.cover":"▦ Обложка","nav.structure":"⊞ Структура","nav.lyrics":"✎ Лирика",
    "nav.constructor":"🎛 Конструктор","nav.ailab":"🧪 AI Lab","nav.saved":"★ Сохранено",
    "gate.hint":"Введи код доступа чтобы продолжить.",
    "gate.ph":"КОД ДОСТУПА","gate.btn":"Войти →",
    "gate.demo":"Демо-коды:",
    "cat.title":"Каталог промптов",
    "cat.sub":"Готовые описания стилей 60–90 слов: эпоха, инструменты, продакшн, вокал. Без имён артистов — проходит фильтр Suno.",
    "cat.unlock":"🔓 Открыть всё","cat.search.ph":"Поиск стиля, жанра, сабжанра…","cat.search.btn":"Найти","cat.mood.all":"Все настроения",
    "cat.lang.all":"Все","cat.era.all":"Все эпохи","cat.new":"Новинки","cat.free":"★ Бесплатные","cat.genre.all":"Все жанры",
    "saved.empty":"Ничего не сохранено. Нажми ★ на промпт чтобы сохранить его.",
    "pager.prev":"← Назад","pager.next":"Вперёд →","pager.info":"Стр. {p} / {t} · {n} стилей",
    "ctor.placeholder":"Выбирай чипы слева — промпт появится здесь…",
    "anchor.title":"Конструктор вокала",
    "anchor.sub":"Настрой уникальный вокал по 5 осям. Добавь донора за характер — не за имитацию.",
    "anchor.pitch":"Высота","anchor.timbre":"Тембр","anchor.delivery":"Подача",
    "anchor.texture":"Текстура","anchor.age":"Возраст","anchor.donor":"Донор (опц.)",
    "anchor.donor.ph":"напр. хриплый джазовый крунер","anchor.btn":"Создать вокал",
    "analyze.title":"Анализ референса",
    "analyze.sub":"Брось аудиофайл — реальные метаданные (длительность, битрейт, кодек, теги) считываются и превращаются в Suno-промпт плюс 3 ближайших стиля из каталога.",
    "analyze.drop":"Кликни или перетащи аудиофайл сюда","analyze.btn":"Анализировать",
    "cover.title":"Концепция обложки",
    "cover.sub":"Генерируй концепцию обложки 2048×2048 для Spotify / Apple Music / Яндекс.",
    "cover.title.ph":"Название альбома","cover.artist.ph":"Имя артиста","cover.genre.ph":"Жанр / атмосфера",
    "cover.logo":"Включить логотип","cover.btn":"Создать концепцию",
    "struct.title":"Структура песни",
    "struct.sub":"Генерируй Suno-аранжировку с тегами [Секция] и подсказками по продакшну.",
    "struct.style.ph":"Стиль (напр. 80s synthwave, female vocal)","struct.title.ph":"Название (опционально)",
    "struct.preset":"Пресет","struct.btn":"Создать структуру",
    "lyrics.title":"Генератор лирики",
    "lyrics.sub":"Черновик лирики с тегами куплет/припев. Полная лирика требует AI-ключа — иначе структурный скелет.",
    "lyrics.theme.ph":"Тема (напр. ночная поездка по городу)","lyrics.style.ph":"Музыкальный стиль (опционально)",
    "lyrics.mood.ph":"Настроение (напр. hopeful)","lyrics.lang.ph":"Язык (напр. English)","lyrics.btn":"Написать лирику",
    "ctor.title":"🎛 Конструктор промптов",
    "ctor.sub":"Собери идеальный Suno-промпт. Правильный порядок слов — автоматически. Референс + Generate — прямо здесь.",
    "ctor.label.era":"ЭПОХА","ctor.label.genre":"ЖАНР","ctor.label.mood":"НАСТРОЕНИЕ",
    "ctor.label.vgender":"ВОКАЛ — ПОЛ","ctor.label.vtimbre":"ВОКАЛ — ТЕМБР",
    "ctor.label.vdelivery":"ВОКАЛ — ПОДАЧА","ctor.label.vfx":"ВОКАЛ — ЭФФЕКТЫ",
    "ctor.label.instruments":"ИНСТРУМЕНТЫ","ctor.label.production":"ПРОДАКШН",
    "ctor.label.tempo":"ТЕМП","ctor.label.key":"ТОНАЛЬНОСТЬ",
    "ctor.label.carattere":"CARATTERE","ctor.label.usecase":"USE CASE","ctor.label.theme":"ТЕМАТИКА ЛИРИКИ",
    "ctor.hint.23":"2–3","ctor.hint.to3":"до 3","ctor.hint.25":"2–5",
    "ctor.hint.opt":"опц.","ctor.hint.opt2":"опц., до 2","ctor.hint.opt3":"опц., до 3",
    "ctor.genre.ph":"— выбери —","ctor.theme.ph":"love and longing / midnight city / inner conflict…",
    "ctor.bpm.auto":"Авто",
    "ctor.out.label":"SUNO v5.5 · STYLE",
    "ctor.copy":"Скопировать","ctor.reset":"Сбросить",
    "ctor.ref.none":"Без референса","ctor.ref.file":"📁 Файл","ctor.ref.mic":"🎙 Микрофон",
    "ctor.ref.divider":"— или сгенерировать с референсом —",
    "ctor.mic.record":"🎙 Запись","ctor.mic.redo":"🔄 Перезаписать",
    "ctor.ref.influence":"Влияние референса","ctor.dz.text":"MP3 / WAV до 25MB",
    "ctor.gen":"🎵 Создать трек",
    "ctor.hint.vocal":"💡 Укажи вокал — без пола Suno выбирает случайно",
    "ctor.hint.short":"💡 Добавь жанр, настроение, инструменты (цель 15–30 слов)",
    "ctor.hint.long":"⚠ Более 40 слов — риск противоречий",
    "ctor.hint.chars":"⚠ Лимит 1000 символов — Suno обрежет молча",
    "ctor.wc.words":" слов","ctor.wc.few":" · мало","ctor.wc.ok":" · оптимально ✓",
    "ctor.wc.many":" · много","ctor.wc.over":" · риск конфликтов",
    "ctor.slop.label":"Анти-слоп","btn.copied":"✓ Скопировано!","ctor.sel":" выбр.",
    "ailab.title":"🧪 AI Lab",
    "ailab.sub":"AI-инструменты. Бесплатно — 3 запроса в сутки на IP. Unlock-код снимает лимит.",
    "gen.title":"🎵 Создать трек","gen.badge":"Suno live",
    "gen.sub":"Вставь промпт — получи настоящий трек от Suno прямо здесь. Та же модель, что на suno.com, через API.",
    "gen.prompt.ph":"Стиль/промпт: synthwave, female vocal, cinematic, 120 BPM, A minor",
    "gen.lyrics.ph":"Лирика (опционально, с тегами [Verse] [Chorus]). Пусто = Suno напишет сам.",
    "gen.title.ph":"Название трека (опционально)","gen.model":"Модель","gen.vocal":"Вокал",
    "gen.vocal.any":"любой","gen.vocal.f":"женский","gen.vocal.m":"мужской",
    "gen.instr":"Инструментал","gen.btn":"🎵 Сгенерировать (≈6 quota)",
    "reftrack.title":"🎵 Референс → Трек","reftrack.badge":"новинка",
    "reftrack.sub":"Загрузи MP3 или запиши мелодию с микрофона — Suno сгенерирует новый трек в том же стиле.",
    "reftrack.file":"📁 Загрузить файл","reftrack.mic":"🎙 Записать с микрофона",
    "reftrack.drop":"Click или drop референсный MP3 / WAV (до 25MB)",
    "reftrack.start":"🎙 Начать запись","reftrack.use":"✓ Использовать как референс","reftrack.redo":"🔄 Перезаписать",
    "reftrack.from":"Фрагмент с","reftrack.to":"по",
    "reftrack.influence":"Влияние референса",
    "reftrack.desc.ph":"Описание стиля (опционально): add epic strings, darker mood…",
    "reftrack.btn":"🎵 Создать трек (~6.5 quota)",
    "voice.title":"🎙 Голосовая заметка → Промпт",
    "voice.sub":"Говори — получай промпт. Опиши жанр, настроение, инструменты, эпоху. Whisper + AI соберут Suno-промпт за секунды.",
    "voice.start":"🎙 Начать запись","voice.send":"✨ Создать промпт","voice.redo":"🔄 Перезаписать",
    "genome.title":"🧬 Style Genome",
    "genome.sub":"Скрести 2–3 артиста по весу → получи гибридный Suno-промпт. Доминирующий задаёт скелет, остальные добавляют ДНК пропорционально.",
    "genome.a1.ph":"Артист 1 (доминирующий): Drake, Radiohead…","genome.a2.ph":"Артист 2: добавляет флейвор…",
    "genome.a3.ph":"Артист 3: финальный флейвор…","genome.add":"+ Артист 3","genome.btn":"🧬 Скрестить стили",
    "tm.title":"🕰 Машина времени",
    "tm.sub":"Как бы звучал [артист] в [эпоху]? Drake в 1975? Кино в эпоху витч-хауса? Сигнатура артиста × продакшн другого времени.",
    "tm.artist.ph":"Артист: Drake, Кино, Nirvana, Алла Пугачёва…","tm.era":"Эпоха:",
    "tm.note.ph":"Доп. контекст (опционально): dark ambient, lo-fi, СССР…","tm.btn":"🕰 Перенести в эпоху",
    "ls.title":"🎼 Дирижёр тегов",
    "ls.sub":"Вставь лирику — AI расставит Suno-теги [High Energy] [Vocal: raspy] [Drop] по эмоциональному арку. Inline-теги работают в 10× сильнее style-поля.",
    "ls.style.ph":"Жанр / стиль (опционально): dark pop, Russian rock, trap…",
    "ls.btn":"🎼 Расставить теги",
    "dna.title":"🔬 ДНК-декодер трека",
    "dna.sub":"Загрузи любой MP3/WAV — Whisper расшифрует лирику, AI определит эру, жанр, инструменты, продакшн и найдёт 3 ближайших артиста из 747 в каталоге. Плюс готовый Suno-промпт.",
    "dna.drop":"Кликни или перетащи аудио (MP3 / WAV / OGG, до 25MB)","dna.btn":"Декодировать ДНК",
    "slop.title":"🛡 Анти-Слоп Фильтр",
    "slop.sub":"Вставь промпт — мгновенный балл силы 0–100 и подсветка штампов. Кнопка «Починить» переписывает банальные токены в конкретные. Мы не штампы — мы антиштампы.",
    "slop.ph":"Вставь Suno-промпт: epic cinematic orchestral, beautiful emotional, powerful drums…",
    "slop.btn":"🛡 Починить штампы",
    "mood.title":"🎭 Настроение из картинки",
    "mood.sub":"Брось картинку, мем или скрин из фильма — Claude Vision расскажет как это звучит.",
    "mood.drop":"Кликни или перетащи картинку (до 5MB)","mood.btn":"Анализировать настроение",
    "scene.title":"🎬 Сцена → Саундтрек",
    "scene.sub":"Опиши сцену словами — получи промпт и структуру [Intro][Build][Drop][Outro].",
    "scene.ph":"Пример: погоня ночью по пустому городу, неон отражается в лужах, дождь, главный герой бежит к мосту…",
    "scene.lang":"Структура на русском","scene.btn":"Создать саундтрек",
    "mirror.title":"🔁 RU → EN Зеркало",
    "mirror.sub":"Suno чище произносит английский. Перевод с сохранением рифмы и числа слогов — для билингвальной версии трека.",
    "mirror.ph":"Вставь русскую лирику с тегами [Verse] [Chorus]…","mirror.btn":"Зеркалировать в EN",
    "saved.title":"Сохранённые промпты","saved.sub":"Всё, что вы отметили звёздочкой, хранится в этом браузере. Экспорт — чтобы взять с собой.",
    "saved.json":"⭳ Экспорт JSON","saved.txt":"⭳ Экспорт TXT","saved.clear":"Очистить всё",
    "mood.loading":"Claude Vision слушает картинку…","scene.loading":"Claude собирает партитуру…","mirror.loading":"Зеркалю на английский с рифмой…",
    "scene.empty":"Опиши сцену","mirror.empty":"Вставь русскую лирику",
    "mood.atmo":"Атмосфера","ai.prompt.label":"Suno-промпт",
    "scene.style.label":"Style (промпт)","scene.struct.label":"Structure (для Lyrics-поля)",
    "mirror.label":"English mirror","mirror.syllab":"· слоги совпали","mirror.rhyme":"Заметки о рифме",
    "quota.unlocked":"● Разблокировано — без лимита","quota.remaining":"Осталось {n} из {limit} запросов на сегодня",
    "quota.unlock.cta":"Введи unlock-код чтобы продолжить.","ai.gen.btn":"🎵 Сгенерировать в Suno",
    "gen.modal.sending":"Отправляю в Suno…","gen.modal.gen":"Suno генерирует… {p}","gen.modal.time":"(30–90 сек)",
    "gen.modal.fail":"Suno вернул ошибку","gen.modal.timeout":"Слишком долго — попробуй ещё раз",
    "voice.record.start":"🎙 Начать запись","voice.record.stop":"⏹ Стоп",
    "voice.mic.error":"Нет доступа к микрофону: ","voice.loading":"Whisper слушает… затем AI строит промпт…","voice.heard":"Я услышал:",
    "unlock.ph":"Unlock-код","unlock.btn":"🔓 Разблокировать","unlock.success":"✓ Разблокировано!","unlock.invalid":"Неверный код",
    "playlist.title":"🎵 Плейлист-билдер","playlist.sub":"Задай стиль — получи 8 связных треков с единой концепцией альбома.",
    "playlist.style.ph":"Стиль: dark synthwave, female vocal, 80s production…","playlist.theme.ph":"Тема альбома (опц.): ночной город, одиночество…",
    "playlist.tracks":"Треков","playlist.btn":"🎵 Собрать плейлист","playlist.loading":"AI собирает альбом…","playlist.copy.all":"Скопировать все промпты",
    "master.title":"🎚 Мастеринг трека","master.sub":"Улучши качество Suno-трека через Auphonic: шумоподавление, EQ, нормализация громкости. Бесплатно 2 ч/мес.",
    "master.url.ph":"URL MP3-файла (напр. из результата генерации)","master.loudness":"Громкость",
    "master.btn":"🎚 Мастеровать","master.loading":"Auphonic обрабатывает…","master.progress":"Мастеринг… {p}%",
    "master.done":"🎚 Мастеринг завершён","master.download":"⭳ Скачать мастер MP3","master.fail":"Ошибка мастеринга",
    "master.btn.inline":"🎚 Мастеровать трек",
    "card.badge.new":"Новинка","copy.prompt":"Копировать",
    "cat.noresults":"Нет стилей, подходящих под фильтры.",
    "pill.unlocked":"✓ полный доступ","pill.free":"🔒 бесплатный",
    "saved.count":"{n} сохранено",
    "card.gen.btn":"🎵 Создать трек","card.gen.title":"Создать трек в Suno",
    "analyze.closest":"3 ближайших стиля из каталога",
    "card.locked":"ЗАБЛОКИРОВАНО","card.locked.hint":"Открой всё чтобы увидеть промпт",
    "copy":"Копировать",
    "ai.concept":"Концепция","ai.prompt.ready":"Готовый Suno-промпт",
    "dna.transcript.label":"Лирика (Whisper)","dna.artists":"🎯 Ближайшие артисты в каталоге","dna.breakdown":"ДНК по артистам",
    "analyze.detected":"Определено",
    "pricing.title":"Планы SiliconSense","pricing.sub":"Выбери план для своего творческого процесса",
    "pricing.per.mo":"/мес",
    "pricing.free.f1":"✓ Полный каталог 812 артистов","pricing.free.f2":"✓ Конструктор промптов",
    "pricing.free.f3":"✓ 3 AI-запроса в сутки","pricing.free.f4":"✗ Генерация треков","pricing.free.f5":"✗ Мастеринг",
    "pricing.free.btn":"Текущий план",
    "pricing.creator.f1":"✓ Безлимитные AI-функции","pricing.creator.f2":"✓ Голосовая заметка, DNA-декодер",
    "pricing.creator.f3":"✓ Плейлист-билдер","pricing.creator.f4":"✓ Машина времени стилей",
    "pricing.creator.f5":"✓ 5 генераций треков в мес.","pricing.creator.f6":"✗ Мастеринг",
    "pricing.creator.btn":"Подписка Creator",
    "pricing.pro.f1":"✓ Всё из Creator","pricing.pro.f2":"✓ 25 генераций треков в мес.",
    "pricing.pro.f3":"✓ 15 мастерингов в мес.","pricing.pro.f4":"✓ Загрузка референса",
    "pricing.pro.f5":"✓ Приоритетная поддержка","pricing.pro.btn":"Подписка Pro",
    "pricing.activate.sub":"Уже подписан? Введи email оплаты для активации:",
    "pricing.activate.btn":"Активировать","pricing.activate.link":"Уже подписан? Активировать →",
    "reftrack.rec.size":"Запись: {n} KB","reftrack.rec.ready":"· готово к отправке ✓",
    "slop.clean":"чисто, штампов не найдено","slop.loading":"AI переписывает штампы в конкретику…",
    "slop.result.label":"Починенный промпт","slop.changes.label":"Что заменено",
    "tm.from.era":"Из эпохи {era}","tm.retained":"Сохранено от {artist}",
    "ls.result.label":"Лирика с тегами","ls.tags.added":"добавлено","ls.why":"Что и почему",
    "dna.tech":"Технические данные","dna.analysis":"Анализ трека",
    "dna.vocals":"Вокал","dna.production":"Продакшн",
  }
};

function t(key) {
  return LANG[currentLang]?.[key] ?? LANG.en?.[key] ?? key;
}

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem("ss_lang", lang);
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const v = t(el.dataset.i18n);
    if (v) el.textContent = v;
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    const v = t(el.dataset.i18nPh);
    if (v) el.placeholder = v;
  });
  const lb = document.getElementById("lang-toggle");
  if (lb) lb.textContent = lang === "ru" ? "EN" : "RU";
  // re-render dynamic elements that depend on language
  const bpmD = document.getElementById("ctor-bpm-display");
  if (bpmD && bpmD.textContent !== "" && !bpmD.textContent.includes("BPM")) {
    bpmD.textContent = t("ctor.bpm.auto");
  }
  // update constructor preview hints
  if (typeof window._ctorUpdate === "function") window._ctorUpdate();
  // re-render filter chips in new language
  if (facets) renderFacets();
  // update constructor placeholder via CSS variable
  document.documentElement.style.setProperty("--ctor-placeholder", `"${t("ctor.placeholder")}"`);
  // update dynamic pill and saved count (only when app is shown)
  if ($("#unlock-pill")) renderUnlockPill();
  if ($("#saved-count")) renderSaved();
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("ss_theme", theme);
  const tb = document.getElementById("theme-toggle");
  if (tb) tb.textContent = theme === "dark" ? "☀" : "🌙";
}

/* ---------- Access gate ---------- */
function showApp() {
  $("#gate").classList.add("hidden");
  $("#app").classList.remove("hidden");
  loadStatus();
  loadFacets().then(loadCatalog);
  renderUnlockPill();
  renderSaved();
}
// Auto-enter the app if already authorized — called at the very end of the
// file so all const helpers (spin, getSaved, …) are initialized first.

$("#gate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = await api("/api/access", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: $("#access-code").value })
  });
  if (data.ok) { localStorage.setItem(GATE_KEY, data.token); showApp(); }
  else $("#gate-error").textContent = data.error || "Invalid code";
});
$("#logout").addEventListener("click", () => {
  localStorage.removeItem(GATE_KEY);
  $("#app").classList.add("hidden"); $("#gate").classList.remove("hidden");
});

/* ---------- Status ---------- */
async function loadStatus() {
  try {
    const s = await api("/api/status");
    const pill = $("#ai-pill");
    if (s.ai) { pill.textContent = `● AI: ${s.provider}`; pill.classList.add("live"); $("#foot-engine").textContent = `${s.provider} AI engine`; }
    else { pill.textContent = "○ template engine"; $("#foot-engine").textContent = "template engine"; }
    $("#foot-count").textContent = s.catalogSize;
    canGenerate = !!s.generate;
  } catch { /* non-critical */ }
}

/* ---------- Tabs ---------- */
$$(".tab").forEach((tab) => tab.addEventListener("click", () => {
  $$(".tab").forEach((t) => t.classList.remove("active"));
  $$(".panel").forEach((p) => p.classList.remove("active"));
  tab.classList.add("active");
  $("#tab-" + tab.dataset.tab).classList.add("active");
  if (tab.dataset.tab === "saved") renderSaved();
}));

/* ---------- Helpers ---------- */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }
const spin = (label) => `<span class="spinner"></span> <span class="muted">${label}</span>`;

function wireCopyButtons(root) {
  root.querySelectorAll(".copy").forEach((btn) => btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(btn.dataset.prompt);
      const old = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => (btn.textContent = old), 1400);
    } catch { /* unavailable */ }
  }));
}

/* ---------- Saved prompts ---------- */
const getSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; } };
const setSaved = (arr) => localStorage.setItem(SAVED_KEY, JSON.stringify(arr));
const isSaved = (id) => getSaved().some((s) => s.id === id);
function toggleSave(item) {
  const arr = getSaved();
  const i = arr.findIndex((s) => s.id === item.id);
  if (i >= 0) arr.splice(i, 1); else arr.unshift({ ...item, ts: Date.now() });
  setSaved(arr);
}

/* ---------- Facets & filters ---------- */
function renderFacets() {
  if (!facets) return;
  // Language row
  const langs = [{ code: "", label: t("cat.lang.all") }, ...facets.languages.sort((a, b) => b.n - a.n)];
  $("#f-language").innerHTML = langs.map((l) =>
    `<button class="fchip" data-f="language" data-v="${escapeAttr(l.code)}">${escapeHtml(l.label)}${l.n ? `<span class="n">${l.n}</span>` : ""}</button>`).join("");
  // Era row
  const eras = ["", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];
  const eraChips = eras.map((e) =>
    `<button class="fchip" data-f="era" data-v="${e}">${e || t("cat.era.all")}</button>`).join("");
  $("#f-era").innerHTML = eraChips +
    `<button class="fchip" data-f="isNew" data-v="1">${t("cat.new")}<span class="n">${facets.isNew}</span></button>` +
    `<button class="fchip" data-f="free" data-v="1">${t("cat.free")}<span class="n">${facets.free}</span></button>`;
  // Genre row
  const genres = Object.entries(facets.genres).sort((a, b) => b[1] - a[1]);
  $("#f-genre").innerHTML = `<button class="fchip" data-f="genre" data-v="">${t("cat.genre.all")}</button>` +
    genres.map(([g, n]) => `<button class="fchip" data-f="genre" data-v="${escapeAttr(g)}">${escapeHtml(g)}<span class="n">${n}</span></button>`).join("");
  $$(".fchip").forEach((chip) => chip.addEventListener("click", () => onFilter(chip)));
  syncChips();
}

async function loadFacets() {
  facets = await api("/api/facets");
  $("#cat-total").textContent = `${facets.total} styles`;
  renderFacets();
}

function onFilter(chip) {
  const f = chip.dataset.f, v = chip.dataset.v;
  if (f === "free" || f === "isNew") state[f] = !state[f];
  else state[f] = state[f] === v ? "" : v;
  state.page = 1;
  syncChips();
  loadCatalog();
}

function syncChips() {
  $$(".fchip").forEach((chip) => {
    const f = chip.dataset.f, v = chip.dataset.v;
    let on = false;
    if (f === "free" || f === "isNew") on = state[f];
    else on = state[f] === v;
    chip.classList.toggle("active", on);
  });
}

/* ---------- Catalog ---------- */
function cardHTML(card, source) {
  // generated/AI single card (no facet fields)
  if (source === "generated" || source === "ai" || card.ai) {
    const badge = card.ai ? '<span class="cbadge new">AI</span>' : '<span class="cbadge">generated</span>';
    const metaLine = [card.genre, card.key, card.bpm ? card.bpm + " BPM" : null].filter(Boolean).join(" · ");
    return wrapCard(card, `<div class="card-badges">${badge}</div>`, metaLine, card.prompt, false);
  }
  const badges = [
    `<span class="cbadge">${escapeHtml(card.era || "")}</span>`,
    `<span class="cbadge lang">${escapeHtml((card.language || "").toUpperCase())}</span>`,
    card.isNew ? `<span class="cbadge new">${t("card.badge.new")}</span>` : "",
    card.free ? '<span class="cbadge free">FREE</span>' : ""
  ].join("");
  const metaLine = [card.genre, card.key, card.bpm ? card.bpm + " BPM" : null].filter(Boolean).join(" · ");
  return wrapCard(card, `<div class="card-badges">${badges}</div>`, metaLine, card.prompt, card.locked, card.subgenre);
}

function wrapCard(card, badgesHTML, metaLine, prompt, locked, subgenre) {
  const saved = isSaved(card.id);
  const body = locked
    ? `<div class="prompt">${"locked ".repeat(14)}</div>
       <div class="lock-overlay"><span class="lk">🔒</span><b>${t("card.locked")}</b><small>${t("card.locked.hint")}</small></div>`
    : `<div class="prompt">${escapeHtml(prompt)}</div>
       <div class="card-actions">
         <button class="copy" data-prompt="${escapeAttr(prompt)}">${t("copy.prompt")}</button>
         ${(!locked && canGenerate) ? `<button class="gen-track-btn" data-prompt="${escapeAttr(prompt)}" data-name="${escapeAttr(card.name)}" title="${t("card.gen.title")}">${t("card.gen.btn")}</button>` : ""}
       </div>`;
  return `
    <div class="card ${locked ? "locked" : ""}">
      ${badgesHTML}
      <h3>${escapeHtml(card.name)}
        <button class="star ${saved ? "on" : ""}" data-id="${escapeAttr(card.id)}"
          data-name="${escapeAttr(card.name)}" data-prompt="${escapeAttr(prompt || "")}"
          data-genre="${escapeAttr(card.genre || "")}" ${locked ? "disabled title='unlock first'" : ""}>★</button>
      </h3>
      ${subgenre ? `<div class="sub-genre">${escapeHtml(subgenre)}</div>` : ""}
      <div class="meta">${escapeHtml(metaLine)}</div>
      ${body}
      <div class="tags">${(card.tags || []).slice(0, 4).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
    </div>`;
}

function wireCards(root) {
  wireCopyButtons(root);
  root.querySelectorAll(".star").forEach((btn) => btn.addEventListener("click", () => {
    if (btn.disabled) return;
    toggleSave({ id: btn.dataset.id, name: btn.dataset.name, prompt: btn.dataset.prompt, genre: btn.dataset.genre });
    btn.classList.toggle("on");
  }));
  root.querySelectorAll(".gen-track-btn").forEach((btn) => btn.addEventListener("click", () => {
    openGenModal(btn.dataset.prompt, btn.dataset.name);
  }));
}

/* ---------- Generate-track modal ---------- */
function openGenModal(prompt, name) {
  let modal = $("#gen-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "gen-modal";
    modal.className = "gen-modal";
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
  }
  // Regenerate inner HTML each open so t() picks up the current language
  modal.innerHTML = `
    <div class="gen-modal-box">
      <button class="gen-modal-close" id="gen-modal-close">✕</button>
      <h2>${t("gen.title")}</h2>
      <div class="gen-modal-name" id="gen-modal-name"></div>
      <div class="gen-modal-prompt" id="gen-modal-prompt"></div>
      <div class="gen-opts" style="margin-top:12px">
        <label>${t("gen.model")}<select id="gm-mv"><option value="chirp-v5">v5</option><option value="chirp-v5-5">v5.5</option><option value="chirp-v4-5+">v4.5+</option></select></label>
        <label>${t("gen.vocal")}<select id="gm-vocal"><option value="">${t("gen.vocal.any")}</option><option value="Female">${t("gen.vocal.f")}</option><option value="Male">${t("gen.vocal.m")}</option></select></label>
        <label class="check"><input id="gm-instr" type="checkbox" /> ${t("gen.instr")}</label>
      </div>
      <button id="gen-modal-btn" class="primary" style="margin-top:14px;width:100%">${t("gen.btn")}</button>
      <div id="gen-modal-out" class="output"></div>
    </div>`;
  $("#gen-modal-close").addEventListener("click", () => modal.classList.remove("open"));
  $("#gen-modal-name").textContent = name || "";
  $("#gen-modal-prompt").textContent = prompt || "";
  modal.classList.add("open");

  const btn = $("#gen-modal-btn");
  const out = $("#gen-modal-out");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    out.innerHTML = `<div class="spinner">${t("gen.modal.sending")}</div>`;
    try {
      const data = await aiCall("/api/ai/generate-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tags: prompt,
          mv: $("#gm-mv").value,
          vocalGender: $("#gm-vocal").value || undefined,
          instrumental: $("#gm-instr").checked
        })
      });
      if (!data.ok) throw new Error(data.error);
      pollModalTrack(data.jobId, out, btn);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
      btn.disabled = false;
    }
  });
}

function pollModalTrack(jobId, out, btn) {
  out.innerHTML = `<div class="spinner">${t("gen.modal.gen").replace("{p}", '<span id="gm-prog">0%</span>')} <span class="muted">${t("gen.modal.time")}</span></div>`;
  let elapsed = 0;
  const iv = setInterval(async () => {
    elapsed += 5;
    try {
      const job = await api(`/api/ai/track-status?jobId=${encodeURIComponent(jobId)}`);
      const p = out.querySelector("#gm-prog"); if (p && job.progress) p.textContent = job.progress;
      if (job.status === "SUCCESS" && job.musics?.length) {
        clearInterval(iv); btn.disabled = false;
        out.innerHTML = `<div class="ai-result">${job.musics.map((m) => `
          <div class="track-card">
            ${m.imageUrl ? `<img class="track-art" src="${escapeAttr(m.imageUrl)}" alt="art"/>` : ""}
            <div class="track-info">
              <div class="track-title">${escapeHtml(m.title || "Untitled")}</div>
              <div class="track-tags muted">${escapeHtml(m.tags || "")}${m.duration ? ` · ${Math.round(m.duration)}s` : ""}</div>
              <audio controls src="${escapeAttr(m.audioUrl)}"></audio>
              <div class="track-actions"><a href="${escapeAttr(m.audioUrl)}" download>⭳ MP3</a>${m.videoUrl ? `<a href="${escapeAttr(m.videoUrl)}" target="_blank">▦ Video</a>` : ""}${canMaster ? `<button class="master-inline-btn" onclick="window._startMastering('${escapeAttr(m.audioUrl)}')">${t("master.btn.inline")}</button>` : ""}</div>
            </div>
          </div>`).join("")}</div>`;
      } else if (job.status === "FAILED") {
        clearInterval(iv); btn.disabled = false;
        out.innerHTML = `<div class="error">${t("gen.modal.fail")}</div>`;
      } else if (elapsed > 240) {
        clearInterval(iv); btn.disabled = false;
        out.innerHTML = `<div class="error">${t("gen.modal.timeout")}</div>`;
      }
    } catch (err) { clearInterval(iv); btn.disabled = false; out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`; }
  }, 5000);
}

function qs() {
  const p = new URLSearchParams();
  if (state.language) p.set("language", state.language);
  if (state.era) p.set("era", state.era);
  if (state.genre) p.set("genre", state.genre);
  if (state.mood) p.set("mood", state.mood);
  if (state.free) p.set("free", "1");
  if (state.isNew) p.set("isNew", "1");
  if (state.q) p.set("q", state.q);
  p.set("page", state.page);
  const u = localStorage.getItem(UNLOCK_KEY);
  if (u) p.set("u", u);
  return p.toString();
}

async function loadCatalog() {
  const results = $("#results");
  results.innerHTML = spin("loading…");
  $("#pager").innerHTML = "";

  if (state.q && !state.language && !state.era && !state.genre && !state.mood && !state.free && !state.isNew) {
    // pure text search may also generate a card if nothing matches
    const data = await api("/api/catalog?" + qs());
    if (!data.results.length) {
      results.innerHTML = `<div class="card">${spin("generating card…")}</div>`;
      const gen = await api("/api/card/" + encodeURIComponent(state.q) + (localStorage.getItem(UNLOCK_KEY) ? "?u=" + localStorage.getItem(UNLOCK_KEY) : ""));
      results.innerHTML = cardHTML(gen.card, gen.source);
      wireCards(results);
      return;
    }
  }

  const data = await api("/api/catalog?" + qs());
  results.innerHTML = data.results.length
    ? data.results.map((c) => cardHTML(c, "catalog")).join("")
    : `<p class="muted">${t("cat.noresults")}</p>`;
  wireCards(results);
  renderPager(data);
}

function renderPager(data) {
  if (data.pages <= 1) { $("#pager").innerHTML = ""; return; }
  $("#pager").innerHTML = `
    <button id="prev" ${data.page <= 1 ? "disabled" : ""}>${t("pager.prev")}</button>
    <span class="pinfo">${t("pager.info").replace("{p}", data.page).replace("{t}", data.pages).replace("{n}", data.total)}</span>
    <button id="next" ${data.page >= data.pages ? "disabled" : ""}>${t("pager.next")}</button>`;
  const prev = $("#prev"), next = $("#next");
  if (prev) prev.onclick = () => { state.page--; loadCatalog(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  if (next) next.onclick = () => { state.page++; loadCatalog(); window.scrollTo({ top: 0, behavior: "smooth" }); };
}

$("#search-btn").addEventListener("click", () => { state.q = $("#search").value.trim(); state.page = 1; loadCatalog(); });
$("#search").addEventListener("keydown", (e) => { if (e.key === "Enter") { state.q = $("#search").value.trim(); state.page = 1; loadCatalog(); } });
$("#f-mood").addEventListener("change", () => { state.mood = $("#f-mood").value; state.page = 1; loadCatalog(); });

/* ---------- Unlock ---------- */
function renderUnlockPill() {
  const unlocked = !!localStorage.getItem(UNLOCK_KEY);
  const pill = $("#unlock-pill");
  pill.textContent = unlocked ? t("pill.unlocked") : t("pill.free");
  pill.classList.toggle("live", unlocked);
  $("#unlock-btn").style.display = unlocked ? "none" : "";
}
$("#unlock-btn").addEventListener("click", () => {
  const modal = document.getElementById("pricing-modal");
  const activatePanel = document.getElementById("pricing-activate");
  const showActivate = document.getElementById("show-activate");
  if (modal) {
    modal.style.display = "flex";
    if (activatePanel) activatePanel.style.display = "block";
    if (showActivate) showActivate.style.display = "none";
  }
});

/* ---------- Vocal Anchor ---------- */
$("#anchor-btn").addEventListener("click", async () => {
  const body = { pitch: $("#ax-pitch").value, timbre: $("#ax-timbre").value, delivery: $("#ax-delivery").value,
    texture: $("#ax-texture").value, age: $("#ax-age").value, donor: $("#ax-donor").value };
  const data = await api("/api/vocal-anchor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = $("#anchor-out");
  out.innerHTML = `<h4>Vocal anchor</h4><div class="prompt">${escapeHtml(data.suno)}</div>
    <button class="copy" data-prompt="${escapeAttr(data.suno)}" style="margin-top:12px">${t("copy")}</button>`;
  wireCopyButtons(out);
});

/* ---------- Reference Analysis ---------- */
const dropzone = $("#dropzone"), fileInput = $("#file");
let currentFile = null;
dropzone.addEventListener("click", () => fileInput.click());
["dragover", "dragenter"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); }));
dropzone.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]); });
fileInput.addEventListener("change", () => { if (fileInput.files.length) setFile(fileInput.files[0]); });
function setFile(f) { currentFile = f; $("#filename").textContent = `${f.name} · ${(f.size / 1048576).toFixed(1)} MB`; $("#analyze-btn").disabled = false; }

$("#analyze-btn").addEventListener("click", async () => {
  if (!currentFile) return;
  const out = $("#analyze-out");
  out.innerHTML = spin("reading audio & building prompt…");
  const fd = new FormData(); fd.append("file", currentFile);
  let data;
  try { const res = await fetch("/api/analyze", { method: "POST", body: fd }); data = await res.json(); if (data.error) throw new Error(data.error); }
  catch (err) { out.innerHTML = `<div class="prompt" style="color:var(--bad)">${escapeHtml(err.message || "Analysis failed")}</div>`; return; }
  const d = data.detected;
  const modeTag = data.mode === "ai" ? '<span class="mode-tag">AI-enhanced</span>' : data.mode === "metadata" ? '<span class="mode-tag">from real metadata</span>' : "";
  const cells = [["Genre", d.genre], ["Era", d.era], ["BPM", d.bpm || "—"],
    ["Duration", d.durationSec != null ? fmtDur(d.durationSec) : "—"],
    ["Bitrate", d.bitrate ? Math.round(d.bitrate / 1000) + " kbps" : "—"],
    ["Sample rate", d.sampleRate ? d.sampleRate / 1000 + " kHz" : "—"],
    ["Channels", d.channels === 1 ? "mono" : d.channels === 2 ? "stereo" : (d.channels || "—")],
    ["Codec", d.codec || "—"], ["Vocals", d.vocals || "—"]];
  out.innerHTML = `<h4>${t("analyze.detected")} ${modeTag}</h4>
    <div class="metagrid">${cells.map(([k, v]) => `<div><b>${k}</b>${escapeHtml(String(v))}</div>`).join("")}</div>
    <h4>${t("ai.prompt.label")}</h4><div class="prompt">${escapeHtml(data.prompt)}</div>
    <button class="copy" data-prompt="${escapeAttr(data.prompt)}" style="margin:12px 0">${t("copy.prompt")}</button>
    <h4>${t("analyze.closest")}</h4>
    <div class="closest">${data.closest.map((a) => `<div class="chip">${escapeHtml(a.name)}<small>${escapeHtml(a.genre)}</small></div>`).join("")}</div>`;
  wireCopyButtons(out);
});
function fmtDur(sec) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; }

/* ---------- Cover ---------- */
$("#cover-btn").addEventListener("click", async () => {
  const body = { title: $("#cv-title").value || "Untitled", artist: $("#cv-artist").value || "Unknown Artist",
    genre: $("#cv-genre").value || "electronic", withLogo: $("#cv-logo").checked };
  const data = await api("/api/cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = $("#cover-out");
  out.innerHTML = `<h4>Palette</h4>
    <div class="swatches">${data.palette.map((c) => `<div class="swatch" style="background:${escapeAttr(c)}"></div>`).join("")}</div>
    <h4>Concept (2048×2048)</h4><div class="prompt">${escapeHtml(data.concept)}</div>
    <button class="copy" data-prompt="${escapeAttr(data.concept)}" style="margin-top:12px">${t("copy")}</button>`;
  wireCopyButtons(out);
});

/* ---------- Song Structure ---------- */
$("#structure-btn").addEventListener("click", async () => {
  const out = $("#structure-out"); out.innerHTML = spin("building…");
  const body = { style: $("#st-style").value, title: $("#st-title").value, preset: $("#st-preset").value };
  const data = await api("/api/song-structure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const tag = data.mode === "ai" ? '<span class="mode-tag">AI</span>' : '<span class="mode-tag">template</span>';
  out.innerHTML = `<h4>Arrangement ${tag}</h4><pre>${escapeHtml(data.suno)}</pre>
    <button class="copy" data-prompt="${escapeAttr(data.suno)}" style="margin-top:12px">${t("copy")}</button>`;
  wireCopyButtons(out);
});

/* ---------- Lyrics ---------- */
$("#lyrics-btn").addEventListener("click", async () => {
  const out = $("#lyrics-out"); out.innerHTML = spin("writing…");
  const body = { theme: $("#ly-theme").value || "the open road", style: $("#ly-style").value,
    mood: $("#ly-mood").value || "hopeful", language: $("#ly-lang").value || "English" };
  const data = await api("/api/lyrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const tag = data.mode === "ai" ? '<span class="mode-tag">AI</span>' : '<span class="mode-tag">skeleton (add AI key for full lyrics)</span>';
  out.innerHTML = `<h4>Lyrics ${tag}</h4><pre>${escapeHtml(data.lyrics)}</pre>
    <button class="copy" data-prompt="${escapeAttr(data.lyrics)}" style="margin-top:12px">${t("copy")}</button>`;
  wireCopyButtons(out);
});

/* ---------- Saved tab ---------- */
function renderSaved() {
  const arr = getSaved();
  $("#saved-count").textContent = t("saved.count").replace("{n}", arr.length);
  const list = $("#saved-list");
  if (!arr.length) { list.innerHTML = `<p class="muted">${t("saved.empty")}</p>`; return; }
  list.innerHTML = arr.map((s) => `
    <div class="card">
      <h3>${escapeHtml(s.name)}
        <button class="star on" data-del="${escapeAttr(s.id)}" title="remove">★</button>
      </h3>
      <div class="meta">${escapeHtml(s.genre || "")}</div>
      <div class="prompt">${escapeHtml(s.prompt)}</div>
      <button class="copy" data-prompt="${escapeAttr(s.prompt)}" style="margin-top:12px">${t("copy.prompt")}</button>
    </div>`).join("");
  wireCopyButtons(list);
  list.querySelectorAll(".star[data-del]").forEach((btn) => btn.addEventListener("click", () => {
    setSaved(getSaved().filter((s) => s.id !== btn.dataset.del)); renderSaved();
  }));
}
$("#clear-saved").addEventListener("click", () => { if (confirm("Clear all saved prompts?")) { setSaved([]); renderSaved(); } });
$("#export-json").addEventListener("click", () => download("siliconsense-prompts.json", JSON.stringify(getSaved(), null, 2)));
$("#export-txt").addEventListener("click", () =>
  download("siliconsense-prompts.txt", getSaved().map((s) => `### ${s.name} (${s.genre})\n${s.prompt}`).join("\n\n")));
function download(name, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- AI Lab — Reference → Track (TTAPI Sample) ---------- */
(function () {
  const dz = $("#ref-dropzone");
  const fileInput = $("#ref-file");
  const options = $("#ref-options");
  const btn = $("#ref-btn");
  const out = $("#ref-out");
  const weightInput = $("#ref-weight");
  const weightVal = $("#ref-weight-val");
  const disabledMsg = $("#ref-disabled");
  if (!btn) return;

  api("/api/status").then((s) => {
    if (!s.generate) { disabledMsg?.classList.remove("hidden"); }
  }).catch(() => {});

  // ── Mode tabs ──
  let activeMode = "file";
  document.querySelectorAll(".ref-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".ref-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeMode = tab.dataset.mode;
      $("#ref-file-mode")?.classList.toggle("hidden", activeMode !== "file");
      $("#ref-mic-mode")?.classList.toggle("hidden", activeMode !== "mic");
    });
  });

  // ── File upload ──
  dz?.addEventListener("click", () => fileInput.click());
  dz?.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag"); });
  dz?.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz?.addEventListener("drop", (e) => {
    e.preventDefault(); dz.classList.remove("drag");
    if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event("change")); }
  });
  fileInput?.addEventListener("change", () => {
    const f = fileInput.files[0]; if (!f) return;
    $("#ref-filename").textContent = f.name;
    options?.classList.remove("hidden");
    loadRefAudio(f);
  });
  weightInput?.addEventListener("input", () => { if (weightVal) weightVal.textContent = weightInput.value; });

  // ── Waveform ──
  let audioDuration = 0;
  let wfDragging = null; // "l" | "r"
  const wfCanvas = $("#ref-waveform");
  const wfSel = $("#ref-wf-sel");
  const wfHandleL = $("#ref-wf-l");
  const wfHandleR = $("#ref-wf-r");
  const wfCursor = $("#ref-wf-cursor");
  const wfWrap = $("#ref-waveform-wrap");
  const audioPlayer = $("#ref-audio-player");
  const startInput = $("#ref-start");
  const endInput = $("#ref-end");

  function secToFrac(s) { return audioDuration > 0 ? Math.max(0, Math.min(1, s / audioDuration)) : 0; }
  function fracToSec(f) { return Math.round(f * audioDuration * 10) / 10; }

  function updateHandlePositions() {
    if (!wfWrap || !audioDuration) return;
    const W = wfWrap.offsetWidth;
    const lFrac = secToFrac(Number(startInput?.value || 0));
    const rFrac = secToFrac(Number(endInput?.value || 30));
    if (wfHandleL) wfHandleL.style.left = (lFrac * 100) + "%";
    if (wfHandleR) wfHandleR.style.left = (rFrac * 100) + "%";
    if (wfSel) {
      wfSel.style.left = (lFrac * 100) + "%";
      wfSel.style.width = ((rFrac - lFrac) * 100) + "%";
    }
    if ($("#ref-wf-l-label")) $("#ref-wf-l-label").textContent = Math.round(Number(startInput?.value || 0)) + "s";
    if ($("#ref-wf-r-label")) $("#ref-wf-r-label").textContent = Math.round(Number(endInput?.value || 30)) + "s";
  }

  function drawWaveform(audioBuffer) {
    if (!wfCanvas) return;
    const W = wfWrap?.offsetWidth || 600;
    wfCanvas.width = W;
    const H = wfCanvas.height;
    const ctx = wfCanvas.getContext("2d");
    const raw = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(raw.length / W));
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(20,21,38,0.8)";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < W; i++) {
      let mn = 0, mx = 0;
      for (let j = 0; j < step; j++) {
        const v = raw[i * step + j] || 0;
        if (v < mn) mn = v; if (v > mx) mx = v;
      }
      const top = H / 2 - mx * (H / 2 - 4);
      const bot = H / 2 - mn * (H / 2 - 4);
      const h = Math.max(1, bot - top);
      const alpha = 0.4 + Math.abs(mx - mn) * 0.6;
      ctx.fillStyle = `rgba(124,140,255,${alpha})`;
      ctx.fillRect(i, top, 1, h);
    }
  }

  async function loadRefAudio(file) {
    const url = URL.createObjectURL(file);
    if (audioPlayer) { audioPlayer.src = url; audioPlayer.load(); }
    try {
      const arrayBuf = await file.arrayBuffer();
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await actx.decodeAudioData(arrayBuf);
      audioDuration = audioBuffer.duration;
      if (endInput) endInput.value = Math.min(30, Math.round(audioDuration));
      if (startInput) startInput.value = 0;
      drawWaveform(audioBuffer);
      updateHandlePositions();
      if (wfWrap) wfWrap.classList.remove("hidden");
    } catch (e) {
      console.warn("Waveform decode failed:", e.message);
      if (endInput) endInput.value = 30;
      if (startInput) startInput.value = 0;
    }
  }

  // Drag handles
  function onWfMouseDown(e, side) {
    wfDragging = side; e.preventDefault();
  }
  wfHandleL?.addEventListener("mousedown", (e) => onWfMouseDown(e, "l"));
  wfHandleR?.addEventListener("mousedown", (e) => onWfMouseDown(e, "r"));
  wfHandleL?.addEventListener("touchstart", (e) => { wfDragging = "l"; }, { passive: true });
  wfHandleR?.addEventListener("touchstart", (e) => { wfDragging = "r"; }, { passive: true });

  function getWfFrac(e) {
    const rect = wfWrap.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function onWfMove(e) {
    if (!wfDragging || !audioDuration) return;
    const frac = getWfFrac(e);
    const sec = fracToSec(frac);
    const lSec = Number(startInput?.value || 0);
    const rSec = Number(endInput?.value || 30);
    if (wfDragging === "l") {
      if (sec < rSec - 1 && startInput) { startInput.value = sec; }
    } else {
      if (sec > lSec + 1 && sec <= audioDuration && endInput) { endInput.value = sec; }
    }
    updateHandlePositions();
  }
  document.addEventListener("mousemove", onWfMove);
  document.addEventListener("touchmove", onWfMove, { passive: true });
  document.addEventListener("mouseup", () => { wfDragging = null; });
  document.addEventListener("touchend", () => { wfDragging = null; });

  // Click on wrap → move nearest handle
  wfWrap?.addEventListener("click", (e) => {
    if (!audioDuration || wfDragging) return;
    const frac = getWfFrac(e);
    const sec = fracToSec(frac);
    const lSec = Number(startInput?.value || 0);
    const rSec = Number(endInput?.value || 30);
    if (Math.abs(sec - lSec) < Math.abs(sec - rSec)) {
      if (sec < rSec - 1 && startInput) startInput.value = sec;
    } else {
      if (sec > lSec + 1 && endInput) endInput.value = sec;
    }
    updateHandlePositions();
  });

  // Manual input changes sync → waveform
  startInput?.addEventListener("input", updateHandlePositions);
  endInput?.addEventListener("input", updateHandlePositions);

  // Playback cursor
  audioPlayer?.addEventListener("timeupdate", () => {
    if (!audioDuration || !wfCursor || !wfWrap) return;
    const frac = audioPlayer.currentTime / audioDuration;
    wfCursor.style.left = (frac * 100) + "%";
    wfCursor.style.display = "block";
  });

  // ── Mic recording ──
  let micRecorder = null, micChunks = [], micBlob = null, micTimerIv = null;
  const micBtn = $("#ref-mic-btn");
  const micTimer = $("#ref-mic-timer");
  const micSec = $("#ref-mic-sec");
  const micWave = $("#ref-mic-wave");
  const micPlayback = $("#ref-mic-playback");
  const micAudio = $("#ref-mic-audio");
  const micUseBtn = $("#ref-mic-use-btn");
  const micRedoBtn = $("#ref-mic-redo-btn");
  const micName = $("#ref-mic-name");

  function resetMic() {
    micBlob = null; micChunks = [];
    micPlayback?.classList.add("hidden");
    micBtn?.classList.remove("hidden");
    micTimer?.classList.add("hidden");
    micWave?.classList.add("hidden");
    if (micName) micName.textContent = "";
    options?.classList.add("hidden");
  }

  micBtn?.addEventListener("click", async () => {
    if (micRecorder?.state === "recording") {
      micRecorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micChunks = [];
      micRecorder = new MediaRecorder(stream);
      micRecorder.ondataavailable = (e) => { if (e.data.size) micChunks.push(e.data); };
      micRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        micBlob = new Blob(micChunks, { type: "audio/webm" });
        micAudio.src = URL.createObjectURL(micBlob);
        micPlayback?.classList.remove("hidden");
        micBtn?.classList.add("hidden");
        micTimer?.classList.add("hidden");
        micWave?.classList.add("hidden");
        clearInterval(micTimerIv);
        if (micName) micName.textContent = t("reftrack.rec.size").replace("{n}", Math.round(micBlob.size / 1024));
      };
      micRecorder.start();
      micBtn.textContent = t("voice.record.stop");
      micTimer?.classList.remove("hidden");
      micWave?.classList.remove("hidden");
      let secs = 0;
      if (micSec) micSec.textContent = 0;
      micTimerIv = setInterval(() => { secs++; if (micSec) micSec.textContent = secs; if (secs >= 120) micRecorder.stop(); }, 1000);
    } catch (e) {
      out.innerHTML = `<div class="error">Нет доступа к микрофону: ${escapeHtml(e.message)}</div>`;
    }
  });

  micUseBtn?.addEventListener("click", () => {
    if (!micBlob) return;
    options?.classList.remove("hidden");
    const f = new File([micBlob], "mic-reference.webm", { type: micBlob.type });
    loadRefAudio(f);
    if (micName) micName.textContent += " " + t("reftrack.rec.ready");
  });

  micRedoBtn?.addEventListener("click", () => {
    micBtn.textContent = t("reftrack.start");
    resetMic();
  });

  // ── Submit ──
  btn?.addEventListener("click", async () => {
    let f = null;
    if (activeMode === "file") {
      f = fileInput?.files[0];
      if (!f) { out.innerHTML = `<div class="error">Загрузи аудио-файл</div>`; return; }
    } else {
      if (!micBlob) { out.innerHTML = `<div class="error">Сначала запиши референс с микрофона и нажми «Использовать»</div>`; return; }
      f = new File([micBlob], "mic-reference.webm", { type: micBlob.type });
    }
    if (!f) return;
    out.innerHTML = `<div class="spinner">Загружаю референс в Suno… <span class="muted">(шаг 1 из 2)</span></div>`;
    btn.disabled = true;
    try {
      const fd = new FormData();
      fd.append("audio", f);
      fd.append("startSec", $("#ref-start")?.value || "0");
      fd.append("endSec", $("#ref-end")?.value || "30");
      fd.append("audioWeight", weightInput?.value || "0.7");
      fd.append("mv", $("#ref-mv")?.value || "chirp-v5");
      const vocal = $("#ref-vocal")?.value;
      if (vocal) fd.append("vocalGender", vocal);
      if ($("#ref-instr")?.checked) fd.append("instrumental", "true");
      const desc = $("#ref-desc")?.value?.trim();
      if (desc) fd.append("description", desc);

      const data = await aiCall("/api/ai/reference-generate", { method: "POST", body: fd });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = `<div class="spinner">Референс загружен, Suno генерирует трек… <span id="ref-prog">0%</span> <span class="muted">(30–90 сек)</span></div>`;
      pollRef(data.jobId);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
      btn.disabled = false;
    }
  });

  function pollRef(jobId) {
    let elapsed = 0;
    const iv = setInterval(async () => {
      elapsed += 5;
      try {
        const job = await api(`/api/ai/track-status?jobId=${encodeURIComponent(jobId)}`);
        const p = $("#ref-prog"); if (p && job.progress) p.textContent = job.progress;
        if (job.status === "SUCCESS" && job.musics?.length) {
          clearInterval(iv); btn.disabled = false;
          out.innerHTML = `<div class="ai-result">${job.musics.map((m) => `
            <div class="track-card">
              ${m.imageUrl ? `<img class="track-art" src="${escapeAttr(m.imageUrl)}" alt="art"/>` : ""}
              <div class="track-info">
                <div class="track-title">${escapeHtml(m.title || "Reference Track")}</div>
                <div class="track-tags muted">${escapeHtml(m.tags || "")}${m.duration ? ` · ${Math.round(m.duration)}s` : ""}</div>
                <audio controls src="${escapeAttr(m.audioUrl)}"></audio>
                <div class="track-actions">
                  <a href="${escapeAttr(m.audioUrl)}" download>⭳ MP3</a>
                  ${m.videoUrl ? `<a href="${escapeAttr(m.videoUrl)}" target="_blank">▦ Video</a>` : ""}
                </div>
              </div>
            </div>`).join("")}</div>`;
        } else if (job.status === "FAILED") {
          clearInterval(iv); btn.disabled = false;
          out.innerHTML = `<div class="error">Ошибка генерации</div>`;
        } else if (elapsed > 300) {
          clearInterval(iv); btn.disabled = false;
          out.innerHTML = `<div class="error">Слишком долго — попробуй ещё раз</div>`;
        }
      } catch (e) { clearInterval(iv); btn.disabled = false; out.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`; }
    }, 5000);
  }
})();

/* ---------- AI Lab — Generate Track (TTAPI) ---------- */
(function () {
  const btn = $("#gen-btn");
  const input = $("#gen-input");
  const out = $("#gen-out");
  const disabledMsg = $("#gen-disabled");
  if (!btn) return;

  // Reveal "not configured" notice based on /api/status.generate
  api("/api/status").then((s) => {
    if (!s.generate) { disabledMsg.classList.remove("hidden"); btn.disabled = true; }
  }).catch(() => {});

  let polling = null;
  function stopPoll() { if (polling) { clearInterval(polling); polling = null; } }

  btn.addEventListener("click", async () => {
    const tags = input.value.trim();
    if (!tags) { out.innerHTML = `<div class="error">Вставь промпт</div>`; return; }
    stopPoll();
    out.innerHTML = `<div class="spinner">Отправляю в Suno…</div>`;
    btn.disabled = true;
    try {
      const data = await aiCall("/api/ai/generate-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tags,
          lyrics: $("#gen-lyrics").value.trim() || undefined,
          title: $("#gen-title").value.trim() || undefined,
          mv: $("#gen-mv").value,
          vocalGender: $("#gen-vocal").value || undefined,
          instrumental: $("#gen-instr").checked
        })
      });
      if (!data.ok) throw new Error(data.error);
      pollTrack(data.jobId);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
      btn.disabled = false;
    }
  });

  function pollTrack(jobId) {
    let elapsed = 0;
    out.innerHTML = `<div class="spinner">Suno генерирует трек… <span id="gen-prog">0%</span> <span class="muted">(обычно 30–90 сек)</span></div>`;
    polling = setInterval(async () => {
      elapsed += 5;
      try {
        const job = await api(`/api/ai/track-status?jobId=${encodeURIComponent(jobId)}`);
        if (job.progress) { const p = $("#gen-prog"); if (p) p.textContent = job.progress; }
        if (job.status === "SUCCESS" && job.musics?.length) {
          stopPoll(); btn.disabled = false;
          out.innerHTML = `<div class="ai-result">${job.musics.map(renderTrack).join("")}</div>`;
        } else if (job.status === "FAILED") {
          stopPoll(); btn.disabled = false;
          out.innerHTML = `<div class="error">Suno вернул ошибку генерации</div>`;
        } else if (elapsed > 240) {
          stopPoll(); btn.disabled = false;
          out.innerHTML = `<div class="error">Слишком долго — попробуй ещё раз</div>`;
        }
      } catch (err) {
        stopPoll(); btn.disabled = false;
        out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
      }
    }, 5000);
  }

  function renderTrack(m) {
    return `
      <div class="track-card">
        ${m.imageUrl ? `<img class="track-art" src="${escapeAttr(m.imageUrl)}" alt="art" />` : ""}
        <div class="track-info">
          <div class="track-title">${escapeHtml(m.title || "Untitled")}</div>
          <div class="track-tags muted">${escapeHtml(m.tags || "")}${m.duration ? ` · ${Math.round(m.duration)}s` : ""}</div>
          <audio controls src="${escapeAttr(m.audioUrl)}"></audio>
          <div class="track-actions">
            <a class="small" href="${escapeAttr(m.audioUrl)}" download>⭳ MP3</a>
            ${m.videoUrl ? `<a class="small" href="${escapeAttr(m.videoUrl)}" target="_blank">▦ Video</a>` : ""}
          </div>
        </div>
      </div>`;
  }
})();

/* ---------- AI Lab — Style Time Machine ---------- */
(function () {
  const artistInput = $("#tm-artist");
  const noteInput = $("#tm-note");
  const btn = $("#tm-btn");
  const out = $("#tm-out");
  if (!btn) return;

  let selectedEra = "";
  document.querySelectorAll(".era-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".era-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      selectedEra = chip.dataset.era;
    });
  });

  btn.addEventListener("click", async () => {
    const artist = artistInput.value.trim();
    if (!artist) { out.innerHTML = `<div class="error">Введи имя артиста</div>`; return; }
    if (!selectedEra) { out.innerHTML = `<div class="error">Выбери эпоху</div>`; return; }
    out.innerHTML = `<div class="spinner">Машина времени запущена… Claude переносит ${escapeHtml(artist)} в ${escapeHtml(selectedEra)}…</div>`;
    btn.disabled = true;
    try {
      const data = await aiCall("/api/ai/time-machine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist, era: selectedEra, note: noteInput.value.trim() || undefined })
      });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderTimeMachine(data);
      wireCopyButtons(out);
      out.querySelectorAll(".gen-track-btn").forEach((b) =>
        b.addEventListener("click", () => openGenModal(b.dataset.prompt, b.dataset.name)));
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });

  function renderTimeMachine(d) {
    return `<div class="ai-result">
      <div class="tm-headline">${escapeHtml(d.artist)} × ${escapeHtml(d.targetEra)}</div>
      <div class="ai-atmo"><strong>${t("ai.concept")}:</strong> ${escapeHtml(d.concept)}</div>
      <div class="ai-prompt-box">
        <div class="prompt-label">${t("ai.prompt.label")}</div>
        <div class="prompt">${escapeHtml(d.prompt)}</div>
        <div class="card-actions">
          <button class="copy" data-prompt="${escapeAttr(d.prompt)}">${t("copy")}</button>
          ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(d.prompt)}" data-name="${escapeAttr(d.artist + " × " + d.targetEra)}">${t("card.gen.btn")}</button>` : ""}
        </div>
      </div>
      <div class="tm-split">
        <div>
          <div class="prompt-label">${t("tm.from.era").replace("{era}", escapeHtml(d.targetEra))}</div>
          ${d.eraInstruments.map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`).join(" ")}
          ${d.eraProduction ? `<div class="muted" style="font-size:12px;margin-top:6px">${escapeHtml(d.eraProduction)}</div>` : ""}
        </div>
        <div>
          <div class="prompt-label">${t("tm.retained").replace("{artist}", escapeHtml(d.artist))}</div>
          ${d.retainedFromArtist.map((r) => `<span class="tag mood">${escapeHtml(r)}</span>`).join(" ")}
        </div>
      </div>
      <div class="ai-meta">
        ${d.bpm ? `<span class="tag">${d.bpm} BPM</span>` : ""}
        ${d.key ? `<span class="tag">${escapeHtml(d.key)}</span>` : ""}
        ${d.mood.map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`).join("")}
      </div>
    </div>`;
  }
})();

/* ---------- AI Lab — Lyrics Sync Conductor ---------- */
(function () {
  const lyricsInput = $("#ls-lyrics");
  const styleInput = $("#ls-style");
  const btn = $("#ls-btn");
  const out = $("#ls-out");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const lyrics = lyricsInput.value.trim();
    if (!lyrics) { out.innerHTML = `<div class="error">Вставь лирику</div>`; return; }
    out.innerHTML = `<div class="spinner">Дирижирую эмоциональным арком…</div>`;
    btn.disabled = true;
    try {
      const data = await aiCall("/api/ai/lyrics-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics, style: styleInput.value.trim() || undefined })
      });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderLyricsSync(data);
      wireCopyButtons(out);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });

  function renderLyricsSync(d) {
    return `<div class="ai-result">
      <div class="ai-prompt-box">
        <div class="prompt-label">${t("ls.result.label")} <span class="ok">· ${d.tagsAdded.length} ${t("ls.tags.added")}</span></div>
        <pre class="prompt struct">${escapeHtml(d.tagged)}</pre>
        <button class="copy" data-prompt="${escapeAttr(d.tagged)}">${t("copy.prompt")}</button>
      </div>
      ${d.tagsAdded.length ? `
      <div class="ls-tags-list">
        <div class="prompt-label">${t("ls.why")}</div>
        ${d.tagsAdded.map((t) => `
          <div class="ls-tag-row">
            <code class="ls-tag-name">${escapeHtml(t.tag)}</code>
            <span class="ls-tag-why">${escapeHtml(t.why || "")}</span>
          </div>`).join("")}
      </div>` : ""}
      ${d.tip ? `<div class="dna-note">💡 ${escapeHtml(d.tip)}</div>` : ""}
    </div>`;
  }
})();

/* ---------- AI Lab — Track DNA Decoder ---------- */
(function () {
  const dz = $("#dna-dropzone");
  const fileInput = $("#dna-file");
  const btn = $("#dna-btn");
  const out = $("#dna-out");
  if (!dz) return;

  dz.addEventListener("click", () => fileInput.click());
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz.addEventListener("drop", (e) => {
    e.preventDefault(); dz.classList.remove("drag");
    if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event("change")); }
  });
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0]; if (!f) return;
    $("#dna-filename").textContent = f.name;
    btn.disabled = false;
  });

  btn.addEventListener("click", async () => {
    const f = fileInput.files[0]; if (!f) return;
    out.innerHTML = `<div class="dna-steps">
      <div class="dna-step active" id="ds1">📦 Читаю метаданные…</div>
      <div class="dna-step" id="ds2">🎤 Whisper слушает лирику…</div>
      <div class="dna-step" id="ds3">🧠 Claude строит ДНК-отчёт…</div>
    </div>`;
    btn.disabled = true;

    // Animate steps — they're sequential on server so simulate timing
    const steps = [1, 2, 3];
    let si = 0;
    const stepIv = setInterval(() => {
      if (si < steps.length) {
        const prev = out.querySelector(`#ds${steps[si]}`);
        if (prev) prev.classList.add("done");
        si++;
        const cur = out.querySelector(`#ds${steps[si]}`);
        if (cur) cur.classList.add("active");
      }
    }, 4000);

    try {
      const fd = new FormData();
      fd.append("file", f);
      const data = await aiCall("/api/ai/dna-decode", { method: "POST", body: fd });
      clearInterval(stepIv);
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderDNA(data);
      wireCopyButtons(out);
      // Wire generate buttons inside DNA result
      out.querySelectorAll(".gen-track-btn").forEach((b) => {
        b.addEventListener("click", () => openGenModal(b.dataset.prompt, b.dataset.name));
      });
    } catch (err) {
      clearInterval(stepIv);
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });

  function renderDNA(d) {
    const a = d.analysis || {};
    const tags = [
      a.era && `<span class="tag">${escapeHtml(a.era)}</span>`,
      a.genre && `<span class="tag">${escapeHtml(a.genre)}</span>`,
      a.subgenre && `<span class="tag">${escapeHtml(a.subgenre)}</span>`,
      a.bpm && `<span class="tag">${a.bpm} BPM</span>`,
      a.key && `<span class="tag">${escapeHtml(a.key)}</span>`,
      ...(a.mood || []).map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`),
      ...(a.instruments || []).slice(0, 4).map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`)
    ].filter(Boolean).join("");

    const closestHTML = (d.closest || []).map((c) => `
      <div class="dna-match">
        <div class="dna-match-name">${escapeHtml(c.name)}</div>
        <div class="dna-match-reason muted">${escapeHtml(c.reason || "")}</div>
        ${c.prompt ? `
          <div class="dna-match-prompt">${escapeHtml(c.prompt)}</div>
          <div class="dna-match-actions">
            <button class="copy" data-prompt="${escapeAttr(c.prompt)}">${t("copy.prompt")}</button>
            ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(c.prompt)}" data-name="${escapeAttr(c.name)}">${t("card.gen.btn")}</button>` : ""}
          </div>` : ""}
      </div>`).join("");

    const meta = d.meta || {};
    const metaLine = [
      meta.codec && escapeHtml(meta.codec),
      meta.bitrate && `${Math.round(meta.bitrate / 1000)}kbps`,
      meta.sampleRate && `${meta.sampleRate / 1000}kHz`,
      meta.duration && `${Math.floor(meta.duration / 60)}:${String(meta.duration % 60).padStart(2, "0")}`
    ].filter(Boolean).join(" · ");

    return `<div class="ai-result dna-result">

      <div class="dna-section">
        <div class="prompt-label">${t("dna.tech")}</div>
        <div class="muted" style="font-size:12px">${metaLine || "—"}</div>
      </div>

      <div class="dna-section">
        <div class="prompt-label">${t("dna.analysis")}</div>
        <div class="ai-meta">${tags}</div>
        ${a.vocals ? `<div style="margin-top:8px;font-size:13px"><b>${t("dna.vocals")}:</b> ${escapeHtml(a.vocals)}</div>` : ""}
        ${a.production ? `<div style="font-size:13px"><b>${t("dna.production")}:</b> ${escapeHtml(a.production)}</div>` : ""}
        ${a.producerNote ? `<div class="dna-note">💬 ${escapeHtml(a.producerNote)}</div>` : ""}
      </div>

      ${d.transcript ? `<div class="dna-section">
        <div class="prompt-label">${t("dna.transcript.label")}</div>
        <div class="dna-lyrics">${escapeHtml(d.transcript.slice(0, 400))}${d.transcript.length > 400 ? "…" : ""}</div>
      </div>` : ""}

      <div class="ai-prompt-box">
        <div class="prompt-label">${t("ai.prompt.ready")}</div>
        <div class="prompt">${escapeHtml(d.sunoPrompt)}</div>
        <div class="card-actions">
          <button class="copy" data-prompt="${escapeAttr(d.sunoPrompt)}">${t("copy")}</button>
          ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(d.sunoPrompt)}" data-name="DNA Decode">${t("card.gen.btn")}</button>` : ""}
        </div>
      </div>

      <div class="dna-section">
        <div class="prompt-label">${t("dna.artists")}</div>
        <div class="dna-matches">${closestHTML}</div>
      </div>
    </div>`;
  }
})();

/* ---------- AI Lab — Anti-Slop scorer (client-side, instant) ---------- */
const SLOP_WEAK = [
  "beautiful","epic","cool","vibey","amazing","awesome","nice","great","good",
  "powerful drums","powerful","emotional","catchy","banger","fire","vibe","energy",
  "cinematic","orchestral","melodic","atmospheric","ethereal","dreamy","chill",
  "sad","happy","dark","heavy","intense","smooth","groovy","fresh","modern"
];
const SLOP_CLICHE_COMBOS = [
  ["epic","cinematic"], ["cinematic","orchestral"], ["epic","orchestral"],
  ["sad","piano"], ["melancholic","piano"], ["emotional","piano"],
  ["dark","trap"], ["melodic","trap"], ["hard","808"],
  ["beautiful","emotional"], ["powerful","emotional"],
];
function scorePrompt(text) {
  const t = text.toLowerCase();
  const tokens = t.split(/[,;.\n]+/).map((s) => s.trim()).filter(Boolean);
  const words = t.split(/\s+/);
  let score = 100;
  const flags = [];

  // weak/vague tokens
  for (const w of SLOP_WEAK) {
    const re = new RegExp(`(^|[\\s,])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s,]|$)`, "i");
    if (re.test(t)) { score -= 6; flags.push({ token: w, type: "weak" }); }
  }
  // cliché combos
  for (const [a, b] of SLOP_CLICHE_COMBOS) {
    if (t.includes(a) && t.includes(b)) { score -= 10; flags.push({ token: `${a} + ${b}`, type: "cliche" }); }
  }
  // structural bonuses
  const hasBpm = /\b\d{2,3}\s?bpm\b/i.test(t);
  const hasKey = /\b[a-g](\s?(#|sharp|flat|b))?\s?(major|minor|maj|min)\b/i.test(t) || /maqam|raag/i.test(t);
  const tokenCount = tokens.length;
  if (!hasBpm) { score -= 12; flags.push({ token: "нет BPM", type: "missing" }); }
  if (!hasKey) { score -= 10; flags.push({ token: "нет тональности", type: "missing" }); }
  if (tokenCount < 4) { score -= 10; flags.push({ token: `мало токенов (${tokenCount})`, type: "structure" }); }
  if (tokenCount > 14) { score -= 8; flags.push({ token: `перегруз (${tokenCount} токенов)`, type: "structure" }); }
  if (words.length > 90) { score -= 6; flags.push({ token: "слишком длинный", type: "structure" }); }

  score = Math.max(0, Math.min(100, score));
  return { score, flags, hasBpm, hasKey, tokenCount };
}
(function () {
  const input = $("#slop-input");
  const meter = $("#slop-meter");
  const scoreEl = $("#slop-score");
  const bar = $("#slop-bar");
  const flagsEl = $("#slop-flags");
  const btn = $("#slop-btn");
  const out = $("#slop-out");
  if (!input) return;

  function color(score) {
    if (score >= 75) return "#50fa7b";
    if (score >= 50) return "#ffb86c";
    return "#ff6b6b";
  }
  function update() {
    const text = input.value.trim();
    if (!text) { meter.classList.add("hidden"); btn.disabled = true; return; }
    meter.classList.remove("hidden");
    btn.disabled = false;
    const { score, flags } = scorePrompt(text);
    scoreEl.textContent = score;
    scoreEl.style.color = color(score);
    bar.style.width = score + "%";
    bar.style.background = color(score);
    flagsEl.innerHTML = flags.length
      ? flags.map((f) => `<span class="slop-flag ${f.type}">${escapeHtml(f.token)}</span>`).join("")
      : `<span class="slop-flag ok">✓ ${t("slop.clean")}</span>`;
  }
  input.addEventListener("input", update);

  btn.addEventListener("click", async () => {
    const prompt = input.value.trim();
    if (!prompt) return;
    const { flags } = scorePrompt(prompt);
    out.innerHTML = `<div class="spinner">${t("slop.loading")}</div>`;
    btn.disabled = true;
    try {
      const data = await aiCall("/api/ai/anti-slop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, flagged: flags.map((f) => f.token) })
      });
      if (!data.ok) throw new Error(data.error);
      const newScore = scorePrompt(data.rewritten).score;
      out.innerHTML = `
        <div class="ai-result">
          <div class="ai-prompt-box">
            <div class="prompt-label">${t("slop.result.label")} <span class="ok">· ${newScore}/100</span></div>
            <div class="prompt">${escapeHtml(data.rewritten)}</div>
            <button class="copy" data-prompt="${escapeAttr(data.rewritten)}">${t("copy")}</button>
          </div>
          ${data.changes.length ? `<div class="slop-changes">
            <div class="prompt-label">${t("slop.changes.label")}</div>
            ${data.changes.map((c) => `<div class="slop-change"><s>${escapeHtml(c.from)}</s> → <b>${escapeHtml(c.to)}</b><span class="why">${escapeHtml(c.why || "")}</span></div>`).join("")}
          </div>` : ""}
        </div>`;
      wireCopyButtons(out);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });
})();

/* ---------- AI Lab — Voice Memo ---------- */
(function () {
  const recordBtn = $("#voice-record-btn");
  const sendBtn = $("#voice-send-btn");
  const redoBtn = $("#voice-redo-btn");
  const timerEl = $("#voice-timer");
  const secEl = $("#voice-sec");
  const waveEl = $("#voice-wave");
  const playbackEl = $("#voice-playback");
  const audioEl = $("#voice-audio");
  const out = $("#voice-out");
  if (!recordBtn) return;

  let mediaRecorder = null;
  let chunks = [];
  let timerInterval = null;
  let seconds = 0;
  let recordedBlob = null;

  function startTimer() {
    seconds = 0; secEl.textContent = 0;
    timerInterval = setInterval(() => { secEl.textContent = ++seconds; }, 1000);
  }
  function stopTimer() { clearInterval(timerInterval); }

  function resetUI() {
    playbackEl.classList.add("hidden");
    timerEl.classList.add("hidden");
    waveEl.classList.add("hidden");
    out.innerHTML = "";
    recordedBlob = null;
    recordBtn.textContent = t("voice.record.start");
    recordBtn.classList.remove("recording");
    sendBtn.disabled = false;
  }

  recordBtn.addEventListener("click", async () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : "audio/ogg";
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
        waveEl.classList.add("hidden");
        timerEl.classList.add("hidden");
        recordedBlob = new Blob(chunks, { type: mimeType });
        audioEl.src = URL.createObjectURL(recordedBlob);
        playbackEl.classList.remove("hidden");
        recordBtn.textContent = t("voice.record.start");
        recordBtn.classList.remove("recording");
      };
      mediaRecorder.start(100);
      recordBtn.textContent = t("voice.record.stop");
      recordBtn.classList.add("recording");
      timerEl.classList.remove("hidden");
      waveEl.classList.remove("hidden");
      startTimer();
    } catch (err) {
      out.innerHTML = `<div class="error">${t("voice.mic.error")}${escapeHtml(err.message)}</div>`;
    }
  });

  redoBtn?.addEventListener("click", resetUI);

  sendBtn?.addEventListener("click", async () => {
    if (!recordedBlob) return;
    out.innerHTML = `<div class="spinner">${t("voice.loading")}</div>`;
    sendBtn.disabled = true;
    try {
      const fd = new FormData();
      fd.append("audio", recordedBlob, "memo.webm");
      const data = await aiCall("/api/ai/voice-memo", { method: "POST", body: fd });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = `
        <div class="ai-result">
          <div class="ai-atmo"><strong>${t("voice.heard")}</strong> ${escapeHtml(data.transcript)}</div>
          <div class="ai-prompt-box">
            <div class="prompt-label">${t("ai.prompt.label")}</div>
            <div class="prompt">${escapeHtml(data.prompt)}</div>
            <button class="copy" data-prompt="${escapeAttr(data.prompt)}">${t("copy")}</button>
            ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(data.prompt)}" data-name="Voice Memo">${t("ai.gen.btn")}</button>` : ""}
          </div>
          <div class="ai-meta">
            ${data.bpm ? `<span class="tag">${data.bpm} BPM</span>` : ""}
            ${data.key ? `<span class="tag">${escapeHtml(data.key)}</span>` : ""}
            ${data.era ? `<span class="tag">${escapeHtml(data.era)}</span>` : ""}
            ${data.vocals ? `<span class="tag">vocal: ${escapeHtml(data.vocals)}</span>` : ""}
            ${(data.mood || []).map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`).join("")}
            ${(data.instruments || []).map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`).join("")}
          </div>
        </div>`;
      wireCopyButtons(out);
      out.querySelectorAll(".gen-track-btn").forEach((b) => b.addEventListener("click", () => openGenModal(b.dataset.prompt, b.dataset.name)));
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { sendBtn.disabled = false; }
  });
})();

/* ---------- AI Lab ---------- */
function unlockHeader() {
  const tok = localStorage.getItem(UNLOCK_KEY);
  return tok ? { "X-Unlock-Token": tok } : {};
}
function renderQuota(headers) {
  const pill = $("#ailab-quota");
  if (!pill) return;
  if (headers.get("X-RateLimit-Unlocked") === "1") {
    pill.textContent = t("quota.unlocked");
    pill.className = "quota-pill unlocked";
    return;
  }
  const remaining = headers.get("X-RateLimit-Remaining");
  const limit = headers.get("X-RateLimit-Limit");
  if (remaining != null && limit != null) {
    pill.textContent = t("quota.remaining").replace("{n}", remaining).replace("{limit}", limit);
    pill.className = "quota-pill";
  }
}
async function aiCall(url, opts = {}) {
  const headers = { ...(opts.headers || {}), ...unlockHeader() };
  const res = await fetch(url, { ...opts, headers });
  renderQuota(res.headers);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.unlock) {
      throw new Error(`${data.message || data.error}\n${t("quota.unlock.cta")}`);
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// --- Mood from Image ---
const imgDz = $("#img-dropzone");
const imgFile = $("#img-file");
const imgBtn = $("#img-btn");
const imgPreview = $("#img-preview");
if (imgDz) {
  imgDz.addEventListener("click", () => imgFile.click());
  imgDz.addEventListener("dragover", (e) => { e.preventDefault(); imgDz.classList.add("drag"); });
  imgDz.addEventListener("dragleave", () => imgDz.classList.remove("drag"));
  imgDz.addEventListener("drop", (e) => {
    e.preventDefault(); imgDz.classList.remove("drag");
    if (e.dataTransfer.files[0]) { imgFile.files = e.dataTransfer.files; imgFile.dispatchEvent(new Event("change")); }
  });
  imgFile.addEventListener("change", () => {
    const f = imgFile.files[0]; if (!f) return;
    $("#img-filename").textContent = f.name;
    imgBtn.disabled = false;
    const reader = new FileReader();
    reader.onload = (e) => { imgPreview.src = e.target.result; imgPreview.classList.remove("hidden"); };
    reader.readAsDataURL(f);
  });
  imgBtn.addEventListener("click", async () => {
    const f = imgFile.files[0]; if (!f) return;
    const out = $("#img-out");
    out.innerHTML = `<div class="spinner">${t("mood.loading")}</div>`;
    imgBtn.disabled = true;
    try {
      const fd = new FormData(); fd.append("image", f);
      const data = await aiCall("/api/ai/mood-from-image", { method: "POST", body: fd });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderMoodResult(data);
      wireCopyButtons(out);
      out.querySelectorAll(".gen-track-btn").forEach((b) => b.addEventListener("click", () => openGenModal(b.dataset.prompt, b.dataset.name)));
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { imgBtn.disabled = false; }
  });
}
function renderMoodResult(d) {
  return `
    <div class="ai-result">
      <div class="ai-atmo"><strong>${t("mood.atmo")}:</strong> ${escapeHtml(d.atmosphere)}</div>
      <div class="ai-prompt-box">
        <div class="prompt-label">${t("ai.prompt.label")}</div>
        <div class="prompt">${escapeHtml(d.prompt)}</div>
        <button class="copy" data-prompt="${escapeAttr(d.prompt)}">${t("copy")}</button>
        ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(d.prompt)}" data-name="Mood from Image">${t("ai.gen.btn")}</button>` : ""}
      </div>
      <div class="ai-meta">
        ${d.bpm ? `<span class="tag">${d.bpm} BPM</span>` : ""}
        ${d.key ? `<span class="tag">${escapeHtml(d.key)}</span>` : ""}
        ${d.vocal ? `<span class="tag">vocal: ${escapeHtml(d.vocal)}</span>` : ""}
        ${(d.mood || []).map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`).join("")}
        ${(d.instruments || []).map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`).join("")}
      </div>
    </div>`;
}

// --- Scene → Score ---
const sceneBtn = $("#scene-btn");
if (sceneBtn) {
  sceneBtn.addEventListener("click", async () => {
    const scene = $("#scene-input").value.trim();
    const out = $("#scene-out");
    if (!scene) { out.innerHTML = `<div class="error">${t("scene.empty")}</div>`; return; }
    const lang = $("#scene-lang").checked ? "ru" : "en";
    out.innerHTML = `<div class="spinner">${t("scene.loading")}</div>`;
    sceneBtn.disabled = true;
    try {
      const data = await aiCall("/api/ai/scene-to-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene, lang })
      });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderSceneResult(data);
      wireCopyButtons(out);
      out.querySelectorAll(".gen-track-btn").forEach((b) => b.addEventListener("click", () => openGenModal(b.dataset.prompt, b.dataset.name)));
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { sceneBtn.disabled = false; }
  });
}
function renderSceneResult(d) {
  return `
    <div class="ai-result">
      <div class="ai-prompt-box">
        <div class="prompt-label">${t("scene.style.label")}</div>
        <div class="prompt">${escapeHtml(d.prompt)}</div>
        <button class="copy" data-prompt="${escapeAttr(d.prompt)}">${t("copy")}</button>
        ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(d.prompt)}" data-name="Cinematic Score">${t("ai.gen.btn")}</button>` : ""}
      </div>
      <div class="ai-prompt-box">
        <div class="prompt-label">${t("scene.struct.label")}</div>
        <pre class="prompt struct">${escapeHtml(d.structure)}</pre>
        <button class="copy" data-prompt="${escapeAttr(d.structure)}">${t("copy")}</button>
      </div>
      <div class="ai-meta">
        ${d.bpm ? `<span class="tag">${d.bpm} BPM</span>` : ""}
        ${d.key ? `<span class="tag">${escapeHtml(d.key)}</span>` : ""}
        ${(d.mood || []).map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`).join("")}
        ${(d.instruments || []).map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`).join("")}
      </div>
    </div>`;
}

// --- RU → EN Mirror ---
const transBtn = $("#trans-btn");
if (transBtn) {
  transBtn.addEventListener("click", async () => {
    const text = $("#trans-input").value.trim();
    const out = $("#trans-out");
    if (!text) { out.innerHTML = `<div class="error">${t("mirror.empty")}</div>`; return; }
    out.innerHTML = `<div class="spinner">${t("mirror.loading")}</div>`;
    transBtn.disabled = true;
    try {
      const data = await aiCall("/api/ai/translate-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = `
        <div class="ai-result">
          <div class="ai-prompt-box">
            <div class="prompt-label">${t("mirror.label")} ${data.syllablesMatched ? `<span class='ok'>${t("mirror.syllab")}</span>` : ""}</div>
            <pre class="prompt struct">${escapeHtml(data.english)}</pre>
            <button class="copy" data-prompt="${escapeAttr(data.english)}">${t("copy")}</button>
          </div>
          ${data.rhymeNotes ? `<div class="ai-atmo"><strong>${t("mirror.rhyme")}:</strong> ${escapeHtml(data.rhymeNotes)}</div>` : ""}
        </div>`;
      wireCopyButtons(out);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { transBtn.disabled = false; }
  });
}

/* ---------- AI Lab — Style Genome ---------- */
(function () {
  const container = document.getElementById("genome-artists");
  const addBtn = document.getElementById("genome-add");
  const totalEl = document.getElementById("genome-total");
  const btn = document.getElementById("genome-btn");
  const out = document.getElementById("genome-out");
  if (!btn) return;

  function updateTotal() {
    const weights = [...container.querySelectorAll(".genome-weight")].map((i) => Number(i.value) || 0);
    const sum = weights.reduce((a, b) => a + b, 0);
    totalEl.textContent = sum + "%";
    totalEl.className = "genome-total" + (sum === 100 ? " ok" : sum > 100 ? " over" : "");
  }

  container.addEventListener("input", updateTotal);

  addBtn.addEventListener("click", () => {
    if (container.querySelectorAll(".genome-row").length >= 3) return;
    const row = document.createElement("div");
    row.className = "genome-row";
    row.dataset.idx = "2";
    row.innerHTML = `
      <input class="genome-name" type="text" placeholder="${escapeHtml(t("genome.a3.ph"))}" />
      <input class="genome-weight" type="number" min="1" max="99" value="10" />
      <span class="genome-pct">%</span>
      <button class="genome-remove ghost small">✕</button>`;
    row.querySelector(".genome-remove").addEventListener("click", () => {
      row.remove();
      addBtn.classList.remove("hidden");
      updateTotal();
    });
    container.appendChild(row);
    addBtn.classList.add("hidden");
    updateTotal();
  });

  btn.addEventListener("click", async () => {
    const rows = [...container.querySelectorAll(".genome-row")];
    const artists = rows.map((r) => ({
      name: r.querySelector(".genome-name").value.trim(),
      weight: Number(r.querySelector(".genome-weight").value) || 0
    })).filter((a) => a.name && a.weight > 0);

    if (artists.length < 2) { out.innerHTML = `<div class="error">Введи хотя бы 2 артиста с именем и весом</div>`; return; }

    out.innerHTML = `<div class="spinner">Скрещиваем ДНК: ${artists.map((a) => a.name).join(" × ")}…</div>`;
    btn.disabled = true;
    try {
      const data = await aiCall("/api/ai/style-genome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artists })
      });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderGenome(data, artists);
      wireCopyButtons(out);
      out.querySelectorAll(".gen-track-btn").forEach((b) =>
        b.addEventListener("click", () => openGenModal(b.dataset.prompt, b.dataset.name)));
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });

  function renderGenome(d, artists) {
    const title = artists.map((a) => a.name).join(" × ");
    return `<div class="ai-result">
      <div class="tm-headline">${escapeHtml(title)}</div>
      <div class="ai-atmo"><strong>${t("ai.concept")}:</strong> ${escapeHtml(d.concept)}</div>
      <div class="ai-prompt-box">
        <div class="prompt-label">${t("ai.prompt.label")}</div>
        <div class="prompt">${escapeHtml(d.prompt)}</div>
        <div class="card-actions">
          <button class="copy" data-prompt="${escapeAttr(d.prompt)}">${t("copy")}</button>
          ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(d.prompt)}" data-name="${escapeAttr(title)}">${t("card.gen.btn")}</button>` : ""}
        </div>
      </div>
      ${d.dnaBreakdown.length ? `
      <div class="prompt-label" style="margin-top:12px">${t("dna.breakdown")}</div>
      ${d.dnaBreakdown.map((b) => `
        <div class="genome-dna-row">
          <span class="genome-dna-name">${escapeHtml(b.artist)}</span>
          <span class="genome-dna-bar" style="width:${b.weight}%"></span>
          <span class="genome-dna-pct">${b.weight}%</span>
          <span class="genome-dna-contrib muted">${escapeHtml(b.contribution)}</span>
        </div>`).join("")}` : ""}
      <div class="ai-meta">
        ${d.bpm ? `<span class="tag">${d.bpm} BPM</span>` : ""}
        ${d.key ? `<span class="tag">${escapeHtml(d.key)}</span>` : ""}
        ${d.genre ? `<span class="tag">${escapeHtml(d.genre)}</span>` : ""}
        ${d.mood.map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`).join("")}
        ${d.instruments.map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`).join("")}
        ${d.vocals ? `<span class="tag">${escapeHtml(d.vocals)}</span>` : ""}
      </div>
    </div>`;
  }
})();

/* ---------- Constructor ---------- */
(function () {
  const panel = document.getElementById("tab-constructor");
  if (!panel) return;

  // ── Data ──────────────────────────────────────────────────────────────
  const CHIPS = {
    era: ["—", "Baroque", "Classical era", "Romantic", "Late Romantic", "Impressionist",
      "1930–50s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s", "Futuristic"],
    mood: ["euphoric", "melancholic", "dreamy", "dark", "anthemic", "intimate", "restless", "peaceful",
      "triumphant", "nostalgic", "hypnotic", "raw", "eerie", "playful", "aggressive", "seductive",
      "introspective", "cinematic", "cathartic", "ethereal", "bittersweet", "urgent", "wistful",
      "haunting", "joyful", "tense", "majestic", "tragic", "sublime", "pastoral", "heroic"],
    vocalGender: ["—", "female", "male", "androgynous", "instrumental"],
    vocalTimbre: [
      // Pop/Rock
      "breathy", "raspy", "silky", "warm", "dark", "gritty", "bright", "ethereal",
      "gravelly", "sultry", "powerful", "nasal", "metallic", "crystalline", "husky", "velvety", "hollow",
      // Classical voice types
      "lyric soprano", "coloratura soprano", "dramatic soprano", "spinto soprano",
      "mezzo-soprano", "contralto", "countertenor",
      "lyric tenor", "dramatic tenor", "heldentenor",
      "lyric baritone", "dramatic baritone", "bass-baritone", "basso profondo"
    ],
    vocalDelivery: [
      "—",
      // Pop/Rock/Urban
      "intimate", "belted", "whispered", "spoken word", "soaring", "conversational",
      "commanding", "falsetto", "melodic rap", "aggressive rap", "crooned", "chanted", "lyrical", "deadpan",
      // Classical
      "bel canto", "coloratura", "operatic vibrato", "recitative", "aria style",
      "cantabile", "melismatic", "parlando", "sprechgesang", "declamatory"
    ],
    vocalFx: ["dry close-mic", "reverb-drenched", "auto-tuned", "heavily processed", "tape-saturated",
      "doubled & layered", "lo-fi compressed", "wide stereo", "vocoded", "bit-crushed",
      "reverb hall", "cathedral reverb", "warm tube mic"],
    production: ["lo-fi", "polished mix", "bedroom pop", "studio quality", "raw live", "layered",
      "sparse", "cinematic", "gated reverb snare", "sidechain pump", "tape saturation", "plate reverb",
      "lo-fi 4-track", "heavy fuzz", "slapback delay", "pitch-shifted", "glitched", "punchy mix",
      "warm mastering", "broadcast-quality", "4-on-the-floor", "half-time drums",
      "orchestral recording", "live concert hall", "period recording", "HDCD remaster"],
    keyNote: ["—", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
    keyMode: ["major", "minor", "dorian", "phrygian", "lydian", "mixolydian",
      "harmonic minor", "melodic minor", "whole tone", "pentatonic", "chromatic"],
    carattere: [
      "maestoso", "con brio", "dolce", "espressivo", "agitato", "con fuoco",
      "semplice", "grazioso", "tranquillo", "furioso", "misterioso", "scherzando",
      "appassionato", "marcato", "leggiero", "pesante", "cantabile", "giocoso"
    ],
    useCase: ["—", "full song", "short-form video", "study/focus", "workout", "podcast intro",
      "club night", "romantic", "trailer", "lo-fi chill", "meditation", "background",
      "cinematic score", "game OST", "wedding ceremony", "film overture"]
  };

  const INST_CATS = {
    "🎸 Guitar/Bass": ["acoustic guitar", "electric guitar", "jangly guitar", "fingerpicked guitar",
      "slide guitar", "12-string guitar", "nylon-string guitar", "lap steel guitar",
      "bass guitar", "slap bass", "fretless bass", "walking bass", "double bass"],
    "🎹 Keys/Piano": ["grand piano", "upright piano", "Rhodes electric piano", "Wurlitzer EP-200",
      "Hammond organ", "harpsichord", "celesta", "clavinet", "toy piano", "tack piano",
      "fortepiano", "clavichord", "pipe organ", "prepared piano"],
    "🎛 Synths": ["Minimoog", "Roland Juno-60", "Roland Jupiter-8", "Oberheim OB-Xa", "Prophet-5",
      "Korg M1", "ARP string machine", "modular synth", "analog pads", "FM bass",
      "supersaw chords", "arpeggiator", "lo-fi synth", "TB-303 acid", "Yamaha DX7"],
    "🎺 Brass/Wind": ["saxophone", "alto saxophone", "tenor saxophone", "baritone saxophone", "trumpet",
      "French horn", "trombone", "flugelhorn", "flute", "clarinet", "oboe", "bassoon",
      "brass section", "horn section", "woodwind ensemble", "bagpipes",
      "piccolo", "cor anglais", "bass clarinet", "contrabassoon",
      "bass trombone", "tuba", "natural trumpet", "baroque oboe", "recorder"],
    "🥁 Drums/Perc": ["acoustic drums", "live drums", "TR-808", "TR-909", "LinnDrum LM-1", "Akai MPC60",
      "trap drums", "boom-bap drums", "breakbeat", "programmed drums", "tambourine", "shaker",
      "bongos", "taiko drums", "tabla", "congas", "handpan", "dembow rhythm", "brushed drums",
      "timpani", "orchestral snare", "snare drum", "bass drum", "cymbals", "triangle",
      "tam-tam", "tubular bells", "glockenspiel", "xylophone", "vibraphone",
      "marimba", "bass marimba", "crotales", "castanets", "wind chimes", "ratchet"],
    "🎻 Strings": ["violin", "cello", "viola", "orchestral strings", "string quartet",
      "symphonic strings", "pizzicato strings", "harp", "mellotron strings", "string ensemble",
      "violin I section", "violin II section", "viola section", "cello section",
      "col legno", "sul ponticello", "harmonics", "viola da gamba", "theorbo", "baroque violin"],
    "🎼 Orchestra": [
      // Full ensembles
      "full symphony orchestra", "chamber orchestra", "baroque ensemble", "string orchestra",
      "brass band", "wind orchestra", "piano trio", "string quartet", "woodwind quintet",
      "brass quintet", "piano quintet", "string sextet",
      // Orchestral colors
      "basso continuo", "obbligato violin", "concertino group", "tutti strings",
      "horn call", "fanfare brass", "woodwind soli", "tremolo strings",
      "col legno bowing", "flutter-tongue flute", "stopped horn", "muted brass",
      "pizzicato bass", "arco cello", "divisi strings", "unison strings"
    ],
    "🎭 Choir/Voice": [
      // Choral ensembles
      "SATB choir", "full chorus", "chamber choir", "boys choir", "women's choir",
      "men's choir", "a cappella", "vocal ensemble", "madrigal ensemble", "vocal quartet",
      // Choral textures
      "close harmony", "barbershop harmony", "unison singing", "choral swells",
      "Gregorian chant", "plainchant", "polyphony", "counterpoint vocals",
      // Operatic
      "soprano soloist", "mezzo-soprano soloist", "tenor soloist", "baritone soloist",
      "bass soloist", "operatic ensemble", "soprano aria", "tenor aria",
      // Choral production
      "cathedral acoustics", "choral reverb", "double chorus", "antiphonal choir"
    ],
    "🌍 World": ["banjo", "mandolin", "ukulele", "sitar", "koto", "erhu", "mbira", "oud",
      "balalaika", "hurdy-gurdy", "duduk", "steel drum", "marimba", "accordion",
      "pedal steel", "dulcimer", "jaw harp", "shamisen", "pipa", "guzheng",
      "didgeridoo", "panpipes", "kalimba", "hang drum", "berimbau"],
    "🌫 Textures": ["vinyl crackle", "tape hiss", "field recordings", "ambient noise", "vinyl samples",
      "church bells", "static", "crowd noise", "rain sounds", "granular texture",
      "sub-bass drone", "noise floor", "concert hall ambience", "audience applause"]
  };

  // ── State ──────────────────────────────────────────────────────────────
  const state = {
    era: null, genre: "",
    mood: new Set(), vocalGender: null,
    vocalTimbre: new Set(), vocalDelivery: null,
    vocalFx: new Set(), instruments: new Set(),
    production: new Set(), bpm: 0,
    keyNote: null, keyMode: "major",
    carattere: new Set(), useCase: null, theme: ""
  };

  let activeInstCat = Object.keys(INST_CATS)[0];
  let refMode = "none";
  let refBlob = null;
  let micRecorder = null, micChunks = [], micTimerIv = null;

  // ── Chip logic ─────────────────────────────────────────────────────────
  function isActive(key, chip) {
    if (chip === "—") return false;
    return state[key] instanceof Set ? state[key].has(chip) : state[key] === chip;
  }

  function toggleChip(key, chip, multiMax) {
    if (chip === "—") {
      if (state[key] instanceof Set) state[key].clear(); else state[key] = null;
      return;
    }
    if (state[key] instanceof Set) {
      if (state[key].has(chip)) { state[key].delete(chip); return; }
      if (multiMax > 0 && state[key].size >= multiMax) {
        state[key].delete([...state[key]][0]);
      }
      state[key].add(chip);
    } else {
      state[key] = state[key] === chip ? null : chip;
    }
  }

  function renderChipRow(container, key, chips, multiMax) {
    container.innerHTML = "";
    chips.forEach(chip => {
      const b = document.createElement("button");
      b.className = "ctor-chip" + (isActive(key, chip) ? " active" : "");
      b.textContent = chip;
      b.addEventListener("click", () => { toggleChip(key, chip, multiMax); refreshChips(); updatePreview(); });
      container.appendChild(b);
    });
  }

  function renderInstChips() {
    const c = document.getElementById("ctor-inst-chips"); if (!c) return;
    const chips = INST_CATS[activeInstCat] || [];
    c.innerHTML = "";
    chips.forEach(chip => {
      const b = document.createElement("button");
      b.className = "ctor-chip" + (state.instruments.has(chip) ? " active" : "");
      b.textContent = chip;
      b.addEventListener("click", () => {
        state.instruments.has(chip) ? state.instruments.delete(chip) : state.instruments.add(chip);
        renderInstChips();
        renderInstTabs();
        const cnt = state.instruments.size;
        const el = document.getElementById("ctor-inst-count");
        if (el) el.textContent = cnt > 0 ? cnt + t("ctor.sel") : "";
        updatePreview();
      });
      c.appendChild(b);
    });
  }

  function renderInstTabs() {
    const bar = document.getElementById("ctor-inst-tabs"); if (!bar) return;
    bar.innerHTML = "";
    Object.keys(INST_CATS).forEach(cat => {
      const selCount = INST_CATS[cat].filter(i => state.instruments.has(i)).length;
      const b = document.createElement("button");
      b.className = "ctor-itab" + (cat === activeInstCat ? " active" : "");
      if (selCount > 0) {
        b.innerHTML = escapeHtml(cat) + ` <span class="ctor-itab-cnt">${selCount}</span>`;
      } else {
        b.textContent = cat;
      }
      b.addEventListener("click", () => {
        activeInstCat = cat;
        bar.querySelectorAll(".ctor-itab").forEach(t => t.classList.remove("active"));
        b.classList.add("active");
        renderInstChips();
      });
      bar.appendChild(b);
    });
  }

  function refreshChips() {
    panel.querySelectorAll(".ctor-chips[data-key]").forEach(row => {
      const key = row.dataset.key, multi = parseInt(row.dataset.multi, 10);
      if (CHIPS[key]) renderChipRow(row, key, CHIPS[key], multi);
    });
    renderInstChips();
    const el = document.getElementById("ctor-inst-count");
    if (el) el.textContent = state.instruments.size > 0 ? state.instruments.size + t("ctor.sel") : "";
  }

  // ── Prompt builder ─────────────────────────────────────────────────────
  const CLASSICAL_ERAS = new Set(["Baroque", "Classical era", "Romantic", "Late Romantic", "Impressionist"]);
  const CLASSICAL_DELIVERY = new Set(["bel canto", "coloratura", "operatic vibrato", "recitative",
    "aria style", "cantabile", "melismatic", "parlando", "sprechgesang", "declamatory"]);

  function buildPrompt() {
    const parts = [];
    const isInstr = state.vocalGender === "instrumental";
    if (!isInstr) {
      const vp = [];
      if (state.vocalGender && state.vocalGender !== "—") vp.push(state.vocalGender + " vocals");
      if (state.vocalTimbre.size) vp.push([...state.vocalTimbre].join(" "));
      if (state.vocalDelivery && state.vocalDelivery !== "—") {
        // classical terms need no " delivery" suffix — "bel canto delivery" is wrong
        vp.push(CLASSICAL_DELIVERY.has(state.vocalDelivery)
          ? state.vocalDelivery
          : state.vocalDelivery + " delivery");
      }
      if (state.vocalFx.size) vp.push([...state.vocalFx].join(", "));
      if (vp.length) parts.push(vp.join(", "));
    }
    if (state.genre) parts.push(state.genre);
    // classical eras don't need " production" suffix — "Baroque" works on its own
    if (state.era && state.era !== "—") {
      parts.push(CLASSICAL_ERAS.has(state.era) ? state.era : state.era + " production");
    }
    if (state.mood.size) parts.push([...state.mood].join(" and "));
    if (state.instruments.size) parts.push([...state.instruments].join(", "));
    if (state.production.size) parts.push([...state.production].join(", "));
    if (state.carattere.size) parts.push([...state.carattere].join(", "));
    if (state.bpm > 0) parts.push(state.bpm + " BPM");
    if (state.keyNote && state.keyNote !== "—") {
      parts.push(state.keyNote + " " + (state.keyMode || "major"));
    }
    if (isInstr) parts.push("instrumental"); // MUST be last per v5.5 rules
    return parts.join(", ");
  }

  // ── Preview ────────────────────────────────────────────────────────────
  function updatePreview() {
    const prompt = buildPrompt();
    const preview = document.getElementById("ctor-preview");
    if (preview && document.activeElement !== preview) preview.textContent = prompt;

    const words = prompt.trim() ? prompt.trim().split(/[\s,]+/).filter(Boolean).length : 0;
    const chars = prompt.length;

    const wcEl = document.getElementById("ctor-wc");
    if (wcEl) {
      let cls = "ctor-wc", label = words + t("ctor.wc.words");
      if (!words) cls += " muted";
      else if (words < 8) { cls += " warn"; label += t("ctor.wc.few"); }
      else if (words <= 30) { cls += " ok"; label += t("ctor.wc.ok"); }
      else if (words <= 40) { cls += " warn"; label += t("ctor.wc.many"); }
      else { cls += " over"; label += t("ctor.wc.over"); }
      wcEl.className = cls; wcEl.textContent = label;
    }

    const bar = document.getElementById("ctor-bar");
    const charsEl = document.getElementById("ctor-chars");
    if (bar) {
      const pct = Math.min(100, (chars / 1000) * 100);
      bar.style.width = pct + "%";
      bar.className = "ctor-bar" + (pct > 95 ? " danger" : pct > 75 ? " warn" : "");
    }
    if (charsEl) {
      charsEl.textContent = chars + " / 1000";
      charsEl.className = "ctor-chars" + (chars > 950 ? " danger" : chars > 800 ? " warn" : "");
    }

    const quality = document.getElementById("ctor-quality");
    if (quality) {
      const hints = [];
      if (!state.vocalGender && words > 0) hints.push(t("ctor.hint.vocal"));
      if (words > 0 && words < 8) hints.push(t("ctor.hint.short"));
      if (words > 40) hints.push(t("ctor.hint.long"));
      if (chars > 950) hints.push(t("ctor.hint.chars"));
      let slopHtml = "";
      if (words >= 4) {
        const { score, flags } = scorePrompt(prompt);
        const cls = score >= 80 ? "good" : score >= 60 ? "mid" : "bad";
        const tagHtml = flags.slice(0, 5).map(f => {
          const tc = f.type === "cliche" ? "cliche" : f.type === "weak" ? "weak" : "missing";
          return `<span class="ctor-slop-tag ${tc}">${escapeHtml(f.token)}</span>`;
        }).join("");
        slopHtml = `<div class="ctor-slop-row">
          <span class="ctor-slop-badge ${cls}" title="${t("ctor.slop.label")} · 100 = max">${score}</span>
          <span class="ctor-slop-label">${t("ctor.slop.label")}</span>
          ${tagHtml}
        </div>`;
      }
      quality.innerHTML = hints.map(h => `<div class="ctor-hint-line">${h}</div>`).join("") + slopHtml;
    }
  }

  window._ctorUpdate = updatePreview; // expose for applyLang

  // ── BPM ────────────────────────────────────────────────────────────────
  const bpmSlider = document.getElementById("ctor-bpm-slider");
  const bpmDisplay = document.getElementById("ctor-bpm-display");

  function setBpm(val) {
    state.bpm = val;
    if (bpmSlider) bpmSlider.value = val > 0 ? val : 120;
    if (bpmDisplay) bpmDisplay.textContent = val > 0 ? val + " BPM" : t("ctor.bpm.auto");
    document.querySelectorAll(".ctor-preset").forEach(b =>
      b.classList.toggle("active", parseInt(b.dataset.bpm, 10) === val));
    updatePreview();
  }

  bpmSlider?.addEventListener("input", () => setBpm(parseInt(bpmSlider.value, 10)));
  document.querySelectorAll(".ctor-preset").forEach(b =>
    b.addEventListener("click", () => setBpm(parseInt(b.dataset.bpm, 10))));

  // ── Copy & Reset ───────────────────────────────────────────────────────
  document.getElementById("ctor-copy-btn")?.addEventListener("click", () => {
    const preview = document.getElementById("ctor-preview");
    const text = (preview?.textContent || buildPrompt()).trim();
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    const btn = document.getElementById("ctor-copy-btn");
    if (btn) { const orig = btn.textContent; btn.textContent = t("btn.copied"); setTimeout(() => btn.textContent = orig, 1500); }
  });

  document.getElementById("ctor-save-btn")?.addEventListener("click", () => {
    const preview = document.getElementById("ctor-preview");
    const text = (preview?.textContent || buildPrompt()).trim();
    if (!text) return;
    const name = ["Constructor", state.genre, state.era].filter(Boolean).join(" · ");
    const id = "ctor-" + Date.now();
    toggleSave({ id, name, prompt: text, genre: state.genre || "" });
    const btn = document.getElementById("ctor-save-btn");
    const saved = getSaved().some(s => s.prompt === text);
    if (btn) { btn.classList.toggle("on", saved); btn.title = saved ? "Сохранено ✓" : "Сохранить в Saved"; }
  });

  document.getElementById("ctor-reset-btn")?.addEventListener("click", () => {
    Object.assign(state, { era: null, genre: "", mood: new Set(), vocalGender: null,
      vocalTimbre: new Set(), vocalDelivery: null, vocalFx: new Set(), instruments: new Set(),
      production: new Set(), bpm: 0, keyNote: null, keyMode: "major", carattere: new Set(), useCase: null, theme: "" });
    const g = document.getElementById("ctor-genre"); if (g) g.value = "";
    const t = document.getElementById("ctor-theme"); if (t) t.value = "";
    const sb = document.getElementById("ctor-save-btn");
    if (sb) { sb.classList.remove("on"); sb.title = "Сохранить в Saved"; }
    setBpm(0); refreshChips(); renderInstTabs(); updatePreview();
  });

  document.getElementById("ctor-genre")?.addEventListener("change", e => { state.genre = e.target.value; updatePreview(); });
  document.getElementById("ctor-theme")?.addEventListener("input", e => { state.theme = e.target.value.trim(); });

  // ── Reference ──────────────────────────────────────────────────────────
  function setRefMode(mode) {
    refMode = mode;
    document.querySelectorAll(".ctor-ref-tab").forEach(t => t.classList.toggle("active", t.dataset.rmode === mode));
    document.getElementById("ctor-ref-file-zone")?.classList.toggle("hidden", mode !== "file");
    document.getElementById("ctor-ref-mic-zone")?.classList.toggle("hidden", mode !== "mic");
    document.getElementById("ctor-ref-weight-row")?.classList.toggle("hidden", mode === "none");
  }

  document.querySelectorAll(".ctor-ref-tab").forEach(t => t.addEventListener("click", () => setRefMode(t.dataset.rmode)));

  const ctorDz = document.getElementById("ctor-dz");
  const ctorRefFile = document.getElementById("ctor-ref-file");
  ctorDz?.addEventListener("click", () => ctorRefFile?.click());
  ctorDz?.addEventListener("dragover", e => { e.preventDefault(); ctorDz.classList.add("drag"); });
  ctorDz?.addEventListener("dragleave", () => ctorDz.classList.remove("drag"));
  ctorDz?.addEventListener("drop", e => {
    e.preventDefault(); ctorDz.classList.remove("drag");
    if (e.dataTransfer.files[0]) { ctorRefFile.files = e.dataTransfer.files; ctorRefFile.dispatchEvent(new Event("change")); }
  });
  ctorRefFile?.addEventListener("change", () => {
    const f = ctorRefFile.files[0]; if (!f) return;
    refBlob = f;
    const fname = document.getElementById("ctor-ref-fname"); if (fname) fname.textContent = f.name;
    const player = document.getElementById("ctor-ref-audio");
    if (player) { player.src = URL.createObjectURL(f); player.classList.remove("hidden"); }
  });
  document.getElementById("ctor-ref-weight")?.addEventListener("input", e => {
    const el = document.getElementById("ctor-ref-weight-val"); if (el) el.textContent = e.target.value;
  });

  const ctorMicBtn = document.getElementById("ctor-mic-btn");
  ctorMicBtn?.addEventListener("click", async () => {
    if (micRecorder?.state === "recording") { micRecorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micChunks = [];
      micRecorder = new MediaRecorder(stream);
      micRecorder.ondataavailable = e => { if (e.data.size) micChunks.push(e.data); };
      micRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        refBlob = new Blob(micChunks, { type: "audio/webm" });
        const ma = document.getElementById("ctor-mic-audio"); if (ma) ma.src = URL.createObjectURL(refBlob);
        document.getElementById("ctor-mic-ready")?.classList.remove("hidden");
        ctorMicBtn.textContent = t("ctor.mic.record");
        document.getElementById("ctor-mic-timer")?.classList.add("hidden");
        document.getElementById("ctor-mic-wave")?.classList.add("hidden");
        clearInterval(micTimerIv);
      };
      micRecorder.start();
      ctorMicBtn.textContent = t("voice.record.stop");
      document.getElementById("ctor-mic-timer")?.classList.remove("hidden");
      document.getElementById("ctor-mic-wave")?.classList.remove("hidden");
      let secs = 0; const secEl = document.getElementById("ctor-mic-sec");
      micTimerIv = setInterval(() => { secs++; if (secEl) secEl.textContent = secs; if (secs >= 120) micRecorder.stop(); }, 1000);
    } catch(e) {
      const out = document.getElementById("ctor-gen-out");
      if (out) out.innerHTML = `<div class="error">Нет доступа к микрофону: ${escapeHtml(e.message)}</div>`;
    }
  });
  document.getElementById("ctor-mic-redo")?.addEventListener("click", () => {
    refBlob = null;
    document.getElementById("ctor-mic-ready")?.classList.add("hidden");
    if (ctorMicBtn) ctorMicBtn.textContent = "🎙 Запись";
  });

  // ── Generate ───────────────────────────────────────────────────────────
  document.getElementById("ctor-gen-btn")?.addEventListener("click", async () => {
    const preview = document.getElementById("ctor-preview");
    const tags = (preview?.textContent || buildPrompt()).trim();
    const out = document.getElementById("ctor-gen-out");
    const btn = document.getElementById("ctor-gen-btn");
    if (!tags) { out.innerHTML = `<div class="error">Собери промпт — добавь жанр, настроение или инструменты</div>`; return; }
    btn.disabled = true;
    out.innerHTML = `<div class="spinner">Отправляю в Suno…</div>`;
    try {
      let jobId;
      if (refMode !== "none" && refBlob) {
        const fd = new FormData();
        fd.append("audio", refBlob instanceof File ? refBlob : new File([refBlob], "ref.webm", { type: refBlob.type }));
        fd.append("tags", tags);
        fd.append("startSec", "0"); fd.append("endSec", "30");
        fd.append("audioWeight", document.getElementById("ctor-ref-weight")?.value || "0.7");
        fd.append("mv", "chirp-v5-5");
        const data = await aiCall("/api/ai/reference-generate", { method: "POST", body: fd });
        if (!data.ok) throw new Error(data.error);
        jobId = data.jobId;
        out.innerHTML = `<div class="spinner">Референс загружен, генерирую… <span id="ctor-prog">0%</span></div>`;
      } else {
        const data = await aiCall("/api/ai/generate-track", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags, mv: "chirp-v5-5" })
        });
        if (!data.ok) throw new Error(data.error);
        jobId = data.jobId;
        out.innerHTML = `<div class="spinner">Suno генерирует… <span id="ctor-prog">0%</span> <span class="muted">(30–90 сек)</span></div>`;
      }
      let elapsed = 0;
      const iv = setInterval(async () => {
        elapsed += 5;
        try {
          const job = await api(`/api/ai/track-status?jobId=${encodeURIComponent(jobId)}`);
          const p = document.getElementById("ctor-prog"); if (p && job.progress) p.textContent = job.progress;
          if (job.status === "SUCCESS" && job.musics?.length) {
            clearInterval(iv); btn.disabled = false;
            out.innerHTML = `<div class="ai-result">${job.musics.map(m => `
              <div class="track-card">
                ${m.imageUrl ? `<img class="track-art" src="${escapeAttr(m.imageUrl)}" alt="art"/>` : ""}
                <div class="track-info">
                  <div class="track-title">${escapeHtml(m.title || "Generated Track")}</div>
                  <div class="track-tags muted">${escapeHtml(m.tags || "")}${m.duration ? ` · ${Math.round(m.duration)}s` : ""}</div>
                  <audio controls src="${escapeAttr(m.audioUrl)}"></audio>
                  <div class="track-actions"><a href="${escapeAttr(m.audioUrl)}" download>⭳ MP3</a></div>
                </div>
              </div>`).join("")}</div>`;
          } else if (job.status === "FAILED") {
            clearInterval(iv); btn.disabled = false; out.innerHTML = `<div class="error">Ошибка генерации</div>`;
          } else if (elapsed > 300) {
            clearInterval(iv); btn.disabled = false; out.innerHTML = `<div class="error">Таймаут — попробуй ещё раз</div>`;
          }
        } catch(e) { clearInterval(iv); btn.disabled = false; out.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`; }
      }, 5000);
    } catch(err) { out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`; btn.disabled = false; }
  });

  // ── Init ───────────────────────────────────────────────────────────────
  panel.querySelectorAll(".ctor-chips[data-key]").forEach(row => {
    const key = row.dataset.key, multi = parseInt(row.dataset.multi, 10);
    if (CHIPS[key]) renderChipRow(row, key, CHIPS[key], multi);
  });
  renderInstTabs();
  renderInstChips();
  setBpm(0);
  updatePreview();
  api("/api/status").then(s => {
    if (!s.generate) {
      const btn = document.getElementById("ctor-gen-btn");
      if (btn) btn.title = "TTAPI_KEY не настроен на сервере";
    }
  }).catch(() => {});
})();

/* ---------- Theme & Language ---------- */
document.getElementById("theme-toggle")?.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  setTheme(current === "dark" ? "light" : "dark");
});
document.getElementById("lang-toggle")?.addEventListener("click", () => {
  applyLang(currentLang === "ru" ? "en" : "ru");
});

/* ---------- AI Lab — Unlock Row ---------- */
(function () {
  const input = $("#ailab-unlock-input");
  const btn = $("#ailab-unlock-btn");
  const msg = $("#ailab-unlock-msg");
  if (!btn) return;

  async function doUnlock() {
    const code = input.value.trim();
    if (!code) return;
    btn.disabled = true;
    msg.textContent = "…";
    try {
      const data = await api("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      if (data.ok) {
        localStorage.setItem(UNLOCK_KEY, data.token);
        msg.textContent = t("unlock.success");
        msg.style.color = "var(--good)";
        input.value = "";
        renderUnlockPill();
      } else {
        msg.textContent = t("unlock.invalid");
        msg.style.color = "var(--bad)";
      }
    } catch {
      msg.textContent = "Error";
      msg.style.color = "var(--bad)";
    } finally { btn.disabled = false; }
  }

  btn.addEventListener("click", doUnlock);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doUnlock(); });
})();

/* ---------- AI Lab — Playlist Builder ---------- */
(function () {
  const btn = $("#playlist-btn");
  const out = $("#playlist-out");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const style = $("#playlist-style").value.trim();
    const theme = $("#playlist-theme").value.trim();
    const count = Number($("#playlist-count").value) || 8;
    if (!style) { out.innerHTML = `<div class="error">Введи стиль</div>`; return; }
    out.innerHTML = `<div class="spinner">${t("playlist.loading")}</div>`;
    btn.disabled = true;
    try {
      const data = await aiCall("/api/ai/playlist-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, theme, count })
      });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderPlaylist(data);
      wireCopyButtons(out);
      out.querySelectorAll(".gen-track-btn").forEach((b) =>
        b.addEventListener("click", () => openGenModal(b.dataset.prompt, b.dataset.name)));
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });

  function renderPlaylist(d) {
    const allPrompts = (d.tracks || []).map((tr) => `${tr.number}. ${tr.title}\n${tr.prompt}`).join("\n\n");
    return `
      <div class="ai-result">
        <div class="ai-atmo"><strong>${escapeHtml(d.albumTitle || "")}</strong>${d.concept ? ` — ${escapeHtml(d.concept)}` : ""}</div>
        <div class="playlist-tracks">
          ${(d.tracks || []).map((tr) => `
            <div class="playlist-track">
              <div class="pl-num">${tr.number}</div>
              <div class="pl-body">
                <div class="pl-title">${escapeHtml(tr.title)}</div>
                <div class="pl-meta muted">
                  ${tr.mood ? `<span class="tag mood">${escapeHtml(tr.mood)}</span>` : ""}
                  ${tr.bpm ? `<span class="tag">${tr.bpm} BPM</span>` : ""}
                  ${tr.key ? `<span class="tag">${escapeHtml(tr.key)}</span>` : ""}
                  ${tr.role ? `<span class="tag">${escapeHtml(tr.role)}</span>` : ""}
                </div>
                <div class="pl-prompt muted">${escapeHtml(tr.prompt)}</div>
              </div>
              <div class="pl-actions">
                <button class="copy" data-prompt="${escapeAttr(tr.prompt)}">${t("copy")}</button>
                ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(tr.prompt)}" data-name="${escapeAttr(tr.title)}">${t("ai.gen.btn")}</button>` : ""}
              </div>
            </div>`).join("")}
        </div>
        <button class="copy" data-prompt="${escapeAttr(allPrompts)}" style="margin-top:14px">${t("playlist.copy.all")}</button>
      </div>`;
  }
})();

/* ---------- AI Lab — Mastering (Auphonic) ---------- */
let canMaster = false;
api("/api/status").then(s => {
  canMaster = !!s.master;
  const dis = $("#master-disabled");
  const btn = $("#master-btn");
  if (dis && !canMaster) { dis.classList.remove("hidden"); if (btn) btn.disabled = true; }
}).catch(() => {});

(function () {
  const btn = $("#master-btn");
  const out = $("#master-out");
  if (!btn) return;

  btn.addEventListener("click", () => startMastering($("#master-url").value.trim(), $("#master-loudness").value, out, btn));
})();

function startMastering(audioUrl, loudness, out, btn) {
  if (!audioUrl) { out.innerHTML = `<div class="error">Вставь URL MP3</div>`; return; }
  out.innerHTML = `<div class="spinner">${t("master.loading")}</div>`;
  if (btn) btn.disabled = true;

  aiCall("/api/ai/master-track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioUrl, loudness })
  }).then(data => {
    if (!data.ok) throw new Error(data.error);
    pollMasterJob(data.jobId, out, btn);
  }).catch(err => {
    out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    if (btn) btn.disabled = false;
  });
}

function pollMasterJob(jobId, out, btn) {
  let elapsed = 0;
  const iv = setInterval(async () => {
    elapsed += 4;
    try {
      const job = await api(`/api/ai/master-status?jobId=${encodeURIComponent(jobId)}`);
      const prog = job.progress ?? 0;
      if (job.status === "Success" && job.downloadUrl) {
        clearInterval(iv);
        if (btn) btn.disabled = false;
        out.innerHTML = `
          <div class="ai-result master-result">
            <div class="master-done">${t("master.done")}</div>
            <audio controls src="${escapeAttr(job.downloadUrl)}" style="width:100%;margin:10px 0"></audio>
            <a class="primary small" href="${escapeAttr(job.downloadUrl)}" download="mastered.mp3">${t("master.download")}</a>
          </div>`;
      } else if (job.status !== "Pending" && job.status !== "Running") {
        clearInterval(iv);
        if (btn) btn.disabled = false;
        out.innerHTML = `<div class="error">${t("master.fail")}: ${escapeHtml(job.status || "")}</div>`;
      } else {
        out.innerHTML = `<div class="spinner">${t("master.progress").replace("{p}", prog)}</div>`;
      }
      if (elapsed > 300) { clearInterval(iv); if (btn) btn.disabled = false; out.innerHTML = `<div class="error">${t("gen.modal.timeout")}</div>`; }
    } catch (err) {
      clearInterval(iv);
      if (btn) btn.disabled = false;
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    }
  }, 4000);
}

// Expose for inline "Master this track" buttons in track results
window._startMastering = (audioUrl) => {
  const card = $("#master-card");
  const urlInput = $("#master-url");
  if (urlInput) urlInput.value = audioUrl;
  if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  const out = $("#master-out");
  const btn = $("#master-btn");
  if (out && btn) startMastering(audioUrl, $("#master-loudness")?.value || "streaming", out, btn);
};

/* ---------- Init (after all declarations) ---------- */
setTheme(localStorage.getItem("ss_theme") || "dark");
applyLang(currentLang);
if (localStorage.getItem(GATE_KEY)) showApp();

/* ─── Pricing Modal ──────────────────────────────────────────────────── */
;(function pricingModule() {
  const modal   = document.getElementById("pricing-modal");
  const openBtn = document.getElementById("pricing-btn");
  const closeBtn= document.getElementById("pricing-close");
  const activatePanel = document.getElementById("pricing-activate");
  const showActivate  = document.getElementById("show-activate");
  const activateEmail = document.getElementById("activate-email");
  const activateBtn   = document.getElementById("activate-btn");
  const activateMsg   = document.getElementById("activate-msg");

  function open() { modal.style.display = "flex"; }
  function close(){ modal.style.display = "none"; }

  openBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  modal?.addEventListener("click", e => { if (e.target === modal) close(); });

  // If redirected back after payment
  if (location.search.includes("activated=1")) {
    history.replaceState(null, "", location.pathname);
    open();
    activatePanel.style.display = "block";
    showActivate.style.display  = "none";
    activateMsg.textContent = "Payment received! Enter your email to activate your subscription.";
  }

  showActivate?.addEventListener("click", () => {
    activatePanel.style.display = "block";
    showActivate.style.display  = "none";
  });

  // Subscribe buttons
  document.querySelectorAll(".plan-btn[data-plan]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const plan = btn.dataset.plan;
      btn.disabled = true;
      btn.textContent = "Loading…";
      try {
        const r = await fetch("/api/lemon/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan })
        });
        const data = await r.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          alert(data.error || "Could not start checkout");
          btn.disabled = false;
          btn.textContent = plan === "pro" ? "Subscribe Pro" : "Subscribe Creator";
        }
      } catch {
        btn.disabled = false;
        btn.textContent = plan === "pro" ? "Subscribe Pro" : "Subscribe Creator";
      }
    });
  });

  // Activate by email
  activateBtn?.addEventListener("click", async () => {
    const email = activateEmail.value.trim();
    if (!email) return;
    activateBtn.disabled = true;
    activateMsg.textContent = "Checking…";
    try {
      const r = await fetch("/api/lemon/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await r.json();
      if (data.ok && data.token) {
        localStorage.setItem(UNLOCK_KEY, data.token);
        activateMsg.textContent = `✓ ${data.plan === "pro" ? "Pro" : "Creator"} plan activated!`;
        activateMsg.style.color = "#22c55e";
        setTimeout(() => { close(); location.reload(); }, 1500);
      } else {
        activateMsg.textContent = data.error || "Subscription not found for this email";
        activateMsg.style.color = "#ef4444";
        activateBtn.disabled = false;
      }
    } catch {
      activateMsg.textContent = "Network error, try again";
      activateMsg.style.color = "#ef4444";
      activateBtn.disabled = false;
    }
  });
})();
