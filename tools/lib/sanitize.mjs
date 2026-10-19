// Очистка текстов журнала перед показом на сайте: внутренности разработки посетителю не нужны и не должны попадать
// в публичные файлы. Убираем имена файлов, классов и тестов, пути кода, внутреннюю документацию, правила для агентов,
// названия инструментов ИИ, служебные заметки о слиянии веток. Клавиши (`F`, `Shift`) и игровые слова остаются.
// Применяется в seo-build.mjs и live-build.mjs ко всем записям, рукотворным и автоматическим.

// Клавиши в обратных кавычках: это для игрока. Остальное в кавычках (идентификаторы, внутренние названия) убираем.
const KEY = /^(?:[A-ZА-ЯЁ]|F\d{1,2}|Shift|Ctrl|Alt|Tab|TAB|Esc|ESC|Enter|Space|Backspace|ЛКМ|ПКМ|~|Ё|WASD|[A-Z]\/[A-Z]|[A-Z]\+[A-Z])$/;

// Слова, которые похожи на идентификаторы, но это названия технологий и источников
// Авторы моделей по лицензии CC-BY: их имена нужны для атрибуции.
const KEEP_WORDS = new Set(["DayZ", "MakeHuman", "ambientCG", "PolyHaven", "MPFB", "OpenGL", "GitHub", "TwilightFox", "Modelified", "Meerschaum"]);

const FILE_EXT = "cs|py|gd|gdshader|tscn|tres|bat|sh|mjs|json|md|glb|bin|pck|exe|import|scn|csproj";
const ROOTS = "src|tools|docs|assets|scenes|ui|art";

// Файл или путь без обратных кавычек: предложение, где он есть, про внутреннюю кухню
const PLAIN_PATH = new RegExp(
  String.raw`(?:^|[\s(«"])(?:${ROOTS})/\S+|(?<![\`\w])[\w\-./а-яёА-ЯЁ]+\.(?:${FILE_EXT})\b(?!\`)`,
);

// Предложения, которые целиком про внутреннюю кухню
const DROP_SENTENCE = [
  /^(?:все\s+)?(?:тесты?|проверки|проверка|проверено|приёмка|для проверки)(?![а-яё])/i,
  // слово «тест» в любом месте предложения (кроме «закрытый тест»): это про проверки, а не про игру
  /(?<!закрыт[а-яё]{2,3}\s)(?<![а-яё])тест(?!ер)[а-яё]*/i,
  /\b(?:dotnet|check_docs|AGENTS|README|VERSION|run_[a-z_]+|git (?:pull|push|merge))\b|\.csproj/i,
  /правил\S* для агентов|для агентов|агент\S*|\b(?:Cursor|Claude|Codex|ChatGPT|Copilot)\b/i,
  /параллельн\S+ сессии|конфликты только/i,
  /пайплайн|исходник\S* для Blender/i,
  /дан\S* нов\S+ номер|нов\S+ номер \d/i,
  /редактор\S* хвата/i,
  /не (?:собиралось|запускалось)/i, // честное «пока не смотрелось» в записях для игрока оставляем
  /^версия игры \d/i,
  // команды консоли разработчика списком
  /\b(?:give|spawn|wound|freeze|heal|god|tp|speed)\b[,\s]+(?:give|spawn|wound|freeze|heal|god|tp|speed)\b/i,
];

function dropSentences(text) {
  const parts = text.split(/(?<=[.!?…])\s+(?=[«"A-ZА-ЯЁ(<])/);
  const kept = parts.filter((p) => {
    const plain = p.replace(/<[^>]+>/g, "").trim();
    return !DROP_SENTENCE.some((re) => re.test(plain)) && !PLAIN_PATH.test(plain);
  });
  return kept.join(" ");
}

function stripTokens(text) {
  return text.replace(/`([^`]+)`/g, (whole, token) => (KEY.test(token) ? whole : ""));
}

// Идентификаторы без кавычек: HotbarUI, hand_palm, HELD_SKIN
function stripPlainIdentifiers(text) {
  return text
    .replace(/\b[A-Z][a-z]+(?:[A-Z][a-z0-9]*)+\b/g, (w) => (KEEP_WORDS.has(w) ? w : ""))
    .replace(/\b[a-z]+[A-Z][A-Za-z]*\b/g, (w) => (KEEP_WORDS.has(w) ? w : ""))
    .replace(/(?<![\w)])\.[A-Z][A-Za-z0-9]+\b/g, "") // хвосты методов вроде «.Teleport»
    .replace(/\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b/g, "")
    .replace(/\b[a-z]{2,}(?:_[a-z0-9]+)+\b/g, "");
}

function tidy(text) {
  return text
    .replace(/\(\s*\.\.\.[^()]*\)/g, "") // обрывки вызовов кода вроде «(..., at)»
    .replace(/\s*\(\s*[A-Za-z]+\.\s*[,;]?\s*\)/g, "") // «(Zombie.)»
    .replace(/\(\s*(?:[,;]\s*)*(?:коммит|commit)\s*(?:[,;]\s*)*\)/gi, "") // «(файл, коммит хеш)» после вычистки
    .replace(/\s*\(\s*(?:\.\w*\s*)?\)/g, "") // скобки с обрывком вроде «(.)»
    .replace(/\s*\(\s*(?:[,;]\s*)*\)/g, "") // пустые скобки
    .replace(/\(\s*[,;]\s*/g, "(")
    .replace(/\s*[,;]\s*\)/g, ")")
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/\s+и\s*\)/g, ")")
    .replace(/\s+([.,;:!?)])/g, "$1")
    .replace(/\s+(<\/strong>)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[,;:.\-—]\s*/, "")
    .trim();
}

export function cleanString(text, { sentences = true } = {}) {
  if (typeof text !== "string" || !text) return text;
  let out = sentences ? dropSentences(text) : text;
  out = stripTokens(out);
  out = out
    .replace(new RegExp(String.raw`\b(?:${ROOTS})/[^\s,;:)<"'«»]+`, "g"), "")
    .replace(new RegExp(String.raw`[\w\-./а-яёА-ЯЁ]+\.(?:${FILE_EXT})\b`, "g"), "")
    .replace(/\s*\((?:Codex|Claude|Cursor|ChatGPT|Copilot|Gemini)[^)]*\)/g, "")
    .replace(/\s+(?:в|для|из|через|без)\s+Blender\b/g, "");
  out = stripPlainIdentifiers(out);
  return tidy(out);
}

// Пустое или осиротевшее после очистки предложение не оставляем
function usable(text) {
  const open = (text.match(/\(/g) || []).length;
  const close = (text.match(/\)/g) || []).length;
  return open === close && text.replace(/<[^>]+>/g, "").replace(/[\s.,;:—-]/g, "").length >= 18;
}

export function cleanVersion(v) {
  const next = { ...v };
  delete next.tech; // «Файлы и проверки» не показываем никому
  delete next.commit; // номера коммитов приватного репозитория тоже внутренние
  next.title = cleanString(v.title, { sentences: false }) || v.title;
  next.summary = cleanString(v.summary);
  // «Слияние ветки …» говорит о кухне, а не об игре: заголовком становится первая фраза описания
  if (/^слияние(?![а-яё])/i.test(next.title) && next.summary) {
    const text = next.summary.replace(/^(?:из\s+(?:неё|него|них)\s+)/i, "").replace(/^в\s+\S+\s+влит\S*[^:.]*[:.]?\s*/i, "").trim();
    const first = text.split(/(?<=[.!?])\s+/)[0].replace(/[.]+$/, "");
    if (first.length >= 12) {
      next.title = first[0].toUpperCase() + first.slice(1);
      next.summary = text.slice(first.length).replace(/^[.\s]+/, "");
    }
  }
  next.improvements = (v.improvements || []).map(cleanString).filter(usable);
  return next;
}

// Запись, от которой после очистки ничего не осталось (скрипты запуска, правила, документы), на сайт не попадает
function emptied(original, cleaned) {
  const had = Boolean(original.summary) || (original.improvements || []).length > 0;
  return had && !cleaned.summary && cleaned.improvements.length === 0;
}

// Версии, описанные рукотворной записью под другим номером (после слияния веток итог получил новый номер)
const SUPERSEDED = new Set(["0.65.0", "0.91.1", "0.91.2", "0.92.1", "0.92.2", "0.92.3", "0.92.4", "0.102.0", "0.104.1", "0.103.3", "0.103.4", "0.104.3", "0.104.4", "0.104.5", "0.105.1", "0.105.2", "0.105.3", "0.106.2", "0.106.3", "0.123.0", "0.122.1", "0.120.1", "0.114.3", "0.113.0", "0.109.1", "0.109.2", "0.109.3", "0.109.4", "0.109.5", "0.125.0", "0.129.1", "0.141.0", "0.142.0", "0.143.0", "0.144.0", "0.137.1", "0.127.1", "0.125.2", "0.125.3", "0.124.1", "0.145.3", "0.145.4", "0.145.5", "0.157.1", "0.157.0", "0.156.5", "0.156.4", "0.156.3", "0.156.2", "0.156.1", "0.156.0", "0.155.0", "0.154.0", "0.153.4", "0.153.3", "0.153.2", "0.153.0", "0.152.0", "0.151.0", "0.149.0", "0.148.0", "0.161.1", "0.161.2", "0.161.3", "0.161.4", "0.161.5", "0.161.7"]);

// Записи, смысл которых целиком во внутренней кухне: правила, документы, рабочие инструменты и промежуточные шаги
export function isInternal(v) {
  const hay = `${v.title} ${v.summary}`;
  return (
    SUPERSEDED.has(v.version) ||
    /правил\S* для агентов|для агентов|документаци\S* (?:всех )?систем|AGENTS/i.test(hay) ||
    /^(?:редактор хвата|общая система хвата|первый хват автора из редактора|хват газового ключа)|\(в работе\)/i.test(String(v.title).trim()) ||
    /редактор\S* Godot|импорт\S* (?:3D-)?моделей при запуске/i.test(String(v.title)) ||
    /страниц\S* списка хвата|списка хвата|правка любых данных предмета/i.test(hay)
  );
}

export function sanitizeData(data) {
  const out = { ...data };
  out.versions = (data.versions || [])
    .filter((v) => !isInternal(v))
    .map((v) => [v, cleanVersion(v)])
    .filter(([orig, cleaned]) => !emptied(orig, cleaned))
    .map(([, cleaned]) => cleaned);
  // Самая новая версия игры может оказаться скрытой (рабочий инструмент): номер на сайте всё равно настоящий,
  // а «текущей» в журнале помечается первая показанная запись.
  const newest = (data.versions || [])[0];
  if (newest) out.fallbackVersion = newest.version;
  out.versions.forEach((v, i) => {
    if (i === 0) v.current = true;
    else delete v.current;
  });
  return out;
}
