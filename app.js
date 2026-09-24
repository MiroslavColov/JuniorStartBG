const STORAGE = {
  SAVED: "juniorstart_saved_jobs_v2"
};

const FILTER_OPTIONS = {
  cities: ["София", "Пловдив", "Варна", "Бургас", "Русе", "Плевен", "Дистанционно"],
  types: ["Стаж", "Junior", "Практика"],
  sectors: ["ИТ", "Дизайн", "Маркетинг", "Финанси", "Продажби", "Инженерство", "Администрация", "Друг"]
};

const state = {
  view: "home",
  jobs: [],
  loading: true,
  dbReady: false,
  filters: {
    search: "",
    city: "",
    type: "",
    sector: "",
    sort: "newest"
  },
  saved: readJSON(STORAGE.SAVED, [])
};

let db = null;

function readJSON(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function createDatabaseClient() {
  const config = window.JUNIORSTART_CONFIG || {};
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabasePublishableKey || "").trim();

  if (!url || !key) {
    showNotice(
      "Supabase още не е конфигуриран. В Cloudflare Pages добави SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY, след което пусни нов deploy.",
      "error"
    );
    return null;
  }

  if (!window.supabase?.createClient) {
    showNotice("Supabase библиотеката не успя да се зареди. Провери интернет връзката или CDN достъпа.", "error");
    return null;
  }

  return window.supabase.createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

function showNotice(message, type = "") {
  const el = document.getElementById("configNotice");
  if (!el) return;
  el.textContent = message;
  el.className = `system-notice ${type}`.trim();
}

function hideNotice() {
  const el = document.getElementById("configNotice");
  if (el) el.classList.add("hidden");
}

async function loadJobs() {
  if (!db) {
    state.jobs = [];
    state.loading = false;
    renderAll();
    return;
  }

  state.loading = true;
  renderJobs();
  renderHomeJobs();

  const { data, error } = await db
    .from("jobs")
    .select("id,title,company,city,job_type,sector,description,requirements,apply_url,created_at,expires_at,featured,status")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase load error:", error);
    state.jobs = [];
    state.loading = false;
    showNotice(`Не успях да заредя обявите от Supabase: ${error.message}`, "error");
    renderAll();
    return;
  }

  state.jobs = (data || []).map(fromDbJob);
  state.loading = false;
  state.dbReady = true;
  hideNotice();
  renderAll();
}

function fromDbJob(row) {
  return {
    id: String(row.id),
    title: row.title || "",
    company: row.company || "",
    city: row.city || "",
    type: row.job_type || "",
    sector: row.sector || "",
    description: row.description || "",
    requirements: Array.isArray(row.requirements) ? row.requirements : [],
    date: row.created_at ? String(row.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
    applyUrl: row.apply_url || "",
    expiresAt: row.expires_at || null,
    featured: Boolean(row.featured)
  };
}

function allJobs() {
  return state.jobs;
}

function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "J";
}

function bgDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function relativeDate(dateString) {
  const now = new Date();
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.max(0, Math.floor((now - date) / 86400000));
  if (days === 0) return "Днес";
  if (days === 1) return "Вчера";
  if (days < 7) return `Преди ${days} дни`;
  return bgDate(dateString);
}

function isSaved(id) {
  return state.saved.includes(String(id));
}

function toggleSaved(id) {
  const stringId = String(id);
  if (isSaved(stringId)) {
    state.saved = state.saved.filter(item => item !== stringId);
    toast("Премахнато от запазени");
  } else {
    state.saved.push(stringId);
    toast("Обявата е запазена");
  }

  writeJSON(STORAGE.SAVED, state.saved);
  renderSavedCount();
  renderHomeJobs();
  renderJobs();
  renderSavedJobs();
}

function populateSelect(select, values, placeholder) {
  if (!select) return;
  const current = select.value;
  select.innerHTML =
    `<option value="">${placeholder}</option>` +
    values.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("");
  if (values.includes(current)) select.value = current;
}

function renderSelects() {
  populateSelect(document.getElementById("cityFilter"), FILTER_OPTIONS.cities, "Всички градове");
  populateSelect(document.getElementById("typeFilter"), FILTER_OPTIONS.types, "Всички типове");
  populateSelect(document.getElementById("sectorFilter"), FILTER_OPTIONS.sectors, "Всички сектори");
  populateSelect(document.getElementById("heroCity"), FILTER_OPTIONS.cities, "Навсякъде");
}

function getFilteredJobs() {
  const search = state.filters.search.trim().toLocaleLowerCase("bg");

  let jobs = allJobs().filter(job => {
    const searchable = `${job.title} ${job.company} ${job.description} ${job.sector}`.toLocaleLowerCase("bg");
    return (!search || searchable.includes(search)) &&
      (!state.filters.city || job.city === state.filters.city) &&
      (!state.filters.type || job.type === state.filters.type) &&
      (!state.filters.sector || job.sector === state.filters.sector);
  });

  if (state.filters.sort === "newest") {
    jobs.sort((a, b) => b.date.localeCompare(a.date));
  } else if (state.filters.sort === "oldest") {
    jobs.sort((a, b) => a.date.localeCompare(b.date));
  } else {
    jobs.sort((a, b) => a.company.localeCompare(b.company, "bg"));
  }

  return jobs;
}

function jobCard(job) {
  const saved = isSaved(job.id);
  return `
    <article class="job-card">
      <div class="job-card-top">
        <div class="job-logo">${escapeHTML(initials(job.company))}</div>
        <div>
          <div class="job-card-company">${escapeHTML(job.company)}</div>
          <h3>${escapeHTML(job.title)}</h3>
        </div>
        <button class="save-btn ${saved ? "saved" : ""}" data-save-job="${escapeHTML(job.id)}" aria-label="${saved ? "Премахни от запазени" : "Запази обявата"}">
          ${saved ? "♥" : "♡"}
        </button>
      </div>
      <div class="tags">
        <span class="tag blue">${escapeHTML(job.type)}</span>
        <span class="tag">${escapeHTML(job.city)}</span>
        <span class="tag green">${escapeHTML(job.sector)}</span>
      </div>
      <p>${escapeHTML(job.description)}</p>
      <div class="job-card-bottom">
        <span class="job-date">${escapeHTML(relativeDate(job.date))}</span>
        <button class="details-btn" data-job-details="${escapeHTML(job.id)}">Виж детайли →</button>
      </div>
    </article>
  `;
}

function jobRow(job) {
  const saved = isSaved(job.id);
  return `
    <article class="job-row">
      <div class="job-row-main">
        <div class="job-logo">${escapeHTML(initials(job.company))}</div>
        <div class="job-row-info">
          <div class="job-row-company">${escapeHTML(job.company)}</div>
          <h3>${escapeHTML(job.title)}</h3>
          <div class="job-row-tags">
            <span class="tag blue">${escapeHTML(job.type)}</span>
            <span class="tag">${escapeHTML(job.city)}</span>
            <span class="tag green">${escapeHTML(job.sector)}</span>
            <span class="tag">${escapeHTML(relativeDate(job.date))}</span>
          </div>
        </div>
      </div>
      <div class="job-row-actions">
        <button class="save-btn ${saved ? "saved" : ""}" data-save-job="${escapeHTML(job.id)}" aria-label="${saved ? "Премахни от запазени" : "Запази обявата"}">${saved ? "♥" : "♡"}</button>
        <button class="details-btn" data-job-details="${escapeHTML(job.id)}">Детайли</button>
      </div>
    </article>
  `;
}

function renderHomeStats() {
  const jobs = allJobs();
  document.getElementById("statJobs").textContent = jobs.length;
  document.getElementById("statCompanies").textContent = new Set(jobs.map(job => job.company)).size;
  document.getElementById("statRemote").textContent = jobs.filter(job => job.city === "Дистанционно").length;
  document.getElementById("statInternships").textContent = jobs.filter(job => job.type === "Стаж").length;

  const latest = document.getElementById("heroLatestJobs");
  if (state.loading) {
    latest.innerHTML = `<div class="loading-state">Зареждане на обявите…</div>`;
    return;
  }

  if (!jobs.length) {
    latest.innerHTML = `<div class="loading-state">Все още няма одобрени обяви.</div>`;
    return;
  }

  latest.innerHTML = [...jobs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)
    .map(job => `
      <button class="mini-job" data-job-details="${escapeHTML(job.id)}" style="width:100%;background:transparent;color:inherit;border:0;text-align:left;">
        <span class="company-avatar">${escapeHTML(initials(job.company))}</span>
        <span>
          <div class="mini-job-title">${escapeHTML(job.title)}</div>
          <div class="mini-job-meta">${escapeHTML(job.company)} · ${escapeHTML(job.city)}</div>
        </span>
        <span class="mini-job-type">${escapeHTML(job.type)}</span>
      </button>
    `).join("");
}

function renderHomeJobs() {
  const grid = document.getElementById("homeJobGrid");

  if (state.loading) {
    grid.innerHTML = `<div class="loading-state">Зареждане…</div>`;
    return;
  }

  if (!allJobs().length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">⌁</div>
      <h3>Все още няма публикувани обяви</h3>
      <p>След като одобриш първата позиция в Supabase, тя ще се появи тук автоматично.</p>
    </div>`;
    return;
  }

  grid.innerHTML = [...allJobs()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)
    .map(jobCard)
    .join("");
}

function renderActiveFilters() {
  const items = [];
  if (state.filters.search) items.push(`Търсене: ${state.filters.search}`);
  if (state.filters.city) items.push(state.filters.city);
  if (state.filters.type) items.push(state.filters.type);
  if (state.filters.sector) items.push(state.filters.sector);

  document.getElementById("activeFilters").innerHTML = items
    .map(item => `<span class="filter-pill">${escapeHTML(item)}</span>`)
    .join("");
}

function renderJobs() {
  const list = document.getElementById("jobsList");
  const empty = document.getElementById("jobsEmpty");

  if (state.loading) {
    document.getElementById("resultsCount").textContent = "0";
    list.innerHTML = `<div class="loading-state">Зареждане на обявите от Supabase…</div>`;
    empty.classList.add("hidden");
    return;
  }

  const jobs = getFilteredJobs();
  document.getElementById("resultsCount").textContent = jobs.length;
  renderActiveFilters();

  if (!jobs.length) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  list.innerHTML = jobs.map(jobRow).join("");
}

function renderSavedCount() {
  document.getElementById("savedCountBadge").textContent = state.saved.length;
}

function renderSavedJobs() {
  const jobs = allJobs().filter(job => state.saved.includes(String(job.id)));
  const list = document.getElementById("savedJobsList");
  const empty = document.getElementById("savedEmpty");

  if (!jobs.length) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  list.innerHTML = jobs.map(jobRow).join("");
}

function renderCompanies() {
  const jobs = allJobs();
  const companies = [...new Set(jobs.map(job => job.company))].sort((a, b) => a.localeCompare(b, "bg"));
  const grid = document.getElementById("companyGrid");

  if (!companies.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">⌂</div>
      <h3>Все още няма компании</h3>
      <p>Компаниите се появяват автоматично, когато имат поне една одобрена обява.</p>
    </div>`;
    return;
  }

  grid.innerHTML = companies.map(name => {
    const companyJobs = jobs.filter(job => job.company === name);
    const sectors = [...new Set(companyJobs.map(job => job.sector))];
    return `
      <article class="company-card">
        <div class="company-card-head">
          <div class="company-logo">${escapeHTML(initials(name))}</div>
          <div>
            <h3>${escapeHTML(name)}</h3>
            <div class="job-row-company">${companyJobs.length} ${companyJobs.length === 1 ? "активна позиция" : "активни позиции"}</div>
          </div>
        </div>
        <p>Компания с активна entry-level позиция в JuniorStart BG.</p>
        <div class="company-card-meta">
          <span>${escapeHTML(sectors.join(" · "))}</span>
        </div>
        <button class="btn btn-secondary" data-company-filter="${escapeHTML(name)}">Виж позициите</button>
      </article>
    `;
  }).join("");
}

function findJob(id) {
  return allJobs().find(job => String(job.id) === String(id));
}

function openJobModal(id) {
  const job = findJob(id);
  if (!job) return;

  const requirements = Array.isArray(job.requirements)
    ? job.requirements
    : String(job.requirements || "")
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean);

  document.getElementById("jobModalContent").innerHTML = `
    <div class="modal-company-row">
      <div class="job-logo">${escapeHTML(initials(job.company))}</div>
      <div>
        <h2 id="jobModalTitle">${escapeHTML(job.title)}</h2>
        <div class="modal-company">${escapeHTML(job.company)}</div>
      </div>
    </div>

    <div class="modal-tags">
      <span class="tag blue">${escapeHTML(job.type)}</span>
      <span class="tag">${escapeHTML(job.city)}</span>
      <span class="tag green">${escapeHTML(job.sector)}</span>
      <span class="tag">Публикувана: ${escapeHTML(bgDate(job.date))}</span>
    </div>

    <section class="modal-section">
      <h4>За позицията</h4>
      <p>${escapeHTML(job.description)}</p>
    </section>

    <section class="modal-section">
      <h4>Какво се търси</h4>
      ${requirements.length
        ? `<ul>${requirements.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`
        : `<p>Няма добавени конкретни изисквания.</p>`}
    </section>

    <div class="modal-actions">
      <button class="btn btn-secondary save-detail ${isSaved(job.id) ? "saved" : ""}" data-save-job="${escapeHTML(job.id)}">
        ${isSaved(job.id) ? "♥ Запазена" : "♡ Запази"}
      </button>
      <a class="btn btn-primary" href="${safeUrl(job.applyUrl)}" target="_blank" rel="noopener noreferrer">Кандидатствай тук</a>
    </div>
  `;

  openModal("jobModal");
}

function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
  if (![...document.querySelectorAll(".modal-backdrop")].some(m => !m.classList.contains("hidden"))) {
    document.body.classList.remove("modal-open");
  }
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
  document.getElementById(`view-${view}`).classList.add("active");

  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  document.getElementById("mainNav").classList.remove("open");
  document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (view === "jobs") renderJobs();
  if (view === "companies") renderCompanies();
  if (view === "saved") renderSavedJobs();
}

function clearFilters() {
  state.filters = { search: "", city: "", type: "", sector: "", sort: "newest" };
  document.getElementById("searchInput").value = "";
  document.getElementById("cityFilter").value = "";
  document.getElementById("typeFilter").value = "";
  document.getElementById("sectorFilter").value = "";
  document.getElementById("sortFilter").value = "newest";
  renderJobs();
}

function runHeroSearch() {
  state.filters.search = document.getElementById("heroSearch").value;
  state.filters.city = document.getElementById("heroCity").value;
  document.getElementById("searchInput").value = state.filters.search;
  document.getElementById("cityFilter").value = state.filters.city;
  switchView("jobs");
}

function normalizeApplyUrl(value) {
  const text = String(value || "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return `mailto:${text}`;
  if (/^https?:\/\//i.test(text) || /^mailto:/i.test(text)) return text;
  return text;
}

async function submitJob(form) {
  if (!db) {
    toast("Supabase не е конфигуриран.");
    showNotice("Не можеш да изпращаш обяви, докато Supabase не е конфигуриран.", "error");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "Изпращане…";

  const formData = new FormData(form);
  const requirements = String(formData.get("requirements") || "")
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);

  const payload = {
    p_title: String(formData.get("title") || "").trim(),
    p_company: String(formData.get("company") || "").trim(),
    p_city: String(formData.get("city") || "").trim(),
    p_job_type: String(formData.get("type") || "").trim(),
    p_sector: String(formData.get("sector") || "").trim(),
    p_description: String(formData.get("description") || "").trim(),
    p_requirements: requirements,
    p_apply_url: normalizeApplyUrl(formData.get("applyUrl"))
  };

  const { error } = await db.rpc("submit_job", payload);

  submitButton.disabled = false;
  submitButton.textContent = originalText;

  if (error) {
    console.error("Supabase submit error:", error);
    toast("Не успях да изпратя обявата.");
    showNotice(`Грешка при изпращането: ${error.message}`, "error");
    return;
  }

  form.reset();
  closeModal("addJobModal");
  toast("Обявата е изпратена за одобрение.");
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.add("hidden"), 2600);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  const url = String(value || "").trim();
  if (/^(https?:\/\/|mailto:)/i.test(url)) return escapeHTML(url);
  return "#";
}

function renderAll() {
  renderSelects();
  renderHomeStats();
  renderHomeJobs();
  renderJobs();
  renderSavedCount();
  renderSavedJobs();
  renderCompanies();
}

document.addEventListener("click", event => {
  const save = event.target.closest("[data-save-job]");
  if (save) {
    toggleSaved(save.dataset.saveJob);
    const modal = document.getElementById("jobModal");
    if (!modal.classList.contains("hidden")) {
      openJobModal(save.dataset.saveJob);
    }
    return;
  }

  const details = event.target.closest("[data-job-details]");
  if (details) {
    openJobModal(details.dataset.jobDetails);
    return;
  }

  const nav = event.target.closest("[data-view]");
  if (nav) {
    switchView(nav.dataset.view);
    return;
  }

  const go = event.target.closest("[data-go-view]");
  if (go) {
    switchView(go.dataset.goView);
    return;
  }

  const close = event.target.closest("[data-close-modal]");
  if (close) {
    closeModal(close.dataset.closeModal);
    return;
  }

  const company = event.target.closest("[data-company-filter]");
  if (company) {
    state.filters.search = company.dataset.companyFilter;
    document.getElementById("searchInput").value = state.filters.search;
    switchView("jobs");
  }
});

document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) closeModal(backdrop.id);
  });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal-backdrop").forEach(modal => closeModal(modal.id));
  }
});

document.getElementById("menuToggle").addEventListener("click", () => {
  const nav = document.getElementById("mainNav");
  const open = nav.classList.toggle("open");
  document.getElementById("menuToggle").setAttribute("aria-expanded", String(open));
});

["openAddJobTop", "openAddJobHero", "openAddJobJobs", "footerAddJob"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => openModal("addJobModal"));
});

document.getElementById("heroSearchBtn").addEventListener("click", runHeroSearch);
document.getElementById("heroSearch").addEventListener("keydown", event => {
  if (event.key === "Enter") runHeroSearch();
});

document.querySelectorAll("[data-quick-sector]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.filters.sector = btn.dataset.quickSector;
    document.getElementById("sectorFilter").value = state.filters.sector;
    switchView("jobs");
  });
});

document.querySelectorAll("[data-quick-type]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.filters.type = btn.dataset.quickType;
    document.getElementById("typeFilter").value = state.filters.type;
    switchView("jobs");
  });
});

document.querySelectorAll("[data-quick-city]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.filters.city = btn.dataset.quickCity;
    document.getElementById("cityFilter").value = state.filters.city;
    switchView("jobs");
  });
});

document.getElementById("searchInput").addEventListener("input", event => {
  state.filters.search = event.target.value;
  renderJobs();
});

document.getElementById("cityFilter").addEventListener("change", event => {
  state.filters.city = event.target.value;
  renderJobs();
});

document.getElementById("typeFilter").addEventListener("change", event => {
  state.filters.type = event.target.value;
  renderJobs();
});

document.getElementById("sectorFilter").addEventListener("change", event => {
  state.filters.sector = event.target.value;
  renderJobs();
});

document.getElementById("sortFilter").addEventListener("change", event => {
  state.filters.sort = event.target.value;
  renderJobs();
});

document.getElementById("clearFilters").addEventListener("click", clearFilters);
document.getElementById("emptyClearFilters").addEventListener("click", clearFilters);

document.getElementById("addJobForm").addEventListener("submit", event => {
  event.preventDefault();
  submitJob(event.target);
});

document.getElementById("year").textContent = new Date().getFullYear();

async function init() {
  renderSelects();
  renderSavedCount();
  renderAll();
  db = createDatabaseClient();
  await loadJobs();
}

init();
