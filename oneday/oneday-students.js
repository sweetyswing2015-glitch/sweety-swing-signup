const API_URL = "https://script.google.com/macros/s/AKfycbyXhHR_VEz_0a4guDUBI8t1VK88pFcbryxNovMZwQDqlkg0Vc3dAOi_YNInDSx9qQ-R/exec";

const fallbackData = {
  config: { classTitle: "스위티스윙 원데이 클래스" },
  roster: [],
  summary: { total: 0, male: 0, female: 0 },
};
const CACHE_KEY = "sweetySwingOnedayStudentsPageData:v1";
const CONFIG_CACHE_KEY = "sweetySwingOnedayConfig:v1";
const CACHE_MAX_AGE_MS = 60 * 1000;
let currentConfig = fallbackData.config;

const loadingState = document.querySelector("#loadingState");
const loadingText = loadingState?.querySelector("strong");
const emptyState = document.querySelector("#emptyState");
const rosterGrid = document.querySelector("#rosterGrid");
const toast = document.querySelector("#toast");

function buildApiUrl(action) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("_", Date.now());
  return url.toString();
}

async function apiGet(action) {
  const response = await fetch(buildApiUrl(action), { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error || "Google Sheets API request failed");
  return data;
}

function normalizeStatus(value) {
  const text = String(value || "").trim();
  if (["확정", "confirmed"].includes(text)) return "confirmed";
  if (["취소", "cancelled"].includes(text)) return "cancelled";
  return "submitted";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (!node) return;
  node.textContent = value;
  node.classList.add("sheet-value");
}

function setLoading(isLoading, message = "신청 현황을 불러오는 중입니다.") {
  if (loadingText) loadingText.textContent = message;
  loadingState.hidden = !isLoading;
}

function readCachedData() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!cached?.data || Date.now() - Number(cached.savedAt || 0) > CACHE_MAX_AGE_MS) return null;
    return cached.data;
  } catch (error) {
    console.warn("Oneday roster cache read failed", error);
    return null;
  }
}

function writeCachedData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (error) {
    console.warn("Oneday roster cache write failed", error);
  }
}

function readCachedConfig() {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY) || "null");
    if (!cached?.config || Date.now() - Number(cached.savedAt || 0) > CACHE_MAX_AGE_MS) return null;
    return cached.config;
  } catch (error) {
    console.warn("Oneday config cache read failed", error);
    return null;
  }
}

function writeCachedConfig(config) {
  try {
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), config }));
  } catch (error) {
    console.warn("Oneday config cache write failed", error);
  }
}

function applyConfig(config = fallbackData.config) {
  currentConfig = { ...fallbackData.config, ...config };
  setText("#classLabel", currentConfig.classTitle || fallbackData.config.classTitle);
  document.title = `${currentConfig.classTitle || fallbackData.config.classTitle} 신청확인`;
}

async function loadOnedayConfig() {
  const cachedConfig = readCachedConfig();
  if (cachedConfig) applyConfig(cachedConfig);

  try {
    const config = await apiGet("getOnedayConfig");
    writeCachedConfig(config);
    applyConfig(config);
    return config;
  } catch (error) {
    console.warn("Oneday config load failed", error);
    return cachedConfig || currentConfig;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function normalizeSummary(roster = [], summary = {}) {
  return {
    total: Number(summary.total ?? roster.length ?? 0),
    male: Number(summary.male ?? roster.filter((row) => row.gender === "남성").length),
    female: Number(summary.female ?? roster.filter((row) => row.gender === "여성").length),
  };
}

function compareRosterRows(a, b) {
  return String(a.submittedAt || "").localeCompare(String(b.submittedAt || "")) || String(a.nickname || "").localeCompare(String(b.nickname || ""), "ko");
}

function normalizeRosterRows(roster = []) {
  return roster
    .map((row) => ({
      ...row,
      nickname: String(row.nickname || "").trim(),
      gender: String(row.gender || "").trim(),
      status: normalizeStatus(row.status),
      submittedAt: row.submittedAt || "",
    }))
    .filter((row) => row.nickname && row.status !== "cancelled")
    .sort(compareRosterRows);
}

function renderRosterPerson(row) {
  return `
    <div class="roster-person">
      <strong>${escapeHtml(row.nickname)}</strong>
    </div>
  `;
}

function renderGenderColumn(title, rows) {
  return `
    <section class="roster-column">
      <div class="gender-roster-head">
        <h2>${title}</h2>
        <span>${rows.length}명</span>
      </div>
      <div class="roster-list">
        ${rows.length ? rows.map(renderRosterPerson).join("") : `<p class="roster-empty">아직 없음</p>`}
      </div>
    </section>
  `;
}

function render(data) {
  const roster = normalizeRosterRows(Array.isArray(data.roster) ? data.roster : []);
  const summary = normalizeSummary(roster, data.summary || {});
  const maleRows = roster.filter((row) => row.gender === "남성");
  const femaleRows = roster.filter((row) => row.gender === "여성");

  applyConfig(data.config || currentConfig);
  setText("#totalCount", summary.total);
  setText("#maleCount", summary.male);
  setText("#femaleCount", summary.female);

  emptyState.hidden = roster.length > 0;
  rosterGrid.hidden = roster.length === 0;
  rosterGrid.innerHTML = [renderGenderColumn("남성", maleRows), renderGenderColumn("여성", femaleRows)].join("");
}

async function loadRoster({ silent = false, useCache = true } = {}) {
  const cachedData = useCache ? readCachedData() : null;
  let hasRendered = false;
  if (cachedData) {
    render(cachedData);
    hasRendered = true;
    setLoading(true, "최신 신청 현황을 확인하는 중입니다.");
  } else {
    setLoading(true);
  }

  try {
    const data = await apiGet("getOnedayStudentsPageData");
    writeCachedData(data);
    if (data.config) writeCachedConfig(data.config);
    render(data);
    hasRendered = true;
    if (silent) showToast("명단을 새로고침했습니다.");
  } catch (error) {
    console.error(error);
    if (!hasRendered) render(fallbackData);
    if (silent) showToast(hasRendered ? "최신 명단을 불러오지 못했습니다." : "명단을 불러오지 못했습니다.");
  } finally {
    setLoading(false);
  }
}

document.querySelector("#refreshButton").addEventListener("click", () => {
  loadRoster({ silent: true, useCache: false });
});

applyConfig(readCachedConfig() || fallbackData.config);
loadOnedayConfig();
loadRoster();
