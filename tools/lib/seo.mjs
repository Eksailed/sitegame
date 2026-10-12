// Части сайта для роботов, которые строятся из данных: слепок журнала и идей внутри index.html, разметка JSON-LD, sitemap.xml.
// Журнал и идеи рисует app.js, а роботы без JS видят только исходный HTML, поэтому текст кладётся в него заранее.
// app.js целиком заменяет содержимое #version-timeline и #ideas-grid, так что слепок людям не виден.
const SITE = "https://deadland.site";

// У версии 0.0 дата записана диапазоном, поэтому берём первые 10 символов, как делает app.js
const dayKey = (date) => String(date).slice(0, 10);

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const fmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const human = (iso) => fmt.format(new Date(iso + "T00:00:00Z"));

function inject(html, name, body) {
  const re = new RegExp(`(<!-- seo:${name}:start -->)[\\s\\S]*?(<!-- seo:${name}:end -->)`);
  if (!re.test(html)) throw new Error(`в index.html нет маркеров seo:${name}`);
  return html.replace(re, (_, a, b) => `${a}\n${body}\n${b}`);
}

// html: текущий index.html; data: данные сайта, новейшая версия первой. Возвращает новый index.html и sitemap.xml.
export function renderSeo(html, data) {
  const days = data.versions.map((v) => dayKey(v.date)).sort();
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const newest = { ...data.versions[0], version: data.fallbackVersion || data.versions[0].version };

  const journal = data.versions
    .map(
      (v) =>
        `<article class="snap"><h3>Версия ${esc(v.version)}: ${esc(v.title)}</h3>` +
        `<p><time datetime="${dayKey(v.date)}">${human(dayKey(v.date))}</time>${v.summary ? `. ${esc(v.summary)}` : ""}</p></article>`
    )
    .join("\n");

  const ideas = data.ideas.map((i) => `<li class="snap"><h3>${esc(i.title)}</h3><p>${esc(i.desc)}</p></li>`).join("\n");

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

  let out = html;
  out = inject(out, "jsonld", `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)}\n</script>`);
  out = inject(out, "journal", journal);
  out = inject(out, "ideas", ideas);
  // Числа, которые app.js потом перепишет сам: без JS они тоже должны быть свежими
  out = out.replace(/(<(\w+)[^>]*\bdata-live-version\b[^>]*>)[^<]*(<\/\2>)/g, (_, open, _tag, close) => `${open}${newest.version}${close}`);
  out = out.replace(/(<(\w+)[^>]*\bdata-count="versions"[^>]*>)[^<]*(<\/\2>)/g, (_, open, _tag, close) => `${open}${data.versions.length}${close}`);

  return { html: out, sitemap, summary: { versions: data.versions.length, ideas: data.ideas.length, newest: newest.version, lastDay } };
}
