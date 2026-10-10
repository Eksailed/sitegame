// Данные сайта: рукотворный data.js (подробные записи, кадры, идеи) плюс автоматические записи из git игры.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { join } from "node:path";
import { compareVersions } from "./game-releases.mjs";

export function loadCurated(root) {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(join(root, "data.js"), "utf8"), sandbox);
  return sandbox.window.DEADLAND_DATA;
}

// Версии, которые уже описаны вручную в data.js, остаются как есть: подробный текст важнее авто-пересказа коммита.
// Остальные версии из git встают на своё место по номеру, самая новая получает отметку «текущая».
export function mergeReleases(curated, releases) {
  const data = JSON.parse(JSON.stringify(curated));
  const have = new Set(data.versions.map((v) => v.version));
  for (const release of releases) {
    if (!have.has(release.version)) data.versions.push(release);
  }
  data.versions.sort((a, b) => compareVersions(b.version, a.version));
  data.versions.forEach((v, i) => {
    if (i === 0) v.current = true;
    else delete v.current;
  });
  // fallbackVersion нужен, когда файла с живой версией нет; пусть и он будет свежим
  data.fallbackVersion = data.versions[0].version;
  return data;
}

export function serialize(data) {
  return (
    "// Собрано tools/live-build.mjs: рукотворный data.js плюс версии из git игры. Руками не править.\n" +
    `window.DEADLAND_DATA = ${JSON.stringify(data)};\n`
  );
}
