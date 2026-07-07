# Технический аудит SiliconSense (перед продакшеном)

Дата: 2026-07-07 · Аудитор: Claude Code (комплексный review: код, безопасность, производительность, DevOps)

```text
Общий уровень качества: 6/10
Готовность к продакшену: частично (демо/софт-launch — да; приём денег — нет, пока не закрыты Critical)
Главные риски:
  1. Проверка подписи LemonSqueezy-вебхука не работает вообще (тело уже съедено express.json)
  2. TOKEN_SECRET имеет дефолт в публичном репо → любой может подделать pro-токен
  3. Дефолтные UNLOCK/ACCESS-коды захардкожены в открытом коде → бесплатный доступ к платному каталогу
  4. Половина AI-эндпоинтов без rate limit → выжигание бюджета OpenAI/Anthropic ботами
  5. Rate limit обходится подделкой X-Forwarded-For
  6. SSRF в /api/ai/master-track (169.254.169.254, редиректы, DNS rebinding не закрыты)
  7. Всё состояние в памяти (квоты, джобы, буферы MP3) → OOM и сброс лимитов при рестарте Render
Что исправить в первую очередь:
  1. Перенести webhook-роут ДО express.json() и сверять подпись по настоящему raw body + timingSafeEqual
  2. Падать при старте в production, если TOKEN_SECRET / LEMON_WEBHOOK_SECRET не заданы
  3. Убрать дефолтные значения ACCESS_CODES/UNLOCK_CODES из кода (только env)
  4. Повесить aiRateLimit на /api/card, /api/lyrics, /api/song-structure, /api/analyze
  5. app.set("trust proxy", 1) + req.ip вместо ручного разбора X-Forwarded-For
  6. Ограничить размер скачивания в masterTrack и время жизни буферов в masterJobs
  7. Добавить Express error-handler (multer сейчас отдаёт HTML вместо JSON) и helmet/CSP
```

---

## 1. Безопасность

### CRITICAL

**S1. Подпись LemonSqueezy-вебхука фактически не проверяется — и не может пройти**
`server.js:712-724` + `server.js:57`.
`app.use(express.json())` объявлен глобально и парсит тело **раньше**, чем `express.raw()` на роуте вебхука. К моменту обработчика `req.body` — уже объект, и код делает `Buffer.from(JSON.stringify(req.body))`. Ре-сериализация почти никогда не совпадает байт-в-байт с оригиналом (пробелы, порядок, unicode) → HMAC не сойдётся → **все легитимные вебхуки будут отвергнуты 401**. Продления/отмены подписок обрабатываться не будут.
Риск-сценарий: при этом если `LEMON_WEBHOOK_SECRET` не задан, secret = `""` — подпись становится вычислимой любым желающим.
Исправление:

```js
// ДО app.use(express.json()):
app.post("/api/lemon/webhook", express.raw({ type: "application/json" }), (req, res) => {
  if (!process.env.LEMON_WEBHOOK_SECRET) return res.status(503).end();
  const sig = Buffer.from(String(req.headers["x-signature"] || ""), "utf8");
  const expected = Buffer.from(
    createHmac("sha256", process.env.LEMON_WEBHOOK_SECRET).update(req.body).digest("hex"), "utf8");
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected))
    return res.status(401).send("Invalid signature");
  const event = JSON.parse(req.body.toString());
  // ...
});
app.use(express.json());
```

**S2. Дефолтный TOKEN_SECRET в публичном репозитории**
`lib/lemon.js:92`: `process.env.TOKEN_SECRET || "dev-token-secret-change-me"`. Репо публичный (github.com/Flumos1/Suno-promt). Если переменная не задана на Render — любой человек генерирует себе валидный `pro`-токен на 2 года и получает мастеринг, генерацию, полный каталог.
Исправление: в production не иметь фолбэка — падать на старте:

```js
const SECRET = process.env.TOKEN_SECRET;
if (!SECRET && process.env.NODE_ENV === "production")
  throw new Error("TOKEN_SECRET is required in production");
```

**S3. Дефолтные ACCESS/UNLOCK-коды захардкожены**
`server.js:43-48`: `SILICON-DEMO, SUNO-2026, FREEPASS`, `SILICON-PRO, UNLOCK-ALL` — видны в публичном репо. "Токен" — это просто `base64(код)` (`/api/unlock`), его можно собрать в консоли браузера без запроса к серверу. Пока env не переопределён — весь платный каталог открыт бесплатно.
Исправление: убрать дефолты (`process.env.UNLOCK_CODES || ""`), коды ротировать; в идеале — выдавать HMAC-подписанный токен и на unlock-коды тоже.

### HIGH

**S4. AI-эндпоинты без rate limit → cost-DoS на API-ключи**
Без `aiRateLimit`: `GET /api/card/:name` (server.js:216), `POST /api/song-structure` (:231), `POST /api/lyrics` (:241), `POST /api/analyze` (:251). Каждый вызов — платный запрос к Anthropic/OpenAI. Скрипт с `while true; curl /api/card/$RANDOM` выжигает бюджет за ночь.
Исправление: добавить `aiRateLimit` в цепочку этих роутов (одна строка на роут).

**S5. Обход rate limit через X-Forwarded-For**
`lib/rateLimit.js:27-31`: берётся **первое** значение XFF — а его контролирует клиент (`curl -H "X-Forwarded-For: 1.2.3.$RANDOM"`). Лимит "3 запроса/24ч" обходится тривиально, вместе с S4