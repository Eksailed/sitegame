// Читает историю версий игры прямо из её git. Каждый коммит, который меняет файл VERSION, считается выпуском:
// номер берётся из VERSION в этом коммите, дата, автор и текст из самого коммита.
// Тексты коммитов игры пишутся как «что изменилось: подробности; ещё подробности. Версия игры X.Y.Z.», по этому образцу
// из них собираются заголовок, краткое описание и пункты списка. Свободный текст тоже переживёт: он станет заголовком.
import { execFileSync } from "node:child_process";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export const semverKey = (version) => {
  const m = String(version).match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : [0, 0, 0];
};

export const compareVersions = (a, b) => {
  const x = semverKey(a);
  const y = semverKey(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

const git = (repo, args) =>
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });

const tryGit = (repo, args) => {
  try {
    return git(repo, args);
  } catch {
    return null;
  }
};

// Ключевые слова для плашек-категорий. Берутся три самые частые, порядок при равенстве как здесь.
const CATEGORY_WORDS = [
  ["world", /мир[аеуом]?\b|город|ржав|дерев|земл[яиеюь]|трав[аыуе]|ландшафт|погод|туч|дожд|карт[аыуе]\b|биом|троп|освещен|небо|ночь|туман/gi],
  ["craft", /крафт|рецепт|предмет|добыч|инструмент|ресурс|инвентар|рюкзак|топор|ветк|ветв|волокн|шнур|резак|полен|еда\b|вод[аыуе]\b|хват/gi],
  ["character", /персонаж|анимац|\bрук[аиеу]\b|тело|кост[иья]|скелет|внешност|пальц|одежд|лицо|голов[аыуе]/gi],
  ["combat", /зомби|\bбо[йяю]|урон|удар|оруж|постро|строител|враг|заражённ|ранит|убива/gi],
  ["network", /сеть|сетев|кооператив|мультиплеер|клиент|хост|лобби|синхрон|подключен/gi],
  ["ui", /интерфейс|меню|\bhud\b|экран|настройк|иконк|чат\b|подсказ|окно|благодарност/gi],
  ["perf", /оптимиз|\bfps\b|производительн|исправ|\bбаг|ошибк|переполнен|утечк|памят|тормоз|вылет/gi]
];

const categoriesOf = (text) =>
  CATEGORY_WORDS.map(([id, re], order) => ({ id, order, hits: (text.match(re) || []).length }))
    .filter((c) => c.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.order - b.order)
    .slice(0, 3)
    .map((c) => c.id);

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const stripEnd = (s) => s.replace(/[\s.;,:]+$/u, "");

// Обрезка по границе слова, чтобы не рвать слово посередине
function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return stripEnd(space > max * 0.6 ? cut.slice(0, space) : cut) + "…";
}

// Сообщение коммита -> заголовок, краткое описание и пункты
export function describeMessage(message) {
  const text = message
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => !/^(co-authored-by|signed-off-by):/i.test(line.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    // номер версии уже стоит в самой записи, повторять его в тексте незачем
    .replace(/\s*Версия(?:\s+игры)?\s+\d+\.\d+\.\d+\.?\s*$/i, "")
    .trim();

  // Заголовок: всё до первого двоеточия; нет двоеточия, то до первой точки, точки с запятой или тире; иначе до запятой
  let head = text;
  let tail = "";
  const colon = text.indexOf(": ");
  const stop = text.search(/[.;] (?=\S)| — /);
  if (colon > 0 && colon <= 150) {
    head = text.slice(0, colon);
    tail = text.slice(colon + 2);
  } else if (stop > 0 && stop <= 150) {
    head = text.slice(0, stop);
    tail = text.slice(stop).replace(/^[.;]?\s+(— )?/, "");
  } else if (text.length > 120) {
    const comma = text.lastIndexOf(", ", 120);
    if (comma > 50) {
      head = text.slice(0, comma);
      tail = text.slice(comma + 2);
    }
  }

  const title = capitalize(clip(stripEnd(head), 150));
  // Если заголовок всё равно пришлось обрезать, весь текст остаётся в описании
  if (stripEnd(head).length > 150) tail = text;

  // Первая часть идёт в описание под заголовком, остальные в пункты раскрытой записи
  const parts = tail
    .split(/;\s+/)
    .map((p) => capitalize(stripEnd(p)))
    .filter(Boolean);
  const summary = parts.length ? clip(parts[0], 240) : "";
  const improvements = parts.slice(1);
  if (parts.length && parts[0].length > 240) improvements.unshift(parts[0]);

  return { title, summary, improvements, text };
}

// Файлы коммита нужны только для запасной догадки о категории, когда в тексте нет ни одного ключевого слова
const PATH_CATEGORY = [
  [/^src\/(World|City|Voxel)\b|^art\/levels\b/, "world"],
  [/^src\/(Crafting|Inventory)\b/, "craft"],
  [/^src\/(Player|Characters)\b|^art\/characters\b/, "character"],
  [/^src\/Combat\b/, "combat"],
  [/^src\/Network\b/, "network"],
  [/^src\/(UI|Settings)\b|^ui\//, "ui"]
];

function categoriesFromPaths(repo, hash) {
  const files = (tryGit(repo, ["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", hash]) || "").split("\n").filter(Boolean);
  const hits = new Map();
  for (const file of files) {
    const found = PATH_CATEGORY.find(([re]) => re.test(file));
    if (found) hits.set(found[1], (hits.get(found[1]) || 0) + 1);
  }
  return [...hits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id);
}

// refs: список веток, например ["lerk", "develop", "Eksailed"]; те, которых нет в репозитории, пропускаются.
// Возвращает записи журнала по убыванию версии. Одна версия в нескольких ветках и повторно названная версия дают одну запись:
// берётся последний по времени коммит, как итоговое состояние этого номера.
export function readReleases(repo, refs) {
  const commits = new Map();
  const missing = [];
  for (const ref of refs) {
    if (tryGit(repo, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]) === null) {
      missing.push(ref);
      continue;
    }
    const log = git(repo, ["log", ref, "--format=%H%x1f%an%x1f%aI%x1f%B%x1e", "--", "VERSION"]);
    for (const rec of log.split("\x1e")) {
      const [hash, author, date, ...rest] = rec.replace(/^\n/, "").split("\x1f");
      if (!hash || commits.has(hash)) continue;
      const version = (tryGit(repo, ["show", `${hash}:VERSION`]) || "").trim();
      if (!SEMVER.test(version)) continue;
      commits.set(hash, { hash, author, date: date.slice(0, 10), stamp: date, message: rest.join("\x1f"), version });
    }
  }

  const byVersion = new Map();
  for (const c of commits.values()) {
    const old = byVersion.get(c.version);
    if (!old || new Date(c.stamp) > new Date(old.stamp)) byVersion.set(c.version, c);
  }

  const releases = [...byVersion.values()]
    .sort((a, b) => compareVersions(b.version, a.version))
    .map((c) => {
      const info = describeMessage(c.message);
      const [, minor, patch] = semverKey(c.version);
      const categories = categoriesOf(info.text);
      return {
        version: c.version,
        type: patch === 0 ? "minor" : "patch",
        milestone: patch === 0 && minor > 0,
        date: c.date,
        author: c.author,
        commit: c.hash.slice(0, 7),
        title: info.title,
        summary: info.summary,
        categories: categories.length ? categories : categoriesFromPaths(repo, c.hash),
        improvements: info.improvements,
        auto: true
      };
    });

  return { releases, missing };
}
