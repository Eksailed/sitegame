#!/usr/bin/env node
// Живые файлы сайта: версия и журнал берутся из git игры сами.
//
// Как это устроено на проде (de-host):
//   1. tools/live-update.sh раз в несколько минут обновляет зеркало git игры (приватный репозиторий, ключ только на чтение);
//   2. этот скрипт читает из зеркала коммиты, меняющие VERSION, и склеивает их с рукотворным data.js;
//   3. результат кладётся в _live/ (в git его нет): VERSION, data.js, index.html со свежим слепком для роботов, sitemap.xml;
//   4. nginx отдаёт эти файлы вместо одноимённых из git, а если их нет, отдаёт обычные, и сайт работает как раньше.
// Рукотворные записи data.js главнее авто-записей, поэтому подробный текст напарника не затирается.
//
// Запуск: node tools/live-build.mjs [--game <git игры>] [--refs lerk,develop,Eksailed] [--out <каталог>]
// Для проверки на Mac: --game ~/work/Godot/Deadland --refs origin/lerk,origin/develop,origin/Eksailed --out /tmp/live
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readReleases } from "./lib/game-releases.mjs";
import { loadCurated, mergeReleases, serialize } from "./lib/site-data.mjs";
import { renderSeo } from "./lib/seo.mjs";
import { sanitizeData } from "./lib/sanitize.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const gameRepo = resolve(option("game", process.env.GAME_REPO || "/var/lib/deadland-game.git"));
const refs = option("refs", process.env.GAME_REFS || "lerk,develop,Eksailed").split(",").map((r) => r.trim()).filter(Boolean);
const out = resolve(option("out", join(root, "_live")));

// Файлы, зависящие от index.html и data.js из git сайта. Если собрать их не вышло, их нельзя оставлять:
// устаревшая копия закрыла бы собой свежую вёрстку напарника.
const FROM_REPO = ["index.html", "data.js", "sitemap.xml"];

function write(name, content) {
  const file = join(out, name);
  if (existsSync(file) && readFileSync(file, "utf8") === content) return false;
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, file);
  return true;
}

// Сбой на стороне игры (зеркала нет, github недоступен): прошлые живые файлы остаются, они не устарели из-за вёрстки
let releases;
try {
  if (!existsSync(gameRepo)) throw new Error(`нет git игры: ${gameRepo}`);
  const read = readReleases(gameRepo, refs);
  if (read.missing.length) console.warn(`веток нет в git игры, пропущены: ${read.missing.join(", ")}`);
  if (!read.releases.length) throw new Error("в git игры не найдено ни одной версии (коммитов с файлом VERSION)");
  releases = read.releases;
} catch (err) {
  console.error(`live-build: ${err.message}. Живые файлы не тронуты.`);
  process.exit(1);
}

try {
  const data = sanitizeData(mergeReleases(loadCurated(root), releases));
  const seo = renderSeo(readFileSync(join(root, "index.html"), "utf8"), data);

  mkdirSync(out, { recursive: true });
  const changed = [
    write("VERSION", `${data.versions[0].version}\n`),
    write("data.js", serialize(data)),
    write("index.html", seo.html),
    write("sitemap.xml", seo.sitemap)
  ].filter(Boolean).length;

  const added = data.versions.filter((v) => v.auto).length;
  console.log(
    `версия ${data.versions[0].version}, журнал ${data.versions.length} (из git игры добавлено ${added}), ` +
      (changed ? `обновлено файлов: ${changed}` : "без изменений")
  );
} catch (err) {
  for (const name of FROM_REPO) rmSync(join(out, name), { force: true });
  console.error(`live-build: ${err.message}. Живые копии убраны, сайт отдаёт файлы из git как есть.`);
  process.exit(1);
}
