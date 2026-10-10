#!/usr/bin/env node
// Пересобирает SEO-части сайта из data.js: слепок журнала и идей для роботов в index.html, разметку JSON-LD и sitemap.xml.
// Запускать после правок data.js или релиза: node tools/seo-build.mjs
// На проде то же самое для свежих версий из git игры делает tools/live-build.mjs, а этот скрипт отвечает за файлы в git.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCurated } from "./lib/site-data.mjs";
import { renderSeo } from "./lib/seo.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = loadCurated(root);
const { html, sitemap, summary } = renderSeo(readFileSync(join(root, "index.html"), "utf8"), data);
writeFileSync(join(root, "index.html"), html);
writeFileSync(join(root, "sitemap.xml"), sitemap);
console.log(`index.html: журнал ${summary.versions}, идей ${summary.ideas}, версия ${summary.newest}; sitemap.xml: lastmod ${summary.lastDay}`);
