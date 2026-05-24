const API_URL = "https://script.google.com/macros/s/AKfycbyXhHR_VEz_0a4guDUBI8t1VK88pFcbryxNovMZwQDqlkg0Vc3dAOi_YNInDSx9qQ-R/exec";
const SPREADSHEET_ID = "1WgX96V0u-6foqKsckcSaDpSusiLr3Gu51a19XWLlcmQ";
const INTRO_ROSTER_SHEET = "입문신청확인";

const fallbackData = {
  config: { termLabel: "입문 정규강습 신청" },
  roster: [],
  summary: { total: 0, male: 0, female: 0, paid: 0 },
};
const CACHE_KEY = "sweetySwingIntroStudentsPageData:v1";
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

const loadingState = document.querySelector("#loadingState");
const loadingText = loadingState?.querySelector("strong");
const emptyState = document.querySelector("#emptyState");
const rosterTable = document.querySelector("#rosterTable");
const rosterBody = document.querySelector("#rosterBody");
const toast = document.querySelector("#toast");

function buildApiUrl(action) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("_", Date.now());
  return url.toString();
}

function buildRosterSheetUrl() {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`);
  url.searchParams.set("sheet", INTRO_ROSTER_SHEET);
  url.searchParams.set("headers", "1");
  url.searchParams.set("tq", "select A,B,C,D,E,F");
  return url.toString();
}

async function apiGet(action) {
  const response = await fetch(buildApiUrl(action), { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error || "Google Sheets API request failed");
  return data;
}

function loadGvizData() {
  return new Promise((resolve, reject) => {
    const callbackName = `__introRoster_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Roster sheet request timed out"));
    }, 8000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (response) => {
      cleanup();
      if (response?.status === "error") {
        reject(new Error(response.errors?.[0]?.detailed_message || "Roster sheet request failed"));
        return;
      }
      resolve(response);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Roster sheet request failed"));
    };

    const url = new URL(buildRosterSheetUrl());
    url.searchParams.set("tqx", `out:json;responseHandler:${callbackName}`);
    script.src = url.toString();
    document.head.appendChild(script);
  });
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
  return "submitted";
}

function getCellValue(cells, index) {
  const cell = cells?.[index];
  return String(cell?.f ?? cell?.v ?? "").trim();
}

async function getRosterFromSheet() {
  const response = await loadGvizData();
  const rows = response?.table?.rows || [];
  const roster = rows
    .map((row) => {
      const cells = row.c || [];
      return {
        nickname: getCellValue(cells, 0),
        gender: getCellValue(cells, 1),
        paymentStatus: normalizePaymentStatus(getCellValue(cells, 2)),
        status: normalizeStatus(getCellValue(cells, 3)),
        submittedAt: getCellValue(cells, 4),
        id: getCellValue(cells, 5),
      };
    })
    .filter((row) => (row.nickname || row.gender) && !(row.nickname === "닉네임" && row.gender === "성별"));

  return {
    config: fallbackData.config,
    roster,
    summary: normalizeSummary(roster),
    generatedAt: new Date().toISOString(),
  };
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
  if (node) node.textContent = value;
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

function render(data) {
  const roster = Array.isArray(data.roster) ? data.roster : [];
  const summary = normalizeSummary(roster, data.summary || {});

  setText("#termLabel", data.config?.termLabel || fallbackData.config.termLabel);
  setText("#totalCount", summary.total);
  setText("#paidCount", summary.paid);
  setText("#maleCount", summary.male);
  setText("#femaleCount", summary.female);

  emptyState.hidden = roster.length > 0;
  rosterTable.hidden = roster.length === 0;
  rosterBody.innerHTML = roster
    .map((row) => {
      const paidBadge = row.paymentStatus === "paid" ? `<span class="paid-badge">입금확인</span>` : "";
      return `
        <tr>
          <td><strong>${escapeHtml(row.nickname)}</strong>${paidBadge}</td>
          <td>${escapeHtml(row.gender)}</td>
        </tr>
      `;
    })
    .join("");
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
    const data = await getRosterFromSheet();
    writeCachedData(data);
    render(data);
    hasRendered = true;
    if (silent) showToast("명단을 새로고침했습니다.");
  } catch (error) {
    console.error(error);
    try {
      const data = await apiGet("getIntroStudentsPageData");
      writeCachedData(data);
      render(data);
      hasRendered = true;
      if (silent) showToast("명단을 새로고침했습니다.");
    } catch (apiError) {
      console.error(apiError);
      if (!hasRendered) render(fallbackData);
      if (silent) showToast(hasRendered ? "최신 명단을 불러오지 못했습니다." : "명단을 불러오지 못했습니다.");
    }
  } finally {
    setLoading(false);
  }
}

document.querySelector("#refreshButton").addEventListener("click", () => {
  loadRoster({ silent: true, useCache: false });
});

loadRoster();
