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
  ageNotice: "만45세 이하 신청 가능",
  maleCapacity: 25,
  femaleCapacity: 25,
  heroImageUrl: "../assets/poster-beginner.png",
  posterImageUrl: "../assets/poster-beginner.png",
  timebarNotice: "타임 바 입장료 별도",
  paymentNotice: "입금 선착순 남녀 각각 25명",
};

let config = { ...defaultConfig, bankAccount: { ...defaultConfig.bankAccount } };
let isSubmitting = false;

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
const formStatus = document.querySelector("#formStatus");
const submittingOverlay = document.querySelector("#submittingOverlay");
const completeDialog = document.querySelector("#completeDialog");

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

function applyConfig(nextConfig = {}) {
  config = {
    ...defaultConfig,
    ...nextConfig,
    bankAccount: { ...defaultConfig.bankAccount, ...(nextConfig.bankAccount || {}) },
  };

  setText("#termLabel", config.termLabel);
  setText("#priceText", formatWon(config.price));
  setText("#summaryPrice", formatWon(config.price));
  setText("#bankText", `${config.bankAccount.bank} ${config.bankAccount.accountNumber}`);
  setText("#holderText", config.bankAccount.accountHolder);
  setText("#completeBank", `${config.bankAccount.bank} ${config.bankAccount.accountNumber}`);
  setText("#timebarNotice", config.timebarNotice);
  setText("#ageNotice", config.ageNotice);
  setText("#paymentNotice", config.paymentNotice);

  const heroImage = document.querySelector("#heroImage");
  if (heroImage && config.heroImageUrl) heroImage.src = config.heroImageUrl;
  updateDepositorPreview();
}

function updateDepositorPreview() {
  const depositorName = getDepositorName();
  setText("#depositorPreview", depositorName);
  setText("#summaryDepositor", depositorName);
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

function buildPayload() {
  return {
    nickname: fields.nickname.value.trim(),
    realName: fields.realName.value.trim(),
    gender: getGender(),
    phone: fields.phone.value.trim(),
    experience: fields.experience.value,
    source: fields.source.value,
    referrer: fields.referrer.value.trim(),
    message: fields.message.value.trim(),
  };
}

function setSubmitting(nextSubmitting) {
  isSubmitting = nextSubmitting;
  document.body.classList.toggle("is-submitting", isSubmitting);
  submittingOverlay.hidden = !isSubmitting;
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "신청 저장 중" : "신청하기";
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSubmitting) return;

  if (!validateForm()) {
    setStatus("입력 내용을 확인해주세요.", { error: true });
    document.querySelector(".field-error:not(:empty)")?.scrollIntoView({ behavior: "smooth", block: "center" });
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

document.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-copy-account]");
  if (copyButton) {
    copyAccountNumber(copyButton);
    return;
  }

  if (event.target.matches(".dialog-close")) {
    event.target.closest("dialog")?.close();
  }
});

applyConfig(defaultConfig);
refreshConfig();
