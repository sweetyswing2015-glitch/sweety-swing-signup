const API_URL = "https://script.google.com/macros/s/AKfycbyXhHR_VEz_0a4guDUBI8t1VK88pFcbryxNovMZwQDqlkg0Vc3dAOi_YNInDSx9qQ-R/exec";
const CONFIG_CACHE_KEY = "sweetySwingOnedayConfig:v1";
const CONFIG_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

const defaultConfig = {
  classTitle: "스위티스윙 6월 스윙댄스 원데이 클래스",
  lessonDate: "6월 13일(토)",
  lessonTime: "오후 5:30 ~ 7:20",
  lessonPlace: "Swing Time Bar (선릉역 5번 출구)",
  lessonFee: "무료!",
  spaceFeeNotice: "공간이용료 12,000원 현장 결제",
  promoCta: "원데이 신청하기",
  successMessage: "신청이 완료되었습니다. 강습 때 만나요 :)",
};

let config = { ...defaultConfig };
let isSubmitting = false;
let isConfigReady = false;

const form = document.querySelector("#onedayForm");
const fields = {
  nickname: document.querySelector("#nickname"),
  realName: document.querySelector("#realName"),
  phone: document.querySelector("#phone"),
  experience: document.querySelector("#experience"),
  source: document.querySelector("#source"),
  referrer: document.querySelector("#referrer"),
  message: document.querySelector("#message"),
};
const referrerField = document.querySelector("#referrerField");
const submitButton = document.querySelector(".submit-button");
const formStatus = document.querySelector("#formStatus");
const submittingOverlay = document.querySelector("#submittingOverlay");
const completeDialog = document.querySelector("#completeDialog");

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

async function reportOnedayApplicationError(error, payload) {
  if (!payload) return;
  try {
    await apiPost("reportApplicationError", {
      payload: {
        action: error.action || "addOnedayApplication",
        message: error.message,
        nickname: payload.nickname,
        selectedClasses: ["원데이 강습", payload.gender, payload.experience].filter(Boolean).join(" / "),
        pageUrl: window.location.href,
        userAgent: window.navigator.userAgent,
        details: error.response || { status: error.status || "" },
      },
    });
  } catch (reportError) {
    console.warn("원데이 신청 오류 보고 실패", reportError);
  }
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function textOrDefault(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function optionalConfigText(source, key, fallback = "") {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return fallback;
  return String(source[key] ?? "").trim();
}

function setOptionalRow(rowSelector, textSelector, value) {
  const row = document.querySelector(rowSelector);
  const text = String(value || "").trim();
  if (row) row.hidden = !text;
  if (text) setText(textSelector, text);
}

function setOptionalText(selector, value) {
  const node = document.querySelector(selector);
  if (!node) return;
  const text = String(value || "").trim();
  node.hidden = !text;
  if (text) node.textContent = text;
}

function applyConfig(nextConfig = {}) {
  config = {
    ...defaultConfig,
    ...nextConfig,
  };
  config.classTitle = textOrDefault(nextConfig.classTitle, defaultConfig.classTitle);
  config.lessonDate = optionalConfigText(nextConfig, "lessonDate", defaultConfig.lessonDate);
  config.lessonTime = optionalConfigText(nextConfig, "lessonTime", defaultConfig.lessonTime);
  config.lessonPlace = optionalConfigText(nextConfig, "lessonPlace", defaultConfig.lessonPlace);
  config.lessonFee = optionalConfigText(nextConfig, "lessonFee", defaultConfig.lessonFee);
  config.spaceFeeNotice = optionalConfigText(nextConfig, "spaceFeeNotice", defaultConfig.spaceFeeNotice);
  config.promoCta = textOrDefault(nextConfig.promoCta, defaultConfig.promoCta);
  config.successMessage = optionalConfigText(nextConfig, "successMessage", defaultConfig.successMessage);

  setText("#classTitle", config.classTitle);
  setOptionalRow("#lessonDateRow", "#lessonDateText", config.lessonDate);
  setOptionalRow("#lessonTimeRow", "#lessonTimeText", config.lessonTime);
  setOptionalRow("#lessonPlaceRow", "#lessonPlaceText", config.lessonPlace);
  setOptionalRow("#lessonFeeRow", "#lessonFeeText", config.lessonFee);
  setOptionalText("#spaceFeeText", config.spaceFeeNotice);
  setOptionalText("#completeMessage", config.successMessage);
  updateSubmitButton();
  document.title = `${config.classTitle} 신청`;
}

function readCachedConfig() {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY) || "null");
    if (!cached?.config || Date.now() - Number(cached.savedAt || 0) > CONFIG_CACHE_MAX_AGE_MS) return null;
    return cached.config;
  } catch (error) {
    console.warn("Oneday config cache read failed", error);
    return null;
  }
}

function writeCachedConfig(nextConfig) {
  try {
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), config: nextConfig }));
  } catch (error) {
    console.warn("Oneday config cache write failed", error);
  }
}

async function refreshConfig() {
  try {
    const nextConfig = await apiGet("getOnedayConfig");
    writeCachedConfig(nextConfig);
    isConfigReady = true;
    applyConfig(nextConfig);
  } catch (error) {
    console.warn(error);
    isConfigReady = false;
    applyConfig(readCachedConfig() || defaultConfig);
    setStatus("원데이 신청 준비 중입니다. 잠시 후 다시 시도해주세요.", { error: true });
  }
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
    setError("experienceError", "스윙 경험을 선택해주세요.");
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

function focusFirstInvalidField() {
  const target = getFirstInvalidField();
  const scrollTarget = target?.closest("label, fieldset") || form;
  scrollTarget?.scrollIntoView({ behavior: "smooth", block: "center" });
  if (target && typeof target.focus === "function") {
    window.setTimeout(() => target.focus({ preventScroll: true }), 160);
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
  updateSubmitButton();
}

function updateSubmitButton() {
  if (!submitButton) return;
  submitButton.disabled = isSubmitting || !isConfigReady;
  submitButton.textContent = isSubmitting ? "신청 저장 중" : isConfigReady ? config.promoCta || defaultConfig.promoCta : "신청 준비 중";
}

function showCompleteDialog() {
  setOptionalText("#completeMessage", config.successMessage);
  completeDialog.showModal();
}

function resetForm() {
  form.reset();
  clearErrors();
  updateReferrerVisibility();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSubmitting) return;
  if (!isConfigReady) {
    setStatus("원데이 신청 준비 중입니다. 잠시 후 다시 시도해주세요.", { error: true });
    return;
  }

  if (!validateForm()) {
    setStatus("입력 내용을 확인해주세요.", { error: true });
    focusFirstInvalidField();
    return;
  }

  let requestPayload;
  try {
    setSubmitting(true);
    setStatus("신청 저장 중입니다. 잠시만 기다려주세요.");
    requestPayload = buildPayload();
    await apiPost("addOnedayApplication", { payload: requestPayload });
    showCompleteDialog();
    resetForm();
  } catch (error) {
    console.error(error);
    await reportOnedayApplicationError(error, requestPayload);
    setStatus("신청 저장에 실패했습니다. 잠시 후 다시 시도해주세요.", { error: true });
    alert("신청 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    setSubmitting(false);
  }
});

fields.phone.addEventListener("input", (event) => {
  event.target.value = normalizePhone(event.target.value);
});
fields.source.addEventListener("change", updateReferrerVisibility);

document.addEventListener("click", (event) => {
  if (event.target.matches(".dialog-close")) {
    event.target.closest("dialog")?.close();
  }
});

applyConfig(readCachedConfig() || defaultConfig);
updateReferrerVisibility();
refreshConfig();
