#!/usr/bin/env node
// Пересобирает SEO-части сайта из data.js: слепок журнала и идей для роботов в index.html,
// разметку JSON-LD и sitemap.xml. Запускать после правок data.js или релиза: node tools/seo-build.mjs
// Журнал и идеи рисует app.js, а роботы без JS видят только исходный HTML, поэтому текст кладётся в него заранее.
// app.js целиком заменяет содержимое #version-timeline и #ideas-grid, так что слепок людям не виден.
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://deadland.site";

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(root, "data.js"), "utf8"), sandbox);
const data = sandbox.window.DEADLAND_DATA;
// У версии 0.8.0 дата записана диапазоном, поэтому берём первые 10 символов, как делает app.js
const dayKey = (date) => String(date).slice(0, 10);
const days = data.versions.map((v) => dayKey(v.date)).sort();
const firstDay = days[0];
const lastDay = days[days.length - 1];
const newest = data.versions[0];

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const fmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const human = (iso) => fmt.format(new Date(iso + "T00:00:00Z"));

const journal = data.versions
  .map(
    (v) =>
      `<article class="snap"><h3>Версия ${esc(v.version)}: ${esc(v.title)}</h3>` +
      `<p><time datetime="${dayKey(v.date)}">${human(dayKey(v.date))}</time>. ${esc(v.summary)}</p></article>`
  )
  .join("\n");

const ideas = data.ideas
  .map((i) => `<li class="snap"><h3>${esc(i.title)}</h3><p>${esc(i.desc)}</p></li>`)
  .join("\n");

const jsonld = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: `${SITE}/`,
      name: "Deadland",
      inLanguage: "ru-RU",
      description: "Сайт игры Deadland: журнал версий, крафт, кадры из игры и идеи механик."
    },
    {
      "@type": "VideoGame",
      "@id": `${SITE}/#game`,
      name: "Deadland",
      url: `${SITE}/`,
      description:
        "Кооперативное выживание от первого лица на Godot 4.7 .NET: разрушаемый город Ржавый Бор из 34 зданий, первый крафт с голыми руками, заражённые на улицах.",
      image: `${SITE}/assets/site/og.jpg`,
      inLanguage: "ru-RU",
      genre: ["Выживание", "Кооператив"],
      playMode: ["https://schema.org/SinglePlayer", "https://schema.org/CoOp"],
      numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 8 },
      softwareVersion: newest.version,
      dateCreated: firstDay,
      dateModified: lastDay,
      author: [
        { "@type": "Person", name: "lerk" },
        { "@type": "Person", name: "Eksailed" }
      ],
      isPartOf: { "@id": `${SITE}/#website` }
    }
  ]
};

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${lastDay}</lastmod>
    <image:image>
      <image:loc>${SITE}/assets/site/og.jpg</image:loc>
    </image:image>
  </url>
</urlset>
`;

function inject(html, name, body) {
  const re = new RegExp(`(<!-- seo:${name}:start -->)[\\s\\S]*?(<!-- seo:${name}:end -->)`);
  if (!re.test(html)) throw new Error(`в index.html нет маркеров seo:${name}`);
  return html.replace(re, (_, a, b) => `${a}\n${body}\n${b}`);
}

let html = readFileSync(join(root, "index.html"), "utf8");
html = inject(html, "jsonld", `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)}\n</script>`);
html = inject(html, "journal", journal);
html = inject(html, "ideas", ideas);
writeFileSync(join(root, "index.html"), html);
writeFileSync(join(root, "sitemap.xml"), sitemap);
console.log(`index.html: журнал ${data.versions.length}, идей ${data.ideas.length}, версия ${newest.version}; sitemap.xml: lastmod ${lastDay}`);
