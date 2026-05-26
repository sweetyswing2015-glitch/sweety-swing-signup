const API_URL = "https://script.google.com/macros/s/AKfycbyXhHR_VEz_0a4guDUBI8t1VK88pFcbryxNovMZwQDqlkg0Vc3dAOi_YNInDSx9qQ-R/exec";

const defaultConfig = {
  termLabel: "입문 정규강습 신청",
  price: 60000,
  bankAccount: {
    bank: "카카오뱅크",
    accountNumber: "3333351975536",
    accountHolder: "이기연",
  },
  depositorPrefix: "입문",
  refundDeadline: "",
  ageNotice: "*만45세 이하 신청 가능\n(1980년 6월생까지)",
  maleCapacity: 25,
  femaleCapacity: 25,
  mainImageUrl: "../assets/intro-hero.png",
  heroImageUrl: "../assets/intro-hero.png",
  posterImageUrl: "../assets/intro-poster.png",
  lessonPeriod: "6월20일~8월15일\n(기간 내 총 6회 강습)",
  lessonTime: "토요일 PM 06:20~07:55",
  lessonPlace: "선릉역 5번 출구 스윙타임 바깥홀",
  spaceFeeNotice: "공간이용료 12,000원 현장 결제",
  timebarNotice: "공간이용료 12,000원 현장 결제",
  paymentNotice: "입금 선착순 남녀 각각 25명",
};

let config = { ...defaultConfig, bankAccount: { ...defaultConfig.bankAccount } };
let isSubmitting = false;
let submitRequestedFromMobile = false;

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
  if (!response.ok || data?.error) throw new Error(data?.error || "Google Sheets API request failed");
  return data;
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
  config.lessonPeriod = textOrDefault(config.lessonPeriod, defaultConfig.lessonPeriod);
  config.lessonPeriod = normalizeLessonPeriod(config.lessonPeriod);
  config.lessonTime = textOrDefault(config.lessonTime, defaultConfig.lessonTime);
  config.lessonPlace = textOrDefault(config.lessonPlace, defaultConfig.lessonPlace);
  config.spaceFeeNotice = textOrDefault(config.spaceFeeNotice || config.timebarNotice, defaultConfig.spaceFeeNotice);
  config.timebarNotice = textOrDefault(config.timebarNotice || config.spaceFeeNotice, defaultConfig.timebarNotice);
  config.ageNotice = normalizeAgeNotice(config.ageNotice);

  setText("#termLabel", config.termLabel);
  setText("#priceText", formatWon(config.price));
  setText("#summaryPrice", formatWon(config.price));
  setText("#mobileSummaryPrice", formatWon(config.price));
  setText("#bankText", `${config.bankAccount.bank} ${config.bankAccount.accountNumber}`);
  setText("#holderText", config.bankAccount.accountHolder);
  setText("#completeBank", `${config.bankAccount.bank} ${config.bankAccount.accountNumber}`);
  setText("#timebarNotice", config.timebarNotice);
  setText("#ageNotice", config.ageNotice);
  setOptionalRow("#lessonPeriodRow", "#lessonPeriodText", config.lessonPeriod);
  setOptionalRow("#lessonTimeRow", "#lessonTimeText", config.lessonTime);
  setOptionalRow("#lessonPlaceRow", "#lessonPlaceText", config.lessonPlace);

  const heroImage = document.querySelector("#heroImage");
  if (heroImage && (config.mainImageUrl || config.heroImageUrl)) heroImage.src = normalizeImageUrl(config.mainImageUrl || config.heroImageUrl);
  if (posterImage && config.posterImageUrl) posterImage.src = normalizeImageUrl(config.posterImageUrl);
  updateDepositorPreview();
}

function textOrDefault(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeAgeNotice(value) {
  const text = textOrDefault(value, defaultConfig.ageNotice);
  return text.includes("1980년 6월생") ? text.replace("(1980년 6월생까지 신청가능)", "(1980년 6월생까지)") : defaultConfig.ageNotice;
}

function normalizeLessonPeriod(value) {
  const text = textOrDefault(value, defaultConfig.lessonPeriod);
  if (text.includes("6월20일") && text.includes("8월15일")) {
    return "6월20일~8월15일\n(기간 내 총 6회 강습)";
  }
  return text;
}

function setOptionalRow(rowSelector, textSelector, value) {
  const row = document.querySelector(rowSelector);
  const text = String(value || "").trim();
  if (row) row.hidden = !text;
  if (text) setText(textSelector, text);
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
    applyConfig(nextConfig);
  } catch (error) {
    console.warn(error);
    applyConfig(defaultConfig);
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

  try {
    setSubmitting(true);
    setStatus("신청 저장 중입니다. 잠시만 기다려주세요.");
    const record = await apiPost("addIntroApplication", { payload: buildPayload() });
    showCompleteDialog(record);
    resetForm();
  } catch (error) {
    console.error(error);
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

applyConfig(defaultConfig);
updateReferrerVisibility();
refreshConfig();
setupFloatingSubmitVisibility();
