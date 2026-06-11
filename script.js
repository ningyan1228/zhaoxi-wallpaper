const FILTERS = ["全部", "头像", "手机壁纸", "横屏壁纸", "动漫", "风景", "足球", "文字壁纸"];
const USAGE_FILTERS = new Set(["头像", "手机壁纸", "横屏壁纸"]);
const HOT_RANGE_LABELS = {
  yesterday: "昨日热门",
  "3d": "近三天热门",
  "7d": "近一周热门",
  year: "今年热榜",
};
const GALLERY_PAGE_SIZE = 12;
const HOT_PAGE_SIZE = 8;
const NETLIFY_API_ORIGIN = "https://zhaoxi-wallpaper-20260609.netlify.app";

const state = {
  wallpapers: [],
  activeCategory: "全部",
  activeHotRange: "3d",
  galleryPage: 1,
  hotPage: 1,
  hotRequestId: 0,
  hotEntries: [],
  query: "",
  activeWallpaper: null,
};

const fallbackSeeds = [
  ["晨光蓝调头像", "images/avatar-morning-blue.webp", "头像", "头像", ["头像", "蓝色", "清晨", "极简"]],
  ["霓虹侧脸头像", "images/avatar-neon-profile.webp", "头像", "头像", ["头像", "霓虹", "侧脸", "赛博"]],
  ["月影黑金头像", "images/avatar-moon-gold.webp", "头像", "头像", ["头像", "黑金", "月亮", "高级感"]],
  ["星空少女动漫", "images/anime-starry-girl.webp", "动漫", "横屏壁纸", ["动漫", "星空", "少女", "梦幻"]],
  ["森林雾光风景", "images/landscape-forest-mist.webp", "风景", "横屏壁纸", ["风景", "森林", "雾光", "清新"]],
  ["梅西阿根廷世界杯", "images/football-messi-argentina.webp", "足球", "横屏壁纸", ["梅西", "阿根廷", "世界杯", "足球"]],
  ["手机蓝色光影", "images/phone-wallpaper-blue.webp", "手机壁纸", "手机壁纸", ["手机壁纸", "蓝色", "光影"]],
  ["心之力文字壁纸", "images/text-heart-power.webp", "文字壁纸", "横屏壁纸", ["文字", "心之力", "励志"]],
];

const fallbackWallpapers = fallbackSeeds.map(([title, image, category, usage, tags], index) => ({
  id: index + 1,
  title,
  cover: image,
  preview: image,
  category,
  usage,
  tags,
  quarkUrl: `https://pan.quark.cn/s/demo${String(index + 1).padStart(3, "0")}`,
}));

const els = {
  main: document.querySelector("main"),
  gallery: document.querySelector("#gallery"),
  searchInput: document.querySelector("#searchInput"),
  filterButtons: document.querySelectorAll(".filter-btn"),
  hotTabs: document.querySelectorAll(".hot-tab"),
  hotRankSection: document.querySelector(".hot-rank"),
  gallerySection: document.querySelector(".gallery-shell"),
  galleryTitle: document.querySelector("#galleryTitle"),
  hotRankTitle: document.querySelector("#hotRankTitle"),
  hotRankGrid: document.querySelector("#hotRankGrid"),
  hotRankEmpty: document.querySelector("#hotRankEmpty"),
  hotRankStatus: document.querySelector("#hotRankStatus"),
  hotPagination: document.querySelector("#hotPagination"),
  galleryPagination: document.querySelector("#galleryPagination"),
  resultCount: document.querySelector("#resultCount"),
  totalCount: document.querySelector("#totalCount"),
  categoryCount: document.querySelector("#categoryCount"),
  emptyState: document.querySelector("#emptyState"),
  modal: document.querySelector("#modal"),
  modalImage: document.querySelector("#modalImage"),
  modalTitle: document.querySelector("#modalTitle"),
  modalCategory: document.querySelector("#modalCategory"),
  modalTags: document.querySelector("#modalTags"),
  downloadBtn: document.querySelector("#downloadBtn"),
  recommendations: document.querySelector("#recommendations"),
};

const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      cardObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const image = entry.target;
      image.src = image.dataset.src;
      imageObserver.unobserve(image);
    }
  });
}, { rootMargin: "260px" });

async function init() {
  try {
    const response = await fetch("wallpapers.json");
    if (!response.ok) throw new Error("wallpapers.json 加载失败");
    state.wallpapers = (await response.json()).map(normalizeWallpaper);
  } catch (error) {
    console.error(error);
    state.wallpapers = fallbackWallpapers.map(normalizeWallpaper);
  }

  els.totalCount.textContent = state.wallpapers.length;
  if (els.categoryCount) els.categoryCount.textContent = FILTERS.length;

  bindEvents();
  renderGallery();
  renderHotRank();
  syncSectionOrder();
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    state.galleryPage = 1;
    state.hotPage = 1;
    renderPage();
  });

  els.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCategory = button.dataset.category;
      state.galleryPage = 1;
      state.hotPage = 1;
      els.filterButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderPage();
    });
  });

  els.hotTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeHotRange = button.dataset.range;
      state.hotPage = 1;
      els.hotTabs.forEach((item) => item.classList.toggle("active", item === button));
      renderHotRank();
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((node) => {
    node.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.modal.classList.contains("open")) closeModal();
  });

  els.downloadBtn.addEventListener("click", () => {
    if (state.activeWallpaper?.quarkUrl) {
      window.open(state.activeWallpaper.quarkUrl, "_blank", "noopener,noreferrer");
    }
  });
}

function getFilteredWallpapers() {
  return state.wallpapers.filter((item) => {
    const active = state.activeCategory;
    const matchesCategory = active === "全部"
      || (USAGE_FILTERS.has(active) ? item.usage === active : item.category === active);
    const searchable = `${item.title} ${item.category} ${item.usage} ${item.tags.join(" ")}`.toLowerCase();
    const matchesQuery = !state.query || searchable.includes(state.query);
    return matchesCategory && matchesQuery;
  });
}

function getScopedWallpapers() {
  return getFilteredWallpapers();
}

function getCurrentScope() {
  const hasQuery = Boolean(state.query);
  const hasCategory = state.activeCategory !== "全部";
  return {
    isScoped: hasQuery || hasCategory,
    label: getScopeLabel(),
  };
}

function getScopeLabel() {
  if (state.query && state.activeCategory !== "全部") {
    return `${state.activeCategory} · ${state.query}`;
  }

  if (state.query) {
    return state.query;
  }

  if (state.activeCategory !== "全部") {
    return state.activeCategory;
  }

  return "全站";
}

function getGalleryTitle() {
  if (state.query && state.activeCategory !== "全部") {
    return `${state.activeCategory}：${state.query}`;
  }

  if (state.query) {
    return `搜索：${state.query}`;
  }

  if (state.activeCategory !== "全部") {
    return state.activeCategory;
  }

  return "精选壁纸";
}

function getHotRankTitle(scope = getCurrentScope()) {
  return scope.isScoped ? `${scope.label}热门榜` : "全站热榜";
}

function syncSectionOrder() {
  const scope = getCurrentScope();
  const parent = els.gallerySection.parentElement;
  els.main.classList.toggle("scoped-view", scope.isScoped);

  if (scope.isScoped) {
    parent.insertBefore(els.gallerySection, els.hotRankSection);
  } else {
    parent.insertBefore(els.hotRankSection, els.gallerySection);
  }
}

function renderGallery() {
  const list = getFilteredWallpapers();
  const totalPages = getTotalPages(list.length, GALLERY_PAGE_SIZE);
  state.galleryPage = clampPage(state.galleryPage, totalPages);
  const pageItems = paginate(list, state.galleryPage, GALLERY_PAGE_SIZE);

  els.gallery.innerHTML = "";
  els.emptyState.hidden = list.length > 0;
  updateGalleryEmptyState();
  els.galleryTitle.textContent = getGalleryTitle();
  els.resultCount.textContent = list.length
    ? `${list.length} 张壁纸 · 第 ${state.galleryPage} / ${totalPages} 页`
    : "0 张壁纸";

  const fragment = document.createDocumentFragment();
  pageItems.forEach((item) => {
    fragment.appendChild(createWallpaperCard(item));
  });

  els.gallery.appendChild(fragment);
  renderPagination(els.galleryPagination, state.galleryPage, totalPages, (page) => {
    state.galleryPage = page;
    renderGallery();
    scrollToSection(els.gallerySection);
  });
  observeCards(els.gallery);
  observeLazyImages(els.gallery);
}

function updateGalleryEmptyState() {
  const title = els.emptyState.querySelector("strong");
  const detail = els.emptyState.querySelector("span");

  if (state.query) {
    title.textContent = "没有找到匹配的壁纸";
    detail.textContent = "换个关键词或分类试试看。";
    return;
  }

  title.textContent = "这个分类暂时没有壁纸";
  detail.textContent = "后续添加图片后这里会自动显示。";
}

async function renderHotRank() {
  const requestId = ++state.hotRequestId;
  const scope = getCurrentScope();
  els.hotRankStatus.textContent = "正在加载...";
  els.hotRankTitle.textContent = getHotRankTitle(scope);
  els.hotRankGrid.innerHTML = "";
  els.hotRankEmpty.hidden = true;

  try {
    const response = await fetch(apiUrl(`/api/hot-rank?range=${encodeURIComponent(state.activeHotRange)}&limit=500`));
    if (!response.ok) throw new Error("热榜加载失败");
    const payload = await response.json();
    if (requestId !== state.hotRequestId) return;

    const scopedIds = new Set(getScopedWallpapers().map((item) => item.id));
    state.hotEntries = (payload.items || [])
      .map((entry) => ({
        count: entry.count,
        wallpaper: state.wallpapers.find((item) => item.id === Number(entry.id)),
      }))
      .filter((entry) => entry.wallpaper)
      .filter((entry) => !scope.isScoped || scopedIds.has(entry.wallpaper.id));

    renderHotCards(scope);
  } catch (error) {
    if (requestId !== state.hotRequestId) return;
    console.warn(error);
    state.hotEntries = [];
    renderHotCards(scope);
  }
}

function renderHotCards(scope = getCurrentScope()) {
  const totalPages = getTotalPages(state.hotEntries.length, HOT_PAGE_SIZE);
  state.hotPage = clampPage(state.hotPage, totalPages);
  const ranked = paginate(state.hotEntries, state.hotPage, HOT_PAGE_SIZE);

  els.hotRankGrid.innerHTML = "";
  els.hotRankEmpty.hidden = state.hotEntries.length > 0;
  els.hotRankStatus.textContent = state.hotEntries.length
    ? `${HOT_RANGE_LABELS[state.activeHotRange]} ${state.hotEntries.length} 张 · 第 ${state.hotPage} / ${totalPages} 页`
    : "暂无数据";
  els.hotRankEmpty.querySelector("strong").textContent = "暂无热门点击";
  els.hotRankEmpty.querySelector("span").textContent = scope.isScoped
    ? "这个范围有点击记录后会自动更新。"
    : "有点击记录后这里会自动更新。";

  const fragment = document.createDocumentFragment();
  ranked.forEach(({ wallpaper, count }) => {
    fragment.appendChild(createWallpaperCard(wallpaper, { count }));
  });

  els.hotRankGrid.appendChild(fragment);
  renderPagination(els.hotPagination, state.hotPage, totalPages, (page) => {
    state.hotPage = page;
    renderHotCards(scope);
    scrollToSection(els.hotRankSection);
  });
  observeCards(els.hotRankGrid);
  observeLazyImages(els.hotRankGrid);
}

function renderPage() {
  syncSectionOrder();
  renderGallery();
  renderHotRank();
}

function renderPagination(container, currentPage, totalPages, onChange) {
  container.innerHTML = "";
  container.hidden = totalPages <= 1;
  if (totalPages <= 1) return;

  const fragment = document.createDocumentFragment();
  fragment.appendChild(createPageButton("←", currentPage - 1, currentPage === 1, onChange, "上一页"));

  getVisiblePages(currentPage, totalPages).forEach((item) => {
    if (item === "ellipsis") {
      const ellipsis = document.createElement("span");
      ellipsis.className = "page-ellipsis";
      ellipsis.textContent = "...";
      fragment.appendChild(ellipsis);
      return;
    }

    fragment.appendChild(createPageButton(String(item), item, false, onChange, `第 ${item} 页`, item === currentPage));
  });

  const form = document.createElement("form");
  form.className = "page-jump";
  form.innerHTML = `
    <input type="number" min="1" max="${totalPages}" inputmode="numeric" aria-label="跳转页码">
    <button type="submit">Go</button>
  `;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.querySelector("input");
    const nextPage = clampPage(Number(input.value), totalPages);
    input.value = "";
    onChange(nextPage);
  });

  fragment.appendChild(form);
  fragment.appendChild(createPageButton("→", currentPage + 1, currentPage === totalPages, onChange, "下一页"));
  container.appendChild(fragment);
}

function createPageButton(label, page, disabled, onChange, ariaLabel, active = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `page-btn${active ? " active" : ""}`;
  button.textContent = label;
  button.disabled = disabled;
  button.setAttribute("aria-label", ariaLabel);
  if (active) button.setAttribute("aria-current", "page");
  button.addEventListener("click", () => onChange(page));
  return button;
}

function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  if (currentPage <= 4) {
    [2, 3, 4, 5].forEach((page) => pages.add(page));
  }
  if (currentPage >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1].forEach((page) => pages.add(page));
  }

  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((page, index) => {
    if (index === 0) return [page];
    return page - sorted[index - 1] > 1 ? ["ellipsis", page] : [page];
  });
}

function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function getTotalPages(totalItems, pageSize) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

function clampPage(page, totalPages) {
  const next = Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.min(Math.max(next, 1), totalPages);
}

function scrollToSection(section) {
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createWallpaperCard(item, options = {}) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "wallpaper-card";
  card.style.setProperty("--ratio", getRatio(item));
  card.innerHTML = `
    <div class="wallpaper-thumb">
      ${imageMarkup(item.cover, item.title)}
    </div>
    <div class="card-body">
      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      ${cardPillsMarkup(item, options.count)}
    </div>
  `;
  card.addEventListener("click", () => openModal(item));
  return card;
}

function openModal(item) {
  state.activeWallpaper = item;
  els.modalTitle.textContent = item.title;
  els.modalCategory.textContent = item.category === item.usage ? item.category : `${item.category} · ${item.usage}`;
  els.modalTags.innerHTML = item.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");

  replaceModalImage(item);
  renderRecommendations(item);
  trackWallpaperClick(item);

  els.modal.classList.add("open");
  els.modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  els.downloadBtn.focus();
}

function closeModal() {
  els.modal.classList.remove("open");
  els.modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  state.activeWallpaper = null;
}

function renderRecommendations(item) {
  const related = shuffle(state.wallpapers.filter((wallpaper) => (
    wallpaper.category === item.category && wallpaper.id !== item.id
  ))).slice(0, 4);

  els.recommendations.innerHTML = related.map((wallpaper) => `
    <button class="recommend-card" type="button" data-id="${wallpaper.id}" style="--ratio: ${getRatio(wallpaper)}">
      ${imageMarkup(wallpaper.cover, wallpaper.title)}
      <span>${escapeHtml(wallpaper.title)}</span>
    </button>
  `).join("");

  els.recommendations.querySelectorAll(".recommend-card").forEach((card) => {
    card.addEventListener("click", () => {
      const next = state.wallpapers.find((wallpaper) => wallpaper.id === Number(card.dataset.id));
      if (next) openModal(next);
    });
  });
  observeLazyImages(els.recommendations);
}

function trackWallpaperClick(item) {
  if (!item?.id || window.location.protocol === "file:") return;

  fetch(apiUrl("/api/track-click"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: item.id }),
    keepalive: true,
  })
    .then((response) => {
      if (response.ok) renderHotRank();
    })
    .catch(() => {});
}

function apiUrl(path) {
  const configuredOrigin = window.ZHAOXI_API_ORIGIN || "";
  const origin = configuredOrigin || (window.location.hostname.endsWith(".github.io") ? NETLIFY_API_ORIGIN : "");
  return `${origin}${path}`;
}

function replaceModalImage(item) {
  const image = els.modalImage;
  image.alt = item.title;
  image.src = item.preview;
  image.hidden = false;

  const existingFallback = image.parentElement.querySelector(".image-fallback");
  if (existingFallback) existingFallback.remove();

  image.onerror = () => {
    image.hidden = true;
    image.insertAdjacentHTML("afterend", fallbackMarkup(item.title));
  };
}

function observeCards(root) {
  root.querySelectorAll(".wallpaper-card").forEach((card) => cardObserver.observe(card));
}

function observeLazyImages(root) {
  root.querySelectorAll("img[data-src]").forEach((image) => {
    image.addEventListener("error", () => replaceWithFallback(image), { once: true });
    imageObserver.observe(image);
  });
}

function imageMarkup(src, title) {
  return `<img data-src="${escapeAttribute(src)}" alt="${escapeAttribute(title)}" loading="lazy">`;
}

function cardPillsMarkup(item, count) {
  const category = item.category || item.usage;
  const usage = item.usage || inferUsageFromCategory(category);
  const usagePill = category === usage ? "" : `<span class="usage-pill">${escapeHtml(usage)}</span>`;
  const rankPill = Number.isFinite(count) ? `<span class="rank-badge">${count} 次</span>` : "";

  return `
    <div class="card-pills">
      <span class="category-pill">${escapeHtml(category)}</span>
      ${usagePill}
      ${rankPill}
    </div>
  `;
}

function fallbackMarkup(title) {
  return `<div class="image-fallback"><span>${escapeHtml(title)}</span></div>`;
}

function replaceWithFallback(image) {
  image.insertAdjacentHTML("afterend", fallbackMarkup(image.alt || "朝夕壁纸"));
  image.remove();
}

function normalizeWallpaper(item) {
  const category = item.category || "横屏壁纸";
  const usage = item.usage || inferUsageFromCategory(category);
  return {
    ...item,
    category,
    usage,
    tags: Array.isArray(item.tags) ? item.tags : [],
  };
}

function inferUsageFromCategory(category) {
  return USAGE_FILTERS.has(category) ? category : "横屏壁纸";
}

function getRatio(item) {
  const usage = item.usage || inferUsageFromCategory(item.category);
  if (usage === "头像") return "1 / 1";
  if (usage === "手机壁纸") return "9 / 16";
  return "16 / 9";
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

init();
