const API_URL = "https://script.google.com/macros/s/AKfycbyXhHR_VEz_0a4guDUBI8t1VK88pFcbryxNovMZwQDqlkg0Vc3dAOi_YNInDSx9qQ-R/exec";

const fallbackData = {
  config: { termLabel: "입문 정규강습 신청" },
  roster: [],
  summary: { total: 0, male: 0, female: 0, paid: 0 },
};

const loadingState = document.querySelector("#loadingState");
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

async function apiGet(action) {
  const response = await fetch(buildApiUrl(action), { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error || "Google Sheets API request failed");
  return data;
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

function setLoading(isLoading) {
  loadingState.hidden = !isLoading;
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
  setText("#maleCount", summary.male);
  setText("#femaleCount", summary.female);
  setText("#paidCount", summary.paid);

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

async function loadRoster({ silent = false } = {}) {
  setLoading(true);
  try {
    const data = await apiGet("getIntroStudentsPageData");
    render(data);
    if (silent) showToast("명단을 새로고침했습니다.");
  } catch (error) {
    console.error(error);
    render(fallbackData);
    if (silent) showToast("명단을 불러오지 못했습니다.");
  } finally {
    setLoading(false);
  }
}

document.querySelector("#refreshButton").addEventListener("click", () => {
  loadRoster({ silent: true });
});

loadRoster();
