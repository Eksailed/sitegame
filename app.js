(function () {
  const data = window.DEADLAND_DATA;
  if (!data) return;

  const state = {
    category: "all",
    author: "all",
    sort: "desc", // desc: от новых к старым, asc: с самого начала
    query: "",
    ideas: "all"
  };
  const openVersions = new Set(data.versions.filter((v) => v.current).map((v) => v.version));

  const categoryNames = {
    world: "Мир и город",
    craft: "Выживание и крафт",
    character: "Персонаж и анимации",
    combat: "Зомби, бой и постройки",
    network: "Сеть и кооператив",
    ui: "Интерфейс и меню",
    perf: "Оптимизация и фиксы"
  };

  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  // ---------- Вспомогательное ----------

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function escAttr(text) {
    return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  // В данных имена файлов отмечены обратными кавычками
  function richText(text) {
    return String(text || "").replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function dayKey(date) {
    return String(date).slice(0, 10);
  }

  function parseDay(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function humanDate(key, withYear = true) {
    const d = parseDay(key);
    return `${d.getDate()} ${months[d.getMonth()]}${withYear ? " " + d.getFullYear() : ""}`;
  }

  const firstDay = data.versions.map((v) => dayKey(v.date)).sort()[0];

  function dayNumber(key) {
    return Math.round((parseDay(key) - parseDay(firstDay)) / 86400000) + 1;
  }

  // Сжатые превью лежат в assets/site/thumbs; если превью нет, грузится исходник
  function thumb(src) {
    if (!/^\.\/(docs|art)\/.+\.png$/i.test(src)) return src;
    return "./assets/site/thumbs/" + src.slice(2).replace(/\//g, "__").replace(/\.png$/i, ".webp");
  }

  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (img.tagName === "IMG" && img.dataset.full && img.getAttribute("src") !== img.dataset.full) {
        img.src = img.dataset.full;
      }
    },
    true
  );

  // ---------- Версия и счётчики ----------

  async function loadLiveVersion() {
    let ver = data.fallbackVersion;
    try {
      const res = await fetch("./VERSION", { cache: "no-store" });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (/^\d+\.\d+\.\d+$/.test(text)) ver = text;
      }
    } catch (_) {
      // file:// не даёт читать VERSION, остаётся fallbackVersion
    }
    $$("[data-live-version]").forEach((el) => {
      el.textContent = ver;
    });
  }

  function renderCounters() {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const days = Math.max(1, dayNumber(todayKey));
    $$("[data-day-count]").forEach((el) => (el.textContent = days));
    $$("[data-day-start]").forEach((el) => (el.textContent = humanDate(firstDay)));

    const counts = { versions: data.versions.length, items: (data.items || []).length };
    const labels = {
      versions: (n) => plural(n, "версия в журнале", "версии в журнале", "версий в журнале"),
      items: (n) => plural(n, "предмет первого крафта", "предмета первого крафта", "предметов первого крафта")
    };
    Object.keys(counts).forEach((key) => {
      $$(`[data-count="${key}"]`).forEach((el) => (el.textContent = counts[key]));
      $$(`[data-count-label="${key}"]`).forEach((el) => (el.textContent = labels[key](counts[key])));
    });
  }

  // ---------- Журнал версий ----------

  function matches(v) {
    if (state.category === "milestone" && !v.milestone) return false;
    if (state.category !== "all" && state.category !== "milestone" && !v.categories.includes(state.category)) return false;
    if (state.author !== "all" && !v.author.toLowerCase().includes(state.author.toLowerCase())) return false;
    const q = state.query.trim().toLowerCase();
    if (q) {
      const hay = [v.version, v.title, v.summary, v.author, v.commit, v.tech || "", ...(v.improvements || [])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function filteredVersions() {
    const list = data.versions.filter(matches);
    return state.sort === "asc" ? list.slice().reverse() : list;
  }

  function renderCategories() {
    const box = $("#category-pills");
    if (!box) return;
    box.innerHTML = data.categories
      .map((cat) => {
        const n =
          cat.id === "all"
            ? data.versions.length
            : cat.id === "milestone"
            ? data.versions.filter((v) => v.milestone).length
            : data.versions.filter((v) => v.categories.includes(cat.id)).length;
        const label = cat.id === "world" ? "Мир и город Ржавый Бор" : cat.label.charAt(0) + cat.label.slice(1).toLowerCase();
        return `<button type="button" class="cat" data-cat="${cat.id}" aria-pressed="${state.category === cat.id}">
          <span>${label}</span><span class="cat__n">${n}</span>
        </button>`;
      })
      .join("");
  }

  function renderJumpSelect() {
    const sel = $("#version-jump");
    if (!sel) return;
    sel.innerHTML =
      `<option value="">Выбрать</option>` +
      data.versions
        .map((v) => `<option value="${escAttr(v.version)}">${v.version.replace(/\s*\(.*\)\s*$/, "")}${v.current ? ", текущая" : ""}${v.type === "proto" ? ", прототип" : ""}</option>`)
        .join("");
  }

  function versionId(ver) {
    return "ver-" + ver.replace(/[^a-zA-Z0-9]/g, "-");
  }

  function entryHtml(v) {
    const id = versionId(v.version);
    const isOpen = openVersions.has(v.version);
    const bare = v.version.replace(/\s*\(.*\)\s*$/, "");
    const [maj, min, patch] = bare.split(".");
    const num = patch === undefined ? bare : `${maj}.${min}<small>.${patch}</small>`;
    const points = (v.improvements || []).map((p) => `<li>${richText(p)}</li>`).join("");
    const hasMedia = Array.isArray(v.media) && v.media.length > 0;
    // Записи, собранные из git игры, бывают без подробностей: раскрывать у них нечего
    const expandable = Boolean(points || v.tech || hasMedia);

    const cls = [
      "entry",
      v.type === "patch" ? "is-patch" : "",
      v.milestone ? "is-milestone" : "",
      v.current ? "is-current" : "",
      expandable ? "" : "is-flat",
      expandable && isOpen ? "is-open" : ""
    ]
      .filter(Boolean)
      .join(" ");

    const stamp = v.current
      ? `<span class="stamp stamp--now">текущая</span>`
      : v.type === "proto"
      ? `<span class="stamp stamp--proto">прототип</span>`
      : "";

    const tags = (v.categories || [])
      .map((c) => `<span class="tag${c === "combat" ? " tag--combat" : ""}">${categoryNames[c] || c}</span>`)
      .join("");

    const media = hasMedia
      ? `<div class="media">${v.media
          .map(
            (m) => `<button type="button" class="shot" data-full="${escAttr(m.src)}" data-caption="${escAttr(m.caption)}">
              <img src="${thumb(m.src)}" data-full="${escAttr(m.src)}" alt="${escAttr(m.caption)}" loading="lazy" />
              <span>${m.caption}</span>
            </button>`
          )
          .join("")}</div>`
      : "";

    return `<article class="${cls}" id="${id}">
      <div class="entry__head"${expandable ? ` data-toggle="${v.version}"` : ""}>
        <div class="entry__ver">
          <span class="entry__num">${num}</span>
          ${stamp}
        </div>
        <div class="entry__main">
          <p class="entry__meta">
            <span>${humanDate(dayKey(v.date), false)}</span>
            <span>${v.author}</span>
            <code>${v.commit}</code>
          </p>
          <h3 class="entry__title">
            ${expandable ? `<button type="button" class="entry__toggle" aria-expanded="${isOpen}" aria-controls="${id}-body">${v.title}</button>` : `<span class="entry__toggle">${v.title}</span>`}
          </h3>
          ${v.summary ? `<p class="entry__sum">${richText(v.summary)}</p>` : ""}
          <div class="tags">${tags}</div>
        </div>
        <span class="entry__chev" aria-hidden="true"></span>
      </div>
      ${
        expandable
          ? `<div class="entry__body" id="${id}-body">
        <div class="entry__inner">
          <div class="entry__content${hasMedia ? " has-media" : ""}">
            <div>
              ${points ? `<ul class="points">${points}</ul>` : ""}
              ${v.tech ? `<div class="techbox"><span class="techbox__name">Файлы и проверки</span>${richText(v.tech)}</div>` : ""}
            </div>
            ${media}
          </div>
        </div>
      </div>`
          : ""
      }
    </article>`;
  }

  function renderTimeline() {
    const box = $("#version-timeline");
    const countEl = $("#results-count");
    if (!box) return;

    const list = filteredVersions();
    if (countEl) {
      countEl.textContent =
        list.length === data.versions.length
          ? `Все ${list.length} ${plural(list.length, "запись", "записи", "записей")}`
          : `Найдено ${list.length} из ${data.versions.length}`;
    }

    if (list.length === 0) {
      box.innerHTML = `<div class="empty">
        <h3>Ничего не найдено</h3>
        <p>Под эти фильтры не подходит ни одна версия. Уберите часть условий или сбросьте всё сразу.</p>
        <button type="button" class="btn btn--small btn--signal" data-reset>Сбросить фильтры</button>
      </div>`;
      return;
    }

    // Группы по дням разработки, порядок сохраняется
    const groups = [];
    list.forEach((v) => {
      const key = dayKey(v.date);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(v);
      else groups.push({ key, items: [v] });
    });

    box.innerHTML = groups
      .map(
        (g) => `<section class="day" aria-label="День ${dayNumber(g.key)}">
          <header class="day__head">
            <span class="day__n">День ${dayNumber(g.key)}</span>
            <span class="day__date">${humanDate(g.key)}</span>
            <span class="day__count">${g.items.length} ${plural(g.items.length, "версия", "версии", "версий")}</span>
          </header>
          ${g.items.map(entryHtml).join("")}
        </section>`
      )
      .join("");
  }

  function toggleEntry(ver, force) {
    const card = document.getElementById(versionId(ver));
    const open = force !== undefined ? force : !openVersions.has(ver);
    if (open) openVersions.add(ver);
    else openVersions.delete(ver);
    if (card) {
      card.classList.toggle("is-open", open);
      const btn = $(".entry__toggle", card);
      if (btn) btn.setAttribute("aria-expanded", String(open));
    }
  }

  function resetFilters() {
    state.category = "all";
    state.author = "all";
    state.query = "";
    const search = $("#version-search");
    if (search) search.value = "";
    $$("#author-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.author === "all")));
    renderCategories();
    renderTimeline();
  }

  function initJournal() {
    renderCategories();
    renderJumpSelect();
    renderTimeline();

    $("#category-pills")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".cat");
      if (!btn) return;
      state.category = btn.dataset.cat || "all";
      renderCategories();
      renderTimeline();
    });

    $("#author-seg")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-author]");
      if (!btn) return;
      state.author = btn.dataset.author;
      $$("#author-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      renderTimeline();
    });

    $("#version-search")?.addEventListener("input", (e) => {
      state.query = e.target.value;
      renderTimeline();
    });

    $("#sort-order")?.addEventListener("change", (e) => {
      state.sort = e.target.value;
      renderTimeline();
    });

    $("#version-jump")?.addEventListener("change", (e) => {
      const ver = e.target.value;
      if (!ver) return;
      openVersions.add(ver);
      resetFilters();
      e.target.value = "";
      document.getElementById(versionId(ver))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("#expand-all-btn")?.addEventListener("click", () => {
      data.versions.forEach((v) => openVersions.add(v.version));
      renderTimeline();
    });

    $("#collapse-all-btn")?.addEventListener("click", () => {
      openVersions.clear();
      renderTimeline();
    });

    $("#version-timeline")?.addEventListener("click", (e) => {
      if (e.target.closest("[data-reset]")) {
        resetFilters();
        return;
      }
      if (e.target.closest(".shot")) return;
      const head = e.target.closest("[data-toggle]");
      if (!head) return;
      // Не мешаем выделять текст мышью
      if (window.getSelection && String(window.getSelection()).length > 0 && !e.target.closest(".entry__toggle")) return;
      toggleEntry(head.dataset.toggle);
    });
  }

  // ---------- Инвентарь ----------

  function renderItemDetail(item) {
    const box = $("#item-detail");
    if (!box || !item) return;
    box.innerHTML = `<div class="inv__top">
        <div class="inv__icon"><img src="${item.icon}" alt="" /></div>
        <div>
          <h3 class="inv__name">${item.name}</h3>
          <p class="inv__id">${item.id}</p>
        </div>
      </div>
      <dl class="inv__stats">
        <div><dt>Урон</dt><dd>${item.damage}</dd></div>
        <div><dt>В стопке</dt><dd>до ${item.stack}</dd></div>
      </dl>
      <p class="inv__role">${richText(item.role)}</p>`;
  }

  function initInventory() {
    const grid = $("#items-catalog");
    if (!grid || !data.items) return;
    const startId = data.items.some((i) => i.id === "stone_axe") ? "stone_axe" : data.items[0].id;

    grid.innerHTML = data.items
      .map(
        (item) => `<button type="button" class="slot" data-item="${item.id}" aria-pressed="${item.id === startId}">
          <span class="slot__stack">×${item.stack}</span>
          <img src="${item.icon}" alt="" loading="lazy" />
          <span class="slot__name">${item.name}</span>
        </button>`
      )
      .join("") +
      // Свободные клетки до полного ряда, как в рюкзаке
      `<span class="slot slot--empty" aria-hidden="true"></span>`.repeat((4 - (data.items.length % 4)) % 4);

    renderItemDetail(data.items.find((i) => i.id === startId));

    grid.addEventListener("click", (e) => {
      const slot = e.target.closest(".slot");
      if (!slot) return;
      $$(".slot", grid).forEach((s) => s.setAttribute("aria-pressed", String(s === slot)));
      renderItemDetail(data.items.find((i) => i.id === slot.dataset.item));
    });
  }

  // ---------- Кадры ----------

  function initGallery() {
    const box = $("#gallery-grid");
    if (!box || !data.gallery) return;
    const sizes = { 0: "frame--big", 5: "frame--wide" };
    box.innerHTML = data.gallery
      .map(
        (g, i) => `<button type="button" class="frame ${sizes[i] || ""}" data-full="${escAttr(g.src)}" data-caption="${escAttr(`${g.title}. ${g.desc}`)}">
          <span class="frame__img"><img src="${thumb(g.src)}" data-full="${escAttr(g.src)}" alt="${escAttr(g.title)}" loading="lazy" /></span>
          <span>
            <span class="frame__title">${g.title}</span>
            <span class="frame__desc">${g.desc}</span>
          </span>
        </button>`
      )
      .join("");
  }

  // ---------- Идеи ----------

  function ideaGroup(idea) {
    if (idea.done) return "done";
    if (/^(Утверждено|К демо)/.test(idea.status)) return "approved";
    return "design";
  }

  function initIdeas() {
    const list = $("#ideas-grid");
    const filter = $("#ideas-filter");
    if (!list || !data.ideas) return;

    const groups = [
      { id: "all", label: "Все" },
      { id: "done", label: "Уже в игре" },
      { id: "approved", label: "Утверждено" },
      { id: "design", label: "Проектируется" }
    ];

    function render() {
      if (filter) {
        filter.innerHTML = groups
          .map((g) => {
            const n = g.id === "all" ? data.ideas.length : data.ideas.filter((i) => ideaGroup(i) === g.id).length;
            return `<button type="button" data-group="${g.id}" aria-pressed="${state.ideas === g.id}">${g.label}<span class="seg__n">${n}</span></button>`;
          })
          .join("");
      }
      list.innerHTML = data.ideas
        .filter((i) => state.ideas === "all" || ideaGroup(i) === state.ideas)
        .map((idea) => {
          const group = ideaGroup(idea);
          return `<li class="idea is-${group}">
            <span class="idea__n">${String(idea.num).padStart(2, "0")}</span>
            <h3 class="idea__title">${idea.title}</h3>
            <p class="idea__desc">${idea.desc}</p>
            <span class="idea__status">${idea.status}</span>
          </li>`;
        })
        .join("");
    }

    render();
    filter?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-group]");
      if (!btn) return;
      state.ideas = btn.dataset.group;
      render();
    });
  }

  // ---------- Сравнение «до и после» ----------

  function initCompares() {
    $$(".cmp__stage").forEach((stage) => {
      const range = $(".cmp__range", stage);
      if (!range) return;
      const update = () => stage.style.setProperty("--pos", range.value + "%");
      range.addEventListener("input", update);
      update();
    });
  }

  // ---------- Полосы замеров заполняются, когда до них доскроллили ----------

  function initGauges() {
    const gauges = $(".gauges");
    if (!gauges) return;
    if (!("IntersectionObserver" in window)) {
      gauges.classList.add("is-seen");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          gauges.classList.add("is-seen");
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(gauges);
  }

  // ---------- Фонарь в первом экране ----------

  function initFlashlight() {
    const scene = $("#hero-scene");
    const hero = $(".hero");
    if (!scene || !hero) return;
    let frame = 0;
    let target = null;

    function apply() {
      frame = 0;
      if (!target) return;
      scene.style.setProperty("--x", target.x + "px");
      scene.style.setProperty("--y", target.y + "px");
    }

    hero.addEventListener("pointermove", (e) => {
      const rect = scene.getBoundingClientRect();
      target = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (!frame) frame = requestAnimationFrame(apply);
    });
  }

  // ---------- Просмотр кадра ----------

  function initLightbox() {
    const dlg = $("#lightbox");
    const img = $("#lightbox-img");
    const cap = $("#lightbox-caption");
    const count = $("#lightbox-count");
    if (!dlg || !img || !cap || typeof dlg.showModal !== "function") return;

    let items = [];
    let index = 0;

    function show(i) {
      index = (i + items.length) % items.length;
      const el = items[index];
      img.src = el.dataset.full;
      img.alt = el.dataset.caption || "";
      cap.textContent = el.dataset.caption || "";
      if (count) count.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : "";
      $("#lightbox-prev").hidden = items.length < 2;
      $("#lightbox-next").hidden = items.length < 2;
    }

    document.addEventListener("click", (e) => {
      const trigger = e.target.closest("button[data-full]");
      if (!trigger) return;
      const group = trigger.closest("[data-lb-group]");
      items = group ? $$("button[data-full]", group) : [trigger];
      dlg.showModal();
      show(items.indexOf(trigger));
    });

    $("#lightbox-prev")?.addEventListener("click", () => show(index - 1));
    $("#lightbox-next")?.addEventListener("click", () => show(index + 1));
    $("#lightbox-close")?.addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
    });
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
    dlg.addEventListener("close", () => {
      img.removeAttribute("src");
    });
  }

  // ---------- Текущий раздел в навигации ----------

  function initNavSpy() {
    const links = $$(".bar__nav a");
    if (!links.length || !("IntersectionObserver" in window)) return;
    const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((a) => a.removeAttribute("aria-current"));
          byId.get(en.target.id)?.setAttribute("aria-current", "true");
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    byId.forEach((_, id) => {
      const sec = document.getElementById(id);
      if (sec) io.observe(sec);
    });
  }

  // Нажатие на кнопку бота закрытого теста пишем в Метрику целью tg_test (если счётчик загрузился).
  function initGoals() {
    document.querySelectorAll("[data-goal]").forEach((el) => {
      el.addEventListener("click", () => {
        try {
          if (typeof window.ym === "function") window.ym(113599733, "reachGoal", el.dataset.goal);
        } catch (e) {
          /* счётчик не должен ломать переход */
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initGoals();
    loadLiveVersion();
    renderCounters();
    initJournal();
    initInventory();
    initGallery();
    initIdeas();
    initCompares();
    initGauges();
    initFlashlight();
    initLightbox();
    initNavSpy();
  });
})();
