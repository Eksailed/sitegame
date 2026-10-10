(function () {
  const data = window.DEADLAND_DATA;
  if (!data) return;

  let activeCategory = "all";
  let activeAuthor = "all";
  let sortDirection = "desc"; // 'desc' (0.34.0 -> 0.0) or 'asc' (0.0 -> 0.34.0)
  let searchQuery = "";
  const openVersions = new Set(["0.34.0", "0.33.0", "0.32.0", "0.31.0", "0.30.1", "0.30.0", "0.26.0", "0.24.0", "0.17.0"]);

  const categoryNames = {
    world: { label: "Мир и Город", cls: "cat-world" },
    craft: { label: "Выживание и Крафт", cls: "cat-craft" },
    character: { label: "Персонаж и Анимации", cls: "cat-character" },
    combat: { label: "Зомби, Бой и Постройки", cls: "cat-combat" },
    network: { label: "Сеть и Кооператив", cls: "cat-network" },
    ui: { label: "Интерфейс и Меню", cls: "cat-ui" },
    perf: { label: "Оптимизация и Фиксы", cls: "cat-perf" }
  };

  // Read version from ../VERSION when served over HTTP, fallback to data.fallbackVersion on file://
  async function loadLiveVersion() {
    let ver = data.fallbackVersion;
    try {
      const res = await fetch("./VERSION", { cache: "no-store" });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (/^\d+\.\d+\.\d+$/.test(text)) {
          ver = text;
        }
      }
    } catch (_) {
      // file:// protocol in browser blocks fetch; use fallbackVersion read from VERSION at build time
    }
    document.querySelectorAll("[data-live-version]").forEach((el) => {
      el.textContent = ver;
    });
  }

  function matchesVersion(v) {
    if (activeCategory === "milestone" && !v.milestone) return false;
    if (activeCategory !== "all" && activeCategory !== "milestone" && !v.categories.includes(activeCategory)) {
      return false;
    }
    if (activeAuthor !== "all") {
      if (!v.author.toLowerCase().includes(activeAuthor.toLowerCase())) return false;
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      const haystack = [
        v.version,
        v.title,
        v.summary,
        v.author,
        v.commit,
        v.tech || "",
        ...(v.improvements || [])
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }

  function getFilteredVersions() {
    const filtered = data.versions.filter(matchesVersion);
    if (sortDirection === "asc") {
      return [...filtered].reverse();
    }
    return filtered;
  }

  function renderCategoryPills() {
    const container = document.getElementById("category-pills");
    if (!container) return;

    container.innerHTML = data.categories
      .map((cat) => {
        const count =
          cat.id === "all"
            ? data.versions.length
            : cat.id === "milestone"
            ? data.versions.filter((v) => v.milestone).length
            : data.versions.filter((v) => v.categories.includes(cat.id)).length;
        const activeCls = activeCategory === cat.id ? "active" : "";
        return `
          <button class="filter-pill ${activeCls}" data-cat="${cat.id}" type="button">
            <span>${cat.label}</span>
            <span class="filter-count">${count}</span>
          </button>
        `;
      })
      .join("");

    container.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.getAttribute("data-cat") || "all";
        renderCategoryPills();
        renderTimeline();
      });
    });
  }

  function renderJumpStrip() {
    const strip = document.getElementById("version-jump-strip");
    if (!strip) return;
    strip.innerHTML = data.versions
      .map((v) => {
        const majorCls = v.milestone ? "major-chip" : "";
        const safeId = "ver-" + v.version.replace(/[^a-zA-Z0-9]/g, "-");
        return `<button type="button" class="jump-chip ${majorCls}" data-jump="${safeId}" data-ver="${v.version}">v${v.version}</button>`;
      })
      .join("");

    strip.querySelectorAll(".jump-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const ver = chip.getAttribute("data-ver");
        const targetId = chip.getAttribute("data-jump");
        if (ver) openVersions.add(ver);
        activeCategory = "all";
        activeAuthor = "all";
        searchQuery = "";
        const searchEl = document.getElementById("version-search");
        if (searchEl) searchEl.value = "";
        const authorEl = document.getElementById("author-filter");
        if (authorEl) authorEl.value = "all";
        renderCategoryPills();
        renderTimeline();
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  function renderTimeline() {
    const container = document.getElementById("version-timeline");
    const summaryEl = document.getElementById("results-count");
    if (!container) return;

    const list = getFilteredVersions();
    if (summaryEl) {
      summaryEl.textContent = `Показано версий: ${list.length} из ${data.versions.length}`;
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="bench-card" style="text-align:center; padding: 36px;">
          <h4>По вашему запросу версий не найдено</h4>
          <p style="color: var(--text-secondary); margin-top: 8px;">Попробуйте сбросить фильтры или изменить поисковый запрос.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list
      .map((v) => {
        const isOpen = openVersions.has(v.version);
        const safeId = "ver-" + v.version.replace(/[^a-zA-Z0-9]/g, "-");
        const badgeCls = v.type === "patch" ? "patch" : v.type === "proto" ? "proto" : "";
        const milestoneCls = v.milestone ? "milestone" : "";
        const currentCls = v.current ? "current-release" : "";
        const openCls = isOpen ? "open" : "";
        const hasMedia = Array.isArray(v.media) && v.media.length > 0;

        const tagsHtml = (v.categories || [])
          .map((c) => {
            const info = categoryNames[c] || { label: c, cls: "" };
            return `<span class="cat-tag ${info.cls}">${info.label}</span>`;
          })
          .join("");

        const improvementsHtml = (v.improvements || [])
          .map((item) => `<li>${item}</li>`)
          .join("");

        const mediaHtml = hasMedia
          ? `<div class="version-media">
              ${v.media
                .map(
                  (m) => `
                <div class="version-media-card" data-lightbox-src="${m.src}" data-lightbox-caption="${m.caption}">
                  <img src="${m.src}" alt="${m.caption}" loading="lazy" />
                  <div class="version-media-caption">${m.caption}</div>
                </div>
              `
                )
                .join("")}
            </div>`
          : "";

        return `
          <article class="version-card ${milestoneCls} ${currentCls} ${openCls}" id="${safeId}" data-version="${v.version}">
            <div class="timeline-node"></div>
            <div class="version-header" data-toggle-ver="${v.version}">
              <div class="version-header-left">
                <div class="version-meta-row">
                  <span class="ver-badge ${badgeCls}">v${v.version}</span>
                  ${v.current ? `<span class="cat-tag cat-perf">Текущая версия</span>` : ""}
                  <span class="ver-date">${v.date}</span>
                  <span class="ver-author">Автор: ${v.author}</span>
                  <span class="ver-commit">Commit: ${v.commit}</span>
                </div>
                <h3 class="ver-title">${v.title}</h3>
                <p class="ver-summary">${v.summary}</p>
                <div class="ver-tags">${tagsHtml}</div>
              </div>
              <div class="expand-toggle" title="Развернуть / свернуть подробности">▼</div>
            </div>
            <div class="version-body">
              <div class="version-details-grid ${hasMedia ? "has-media" : ""}">
                <div>
                  <ul class="improvements-list">
                    ${improvementsHtml}
                  </ul>
                  ${
                    v.tech
                      ? `<div class="tech-box">
                          <div class="tech-box-title">Технические детали, файлы и проверки</div>
                          <div>${v.tech}</div>
                        </div>`
                      : ""
                  }
                </div>
                ${mediaHtml}
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    container.querySelectorAll("[data-toggle-ver]").forEach((header) => {
      header.addEventListener("click", () => {
        const ver = header.getAttribute("data-toggle-ver");
        if (!ver) return;
        const card = header.closest(".version-card");
        if (openVersions.has(ver)) {
          openVersions.delete(ver);
          card?.classList.remove("open");
        } else {
          openVersions.add(ver);
          card?.classList.add("open");
        }
      });
    });

    bindLightboxTriggers(container);
  }

  function renderItems() {
    const container = document.getElementById("items-catalog");
    if (!container || !data.items) return;

    container.innerHTML = data.items
      .map(
        (item) => `
        <div class="item-card">
          <div class="item-icon-box">
            <img src="${item.icon}" alt="${item.name}" loading="lazy" />
          </div>
          <div class="item-info">
            <h4>${item.name}</h4>
            <span class="item-id">${item.id}</span>
            <p class="item-desc">${item.role}</p>
            <div class="item-stats">
              <span class="item-stat-pill">Урон: ${item.damage}</span>
              <span class="item-stat-pill">Стаки: до ${item.stack}</span>
            </div>
          </div>
        </div>
      `
      )
      .join("");
  }

  function renderGallery() {
    const container = document.getElementById("gallery-grid");
    if (!container || !data.gallery) return;

    container.innerHTML = data.gallery
      .map(
        (g) => `
        <div class="gallery-item" data-lightbox-src="${g.src}" data-lightbox-caption="${g.title} — ${g.desc}">
          <img src="${g.src}" alt="${g.title}" loading="lazy" />
          <div class="gallery-caption">
            <h4>${g.title}</h4>
            <p>${g.desc}</p>
          </div>
        </div>
      `
      )
      .join("");

    bindLightboxTriggers(container);
  }

  function renderIdeas() {
    const container = document.getElementById("ideas-grid");
    if (!container || !data.ideas) return;

    container.innerHTML = data.ideas
      .map(
        (idea) => `
        <div class="idea-card ${idea.done ? "implemented" : ""}">
          <div class="idea-top">
            <span class="idea-num">Идея #${String(idea.num).padStart(2, "0")}</span>
            <span class="idea-status ${idea.done ? "done" : ""}">${idea.status}</span>
          </div>
          <h4>${idea.title}</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">${idea.desc}</p>
        </div>
      `
      )
      .join("");
  }

  function bindLightboxTriggers(root = document) {
    const lightbox = document.getElementById("lightbox");
    const lbImg = document.getElementById("lightbox-img");
    const lbCap = document.getElementById("lightbox-caption");
    if (!lightbox || !lbImg || !lbCap) return;

    root.querySelectorAll("[data-lightbox-src]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const src = el.getAttribute("data-lightbox-src");
        const cap = el.getAttribute("data-lightbox-caption") || "";
        if (src) {
          lbImg.src = src;
          lbCap.textContent = cap;
          lightbox.classList.add("open");
        }
      });
    });
  }

  function initControls() {
    const searchEl = document.getElementById("version-search");
    if (searchEl) {
      searchEl.addEventListener("input", () => {
        searchQuery = searchEl.value;
        renderTimeline();
      });
    }

    const authorEl = document.getElementById("author-filter");
    if (authorEl) {
      authorEl.addEventListener("change", () => {
        activeAuthor = authorEl.value;
        renderTimeline();
      });
    }

    const sortEl = document.getElementById("sort-order");
    if (sortEl) {
      sortEl.addEventListener("change", () => {
        sortDirection = sortEl.value;
        renderTimeline();
      });
    }

    const expandAllBtn = document.getElementById("expand-all-btn");
    if (expandAllBtn) {
      expandAllBtn.addEventListener("click", () => {
        data.versions.forEach((v) => openVersions.add(v.version));
        renderTimeline();
      });
    }

    const collapseAllBtn = document.getElementById("collapse-all-btn");
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener("click", () => {
        openVersions.clear();
        renderTimeline();
      });
    }

    const lightbox = document.getElementById("lightbox");
    const lbClose = document.getElementById("lightbox-close");
    if (lightbox) {
      lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox) lightbox.classList.remove("open");
      });
    }
    if (lbClose && lightbox) {
      lbClose.addEventListener("click", () => lightbox.classList.remove("open"));
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lightbox) {
        lightbox.classList.remove("open");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadLiveVersion();
    renderCategoryPills();
    renderJumpStrip();
    renderTimeline();
    renderItems();
    renderGallery();
    renderIdeas();
    initControls();
    bindLightboxTriggers(document);
  });
})();

