const API_URL = "https://script.google.com/macros/s/AKfycbyXhHR_VEz_0a4guDUBI8t1VK88pFcbryxNovMZwQDqlkg0Vc3dAOi_YNInDSx9qQ-R/exec";

const fallbackData = {
  config: { termLabel: "입문 정규강습 신청" },
  roster: [],
  summary: { total: 0, male: 0, female: 0, paid: 0 },
};
const CACHE_KEY = "sweetySwingIntroStudentsPageData:v2";
const CONFIG_CACHE_KEY = "sweetySwingIntroConfig:v1";
let currentConfig = fallbackData.config;

const loadingState = document.querySelector("#loadingState");
const loadingText = loadingState?.querySelector("strong");
const emptyState = document.querySelector("#emptyState");
const rosterGrid = document.querySelector("#rosterGrid");
const toast = document.querySelector("#toast");
const syncStatus = document.querySelector("#syncStatus");

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

function normalizePaymentStatus(value) {
  const text = String(value || "").trim();
  if (["입금 확인", "입금확인", "paid"].includes(text)) return "paid";
  if (["확인 필요", "확인필요", "review"].includes(text)) return "review";
  if (["환불", "refunded"].includes(text)) return "refunded";
  return "unpaid";
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

function setSyncStatus(message, tone = "") {
  if (!syncStatus) return;
  window.clearTimeout(setSyncStatus.timer);
  syncStatus.textContent = message;
  syncStatus.className = `sync-status${tone ? ` is-${tone}` : ""}`;
  syncStatus.hidden = !message;
  if (message && tone !== "loading") {
    setSyncStatus.timer = window.setTimeout(() => {
      syncStatus.hidden = true;
    }, 3200);
  }
}

function readCachedData() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!cached?.data) return null;
    return cached.data;
  } catch (error) {
    console.warn("Intro roster cache read failed", error);
    return null;
  }
}

function writeCachedData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (error) {
    console.warn("Intro roster cache write failed", error);
  }
}

function readCachedConfig() {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY) || "null");
    if (!cached?.config) return null;
    return cached.config;
  } catch (error) {
    console.warn("Intro config cache read failed", error);
    return null;
  }
}

function writeCachedConfig(config) {
  try {
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), config }));
  } catch (error) {
    console.warn("Intro config cache write failed", error);
  }
}

function applyConfig(config = fallbackData.config) {
  currentConfig = { ...fallbackData.config, ...config };
  setText("#termLabel", currentConfig.termLabel || fallbackData.config.termLabel);
}

async function loadIntroConfig() {
  const cachedConfig = readCachedConfig();
  if (cachedConfig) applyConfig(cachedConfig);

  try {
    const config = await apiGet("getIntroConfig");
    writeCachedConfig(config);
    applyConfig(config);
    return config;
  } catch (error) {
    console.warn("Intro config load failed", error);
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
    paid: Number(summary.paid ?? roster.filter((row) => row.paymentStatus === "paid").length),
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
      paymentStatus: normalizePaymentStatus(row.paymentStatus),
      status: normalizeStatus(row.status),
      submittedAt: row.submittedAt || "",
    }))
    .filter((row) => row.nickname && row.status !== "cancelled" && row.paymentStatus !== "refunded")
    .sort(compareRosterRows);
}

function renderRosterPerson(row) {
  const paidBadge = row.paymentStatus === "paid" ? `<span class="paid-badge">입금확인</span>` : "";
  return `
    <div class="intro-roster-person">
      <strong>${escapeHtml(row.nickname)}</strong>
      ${paidBadge}
    </div>
  `;
}

function renderGenderColumn(title, rows) {
  return `
    <section class="intro-roster-column">
      <div class="intro-roster-head">
        <h2>${title}</h2>
        <span>${rows.length}명</span>
      </div>
      <div class="intro-roster-list">
        ${rows.length ? rows.map(renderRosterPerson).join("") : `<p class="intro-roster-empty">아직 없음</p>`}
      </div>
    </section>
  `;
}

function render(data) {
  const roster = normalizeRosterRows(Array.isArray(data.roster) ? data.roster : []);
  const summary = normalizeSummary(roster, data.summary || {});
  const maleRows = roster.filter((row) => row.gender === "남성");
  const femaleRows = roster.filter((row) => row.gender === "여성");

  setText("#termLabel", data.config?.termLabel || currentConfig.termLabel || fallbackData.config.termLabel);
  setText("#totalCount", summary.total);
  setText("#paidCount", summary.paid);
  setText("#maleCount", summary.male);
  setText("#femaleCount", summary.female);

  emptyState.hidden = roster.length > 0;
  rosterGrid.hidden = roster.length === 0;
  rosterGrid.innerHTML = [renderGenderColumn("남성", maleRows), renderGenderColumn("여성", femaleRows)].join("");
}

async function loadRoster({ silent = false, useCache = true } = {}) {
  const cachedData = useCache ? readCachedData() : null;
  const hasCachedData = Boolean(cachedData);
  let hasRendered = hasCachedData || loadingState.hidden;
  if (cachedData) {
    render(cachedData);
    hasRendered = true;
    setLoading(true, "최신 신청 현황을 확인하는 중입니다.");
    setSyncStatus("최신 명단을 확인하는 중입니다.", "loading");
  } else {
    setLoading(true);
    setSyncStatus("");
  }

  try {
    const data = await apiGet("getIntroStudentsPageData");
    writeCachedData(data);
    if (data.config) writeCachedConfig(data.config);
    render(data);
    hasRendered = true;
    if (hasCachedData) setSyncStatus("최신 명단으로 업데이트했습니다.", "success");
    if (silent) showToast("명단을 새로고침했습니다.");
  } catch (error) {
    console.error(error);
    if (!hasRendered) render(fallbackData);
    setSyncStatus(
      hasRendered ? "최신 명단 확인에 실패했습니다. 이전 명단을 표시하고 있습니다." : "명단을 불러오지 못했습니다.",
      "error",
    );
    if (silent) showToast(hasRendered ? "최신 명단을 불러오지 못했습니다." : "명단을 불러오지 못했습니다.");
  } finally {
    setLoading(false);
  }
}

document.querySelector("#refreshButton").addEventListener("click", () => {
  loadRoster({ silent: true, useCache: false });
});

applyConfig(readCachedConfig() || fallbackData.config);
loadRoster();
