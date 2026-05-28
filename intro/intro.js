const API_URL = "https://script.google.com/macros/s/AKfycbyXhHR_VEz_0a4guDUBI8t1VK88pFcbryxNovMZwQDqlkg0Vc3dAOi_YNInDSx9qQ-R/exec";
const CONFIG_CACHE_KEY = "sweetySwingIntroConfig:v3";
const ONEDAY_CONFIG_CACHE_KEY = "sweetySwingOnedayConfig:v1";
const CONFIG_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const ONEDAY_SIGNUP_URL = "../oneday/";

const defaultConfig = {
  termLabel: "입문 정규강습 신청",
  price: 60000,
  bankAccount: {
    bank: "카카오뱅크",
    accountNumber: "3333351975536",
    accountHolder: "이기봉",
  },
  depositorPrefix: "입문",
  refundDeadline: "6월19일",
  ageNotice: "만45세 이하 신청 가능 (1980년 6월생까지)",
  mainImageUrl: "./assets/intro-hero.png?v=137-regular-20260523011840",
  heroImageUrl: "./assets/intro-hero.png?v=137-regular-20260523011840",
  posterImageUrl: "./assets/intro-poster.png?v=137-regular-20260523004234",
  lessonPeriod: "6월20일~8월15일\n(기간 중 총 6회 강습)",
  lessonTime: "토요일 PM 06:20~07:55",
  lessonPlace: "선릉 Swing Time 바깥쪽 홀",
  spaceFeeNotice: "공간이용료 12,000원 현장 결제",
  timebarNotice: "공간이용료 12,000원 현장 결제",
  paymentNotice: "입금 확인 후 신청이 확정됩니다.",
};

const defaultOnedayPromoConfig = {
  promoTitle: "입문 전에 원데이로 먼저 스윙 한입!",
  promoText: "가볍게 놀러 와서 스윙댄스가 내 취향인지 확인해보세요.",
  promoCta: "원데이 신청하기",
  promoEndsAt: "2026-06-13 17:30",
};

let config = { ...defaultConfig, bankAccount: { ...defaultConfig.bankAccount } };
let isSubmitting = false;
let submitRequestedFromMobile = false;
let hasResolvedRemoteConfig = false;

const form = document.querySelector("#introForm");
const fields = {
  nickname: document.querySelector("#nickname"),
  realName: document.querySelector("#realName"),
  phone: document.querySelector("#phone"),
  experience: document.querySelector("#experience"),
  source: document.querySelector("#source"),
  referrer: document.querySelector("#referrer"),
  message: document.querySelector("#message"),
};
const submitButton = document.querySelector(".submit-button");
const mobileSubmitButton = document.querySelector("#mobileSubmit");
const mobileTotal = document.querySelector(".mobile-total");
const referrerField = document.querySelector("#referrerField");
const formStatus = document.querySelector("#formStatus");
const submittingOverlay = document.querySelector("#submittingOverlay");
const completeDialog = document.querySelector("#completeDialog");
const posterDialog = document.querySelector("#posterDialog");
const posterLarge = document.querySelector("#posterLarge");
const posterImage = document.querySelector("#posterImage");

function formatWon(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function normalizePhone(value) {
  const numbers = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (numbers.length < 4) return numbers;
  if (numbers.length < 8) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, numbers.length - 4)}-${numbers.slice(-4)}`;
}

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

async function apiPost(action, payload = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json();
  if (!response.ok || data?.error) {
    const error = new Error(data?.error || "Google Sheets API request failed");
    error.action = action;
    error.status = response.status;
    error.response = data;
    throw error;
  }
  return data;
}

async function reportIntroApplicationError(error, payload) {
  if (!payload) return;
  try {
    await apiPost("reportApplicationError", {
      payload: {
        action: error.action || "addIntroApplication",
        message: error.message,
        nickname: payload.nickname,
        selectedClasses: ["입문 강습", payload.gender, payload.experience].filter(Boolean).join(" / "),
        pageUrl: window.location.href,
        userAgent: window.navigator.userAgent,
        details: error.response || { status: error.status || "" },
      },
    });
  } catch (reportError) {
    console.warn("입문 신청 오류 보고 실패", reportError);
  }
}

function getDepositorName(nickname = fields.nickname.value) {
  const name = String(nickname || "").trim() || "닉네임";
  return `${config.depositorPrefix || "입문"}_${name}`;
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function normalizeImageUrl(value) {
  const url = String(value || "").trim();
  if (url.startsWith("./assets/")) return `../${url.slice(2)}`;
  if (url.startsWith("assets/")) return `../${url}`;
  const driveId = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1] || url.match(/[?&]id=([^&]+)/)?.[1];
  if (driveId) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`;
  return url;
}

function applyConfig(nextConfig = {}) {
  config = {
    ...defaultConfig,
    ...nextConfig,
    bankAccount: { ...defaultConfig.bankAccount, ...(nextConfig.bankAccount || {}) },
  };
  config.lessonPeriod = optionalConfigText(nextConfig, "lessonPeriod", defaultConfig.lessonPeriod);
  config.lessonTime = optionalConfigText(nextConfig, "lessonTime", defaultConfig.lessonTime);
  config.lessonPlace = optionalConfigText(nextConfig, "lessonPlace", defaultConfig.lessonPlace);
  config.spaceFeeNotice = optionalConfigText(nextConfig, "spaceFeeNotice", defaultConfig.spaceFeeNotice);
  config.timebarNotice = optionalConfigText(nextConfig, "timebarNotice", config.spaceFeeNotice || defaultConfig.timebarNotice);
  config.ageNotice = optionalConfigText(nextConfig, "ageNotice", defaultConfig.ageNotice);
  config.refundDeadline = optionalConfigText(nextConfig, "refundDeadline", defaultConfig.refundDeadline);
  config.paymentNotice = optionalConfigText(nextConfig, "paymentNotice", defaultConfig.paymentNotice);

  setText("#termLabel", config.termLabel);
  setText("#priceText", formatWon(config.price));
  setText("#summaryPrice", formatWon(config.price));
  setText("#mobileSummaryPrice", formatWon(config.price));
  setText("#bankText", `${config.bankAccount.bank} ${config.bankAccount.accountNumber}`);
  setText("#holderText", config.bankAccount.accountHolder);
  setText("#completeBank", `${config.bankAccount.bank} ${config.bankAccount.accountNumber}`);
  setOptionalRow("#spaceFeeRow", "#timebarNotice", config.timebarNotice);
  setOptionalText("#ageNotice", config.ageNotice);
  setOptionalRow("#lessonPeriodRow", "#lessonPeriodText", config.lessonPeriod);
  setOptionalRow("#lessonTimeRow", "#lessonTimeText", config.lessonTime);
  setOptionalRow("#lessonPlaceRow", "#lessonPlaceText", config.lessonPlace);
  setOptionalRow("#refundDeadlineRow", "#refundDeadlineText", config.refundDeadline, {
    preserveEmpty: !hasResolvedRemoteConfig,
  });
  setOptionalText("#paymentNoticeText", config.paymentNotice);

  const heroImage = document.querySelector("#heroImage");
  if (heroImage && (config.mainImageUrl || config.heroImageUrl)) heroImage.src = normalizeImageUrl(config.mainImageUrl || config.heroImageUrl);
  if (posterImage && config.posterImageUrl) posterImage.src = normalizeImageUrl(config.posterImageUrl);
  updateDepositorPreview();
}

function textOrDefault(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function optionalConfigText(source, key, fallback = "") {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return fallback;
  return String(source[key] ?? "").trim();
}

function setOptionalRow(rowSelector, textSelector, value, { preserveEmpty = false } = {}) {
  const row = document.querySelector(rowSelector);
  const text = String(value || "").trim();
  if (row) {
    row.hidden = !text && !preserveEmpty;
    row.classList.toggle("is-pending", !text && preserveEmpty);
    if (!text && preserveEmpty) row.setAttribute("aria-hidden", "true");
    else row.removeAttribute("aria-hidden");
  }
  setText(textSelector, text);
}

function setOptionalText(selector, value) {
  const node = document.querySelector(selector);
  if (!node) return;
  const text = String(value || "").trim();
  node.hidden = !text;
  if (text) node.textContent = text;
}

function readCachedConfig() {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY) || "null");
    if (!cached?.config || Date.now() - Number(cached.savedAt || 0) > CONFIG_CACHE_MAX_AGE_MS) return null;
    return cached.config;
  } catch (error) {
    console.warn("Intro config cache read failed", error);
    return null;
  }
}

function writeCachedConfig(nextConfig) {
  try {
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), config: nextConfig }));
  } catch (error) {
    console.warn("Intro config cache write failed", error);
  }
}

function readCachedOnedayConfig() {
  try {
    const cached = JSON.parse(localStorage.getItem(ONEDAY_CONFIG_CACHE_KEY) || "null");
    if (!cached?.config || Date.now() - Number(cached.savedAt || 0) > CONFIG_CACHE_MAX_AGE_MS) return null;
    return cached.config;
  } catch (error) {
    console.warn("Oneday config cache read failed", error);
    return null;
  }
}

function writeCachedOnedayConfig(nextConfig) {
  try {
    localStorage.setItem(ONEDAY_CONFIG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), config: nextConfig }));
  } catch (error) {
    console.warn("Oneday config cache write failed", error);
  }
}

function parseKstDateTime(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour = "23", minute = "59"] = match;
  const date = new Date(
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00+09:00`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function shouldShowOnedayPromo(promoEndsAt) {
  const endsAt = parseKstDateTime(promoEndsAt);
  return Boolean(endsAt && Date.now() < endsAt.getTime());
}

function applyOnedayPromo(nextConfig = {}) {
  const promo = {
    ...defaultOnedayPromoConfig,
    ...nextConfig,
  };
  const promoTitle = textOrDefault(promo.promoTitle, defaultOnedayPromoConfig.promoTitle);
  const promoText = textOrDefault(promo.promoText, defaultOnedayPromoConfig.promoText);
  const promoCta = textOrDefault(promo.promoCta, defaultOnedayPromoConfig.promoCta);
  const promoEndsAt = Object.prototype.hasOwnProperty.call(nextConfig, "promoEndsAt")
    ? String(nextConfig.promoEndsAt || "").trim()
    : defaultOnedayPromoConfig.promoEndsAt;
  const promoNode = document.querySelector("#onedayPromo");
  if (!promoNode) return;

  setText("#onedayPromoTitle", promoTitle);
  setText("#onedayPromoText", promoText);
  setText("#onedayPromoCta", promoCta);
  const promoLink = document.querySelector("#onedayPromoLink");
  if (promoLink) promoLink.href = ONEDAY_SIGNUP_URL;
  promoNode.hidden = !shouldShowOnedayPromo(promoEndsAt);
}

async function refreshOnedayPromo() {
  try {
    const onedayConfig = await apiGet("getOnedayConfig");
    writeCachedOnedayConfig(onedayConfig);
    applyOnedayPromo(onedayConfig);
  } catch (error) {
    console.warn("Oneday promo config load failed", error);
    applyOnedayPromo(readCachedOnedayConfig() || { promoEndsAt: "" });
  }
}

function updateDepositorPreview() {
  const depositorName = getDepositorName();
  setText("#summaryDepositor", depositorName);
}

function updateReferrerVisibility() {
  const shouldShow = fields.source.value === "지인소개";
  referrerField?.classList.toggle("is-hidden", !shouldShow);
  if (!shouldShow) fields.referrer.value = "";
}

function setError(id, message) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = message;
}

function clearErrors() {
  ["nicknameError", "realNameError", "genderError", "phoneError", "experienceError", "sourceError"].forEach((id) => setError(id, ""));
  setStatus("");
}

function setStatus(message, { error = false } = {}) {
  formStatus.textContent = message;
  formStatus.classList.toggle("is-error", error);
}

function getGender() {
  return document.querySelector('input[name="gender"]:checked')?.value || "";
}

function validateForm() {
  clearErrors();
  let isValid = true;

  if (!fields.nickname.value.trim()) {
    setError("nicknameError", "닉네임을 입력해주세요.");
    isValid = false;
  }
  if (!fields.realName.value.trim()) {
    setError("realNameError", "이름을 입력해주세요.");
    isValid = false;
  }
  if (!getGender()) {
    setError("genderError", "성별을 선택해주세요.");
    isValid = false;
  }
  if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(fields.phone.value.trim())) {
    setError("phoneError", "휴대폰 번호 형식으로 입력해주세요. 예: 010-0000-0000");
    isValid = false;
  }
  if (!fields.experience.value) {
    setError("experienceError", "경력을 선택해주세요.");
    isValid = false;
  }
  if (!fields.source.value) {
    setError("sourceError", "신청 경로를 선택해주세요.");
    isValid = false;
  }

  return isValid;
}

function getFirstInvalidField() {
  if (!fields.nickname.value.trim()) return fields.nickname;
  if (!fields.realName.value.trim()) return fields.realName;
  if (!getGender()) return document.querySelector('input[name="gender"]');
  if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(fields.phone.value.trim())) return fields.phone;
  if (!fields.experience.value) return fields.experience;
  if (!fields.source.value) return fields.source;
  return null;
}

function focusFirstInvalidField({ scrollToApplyFirst = false } = {}) {
  const target = getFirstInvalidField();
  const applySection = document.querySelector("#apply");
  const scrollTarget = scrollToApplyFirst ? applySection : target?.closest("label, fieldset") || applySection;
  scrollTarget?.scrollIntoView({ behavior: "smooth", block: scrollToApplyFirst ? "start" : "center" });
  if (target && typeof target.focus === "function") {
    window.setTimeout(() => target.focus({ preventScroll: true }), scrollToApplyFirst ? 360 : 160);
  }
}

function buildPayload() {
  return {
    nickname: fields.nickname.value.trim(),
    realName: fields.realName.value.trim(),
    gender: getGender(),
    phone: fields.phone.value.trim(),
    experience: fields.experience.value,
    source: fields.source.value,
    referrer: fields.source.value === "지인소개" ? fields.referrer.value.trim() : "",
    message: fields.message.value.trim(),
    clientContext: {
      pageUrl: window.location.href,
      userAgent: window.navigator.userAgent,
    },
  };
}

function setSubmitting(nextSubmitting) {
  isSubmitting = nextSubmitting;
  document.body.classList.toggle("is-submitting", isSubmitting);
  submittingOverlay.hidden = !isSubmitting;
  submitButton.disabled = isSubmitting;
  if (mobileSubmitButton) mobileSubmitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "신청 저장 중" : "신청하기";
  if (mobileSubmitButton) mobileSubmitButton.textContent = isSubmitting ? "저장 중" : "신청하기";
}

function showCompleteDialog(record) {
  const amount = Number(record.amount || config.price || 0);
  const depositorName = record.depositorName || getDepositorName(record.nickname);
  setText("#completeAmount", formatWon(amount));
  setText("#completeDepositor", depositorName);
  setText("#completeBank", `${config.bankAccount.bank} ${config.bankAccount.accountNumber}`);
  completeDialog.showModal();
}

function resetForm() {
  form.reset();
  clearErrors();
  updateDepositorPreview();
  updateReferrerVisibility();
}

async function copyAccountNumber(button) {
  const text = config.bankAccount.accountNumber;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "복사됨";
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    button.textContent = "복사됨";
  }
  window.setTimeout(() => {
    button.textContent = "복사";
  }, 1400);
}

async function refreshConfig() {
  try {
    const nextConfig = await apiGet("getIntroConfig");
    writeCachedConfig(nextConfig);
    hasResolvedRemoteConfig = true;
    applyConfig(nextConfig);
  } catch (error) {
    console.warn(error);
    hasResolvedRemoteConfig = true;
    applyConfig(readCachedConfig() || defaultConfig);
  }
}

function setFloatingSubmitHidden(hidden) {
  mobileTotal?.classList.toggle("is-inline-submit-visible", hidden);
}

function isInlineSubmitVisible() {
  if (!submitButton || submitButton.offsetParent === null) return false;
  const rect = submitButton.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  return rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
}

function setupFloatingSubmitVisibility() {
  if (!mobileTotal || !submitButton) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setFloatingSubmitHidden(Boolean(entry?.isIntersecting));
      },
      { threshold: 0 },
    );
    observer.observe(submitButton);
    return;
  }

  let ticking = false;
  const update = () => {
    ticking = false;
    setFloatingSubmitHidden(isInlineSubmitVisible());
  };
  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  requestUpdate();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSubmitting) return;
  const shouldScrollApplyFirst = submitRequestedFromMobile;
  submitRequestedFromMobile = false;

  if (!validateForm()) {
    setStatus("입력 내용을 확인해주세요.", { error: true });
    focusFirstInvalidField({ scrollToApplyFirst: shouldScrollApplyFirst });
    return;
  }

  let requestPayload;
  try {
    setSubmitting(true);
    setStatus("신청 저장 중입니다. 잠시만 기다려주세요.");
    requestPayload = buildPayload();
    const record = await apiPost("addIntroApplication", { payload: requestPayload });
    showCompleteDialog(record);
    resetForm();
  } catch (error) {
    console.error(error);
    await reportIntroApplicationError(error, requestPayload);
    setStatus("신청 저장에 실패했습니다. 잠시 후 다시 시도해주세요.", { error: true });
    alert("신청 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    setSubmitting(false);
  }
});

fields.nickname.addEventListener("input", updateDepositorPreview);
fields.phone.addEventListener("input", (event) => {
  event.target.value = normalizePhone(event.target.value);
});
fields.source.addEventListener("change", updateReferrerVisibility);

document.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-copy-account]");
  if (copyButton) {
    copyAccountNumber(copyButton);
    return;
  }

  const posterButton = event.target.closest(".poster-open-button");
  if (posterButton && posterDialog && posterLarge && posterImage) {
    posterLarge.src = posterImage.currentSrc || posterImage.src;
    posterLarge.alt = posterImage.alt || "입문 강습 포스터";
    posterDialog.showModal();
    return;
  }

  if (event.target.matches(".dialog-close")) {
    event.target.closest("dialog")?.close();
  }
});

mobileSubmitButton?.addEventListener("click", () => {
  if (isSubmitting) return;
  submitRequestedFromMobile = true;
  form.requestSubmit();
});

applyConfig(readCachedConfig() || defaultConfig);
applyOnedayPromo(readCachedOnedayConfig() || { promoEndsAt: "" });
updateReferrerVisibility();
refreshConfig();
refreshOnedayPromo();
setupFloatingSubmitVisibility();
