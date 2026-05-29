const API_URL = "https://script.google.com/macros/s/AKfycbyXhHR_VEz_0a4guDUBI8t1VK88pFcbryxNovMZwQDqlkg0Vc3dAOi_YNInDSx9qQ-R/exec";
const CONFIG_CACHE_KEY = "sweetySwingOnedayConfig:v1";
const CONFIG_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

const defaultConfig = {
  classTitle: "스위티스윙 6월 원데이 클래스",
  heroLeadText: "스윙댄스가 궁금했다면, 가볍게 하루 먼저 만나보세요. 처음이어도 편하게 따라올 수 있게 준비해둘게요.",
  mainImageUrl: "./assets/intro-hero.png?v=137-regular-20260523011840",
  heroImageUrl: "./assets/intro-hero.png?v=137-regular-20260523011840",
  posterImageUrl: "./assets/oneday-poster.png?v=137-regular-20260529203900",
  posterVideoUrl: "./assets/oneday-poster-video.mov?v=137-regular-20260529212209",
  lessonDate: "6월 13일(토)",
  lessonTime: "오후 5:30 ~ 7:20",
  lessonPlace: "Swing Time Bar (선릉역 5번 출구)",
  kakaoMapUrl: "",
  naverMapUrl: "",
  lessonFee: "무료!",
  spaceFeeNotice: "공간이용료 12,000원 현장 결제",
  promoCta: "원데이 신청하기",
  successMessage: "신청이 완료되었습니다. 강습 때 만나요 :)",
};

let config = { ...defaultConfig };
let isSubmitting = false;
let isConfigReady = false;
let posterVideoUrl = "";
let isPosterVideoLoading = false;
let hasPosterVideoStarted = false;

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
const posterDialog = document.querySelector("#posterDialog");
const posterLarge = document.querySelector("#posterLarge");
const posterImage = document.querySelector("#posterImage");
const posterVideo = document.querySelector("#posterVideo");
const heroVisual = document.querySelector("#heroVisual");
const heroImage = document.querySelector("#heroImage");
const posterCard = document.querySelector("#posterCard");
const videoCard = document.querySelector("#videoCard");
const signupShell = document.querySelector("#apply");
const videoPlayButton = document.querySelector("#videoPlayButton");
const videoThumb = document.querySelector("#videoThumb");
const videoStatus = document.querySelector("#videoStatus");

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
  if (!node) return;
  node.textContent = value;
  node.classList.add("sheet-value");
}

function normalizeImageUrl(value) {
  const url = String(value || "").trim();
  if (url.startsWith("./assets/")) return `../${url.slice(2)}`;
  if (url.startsWith("assets/")) return `../${url}`;
  const driveId = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1] || url.match(/[?&]id=([^&]+)/)?.[1];
  if (driveId) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`;
  return url;
}

function textOrDefault(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function optionalConfigText(source, key, fallback = "") {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return fallback;
  return String(source[key] ?? "").trim();
}

function visualConfigText(source, key, fallback = "") {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return fallback;
  return String(source[key] ?? "").trim() || fallback;
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

function normalizeExternalUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(https?:|kakaomap:|nmap:|navermaps:|intent:)/i.test(url)) return url;
  return "";
}

function setLessonPlace(value) {
  const row = document.querySelector("#lessonPlaceRow");
  const placeText = document.querySelector("#lessonPlaceText");
  const mapLinks = document.querySelector("#mapAppLinks");
  const kakaoLink = document.querySelector("#kakaoMapLink");
  const naverLink = document.querySelector("#naverMapLink");
  const text = String(value || "").trim();
  const kakaoUrl = normalizeExternalUrl(config.kakaoMapUrl);
  const naverUrl = normalizeExternalUrl(config.naverMapUrl);
  const hasLinks = Boolean(text && (kakaoUrl || naverUrl));

  if (row) row.hidden = !text;
  if (placeText) placeText.textContent = text;
  placeText?.classList.add("sheet-value");
  if (mapLinks) mapLinks.hidden = !hasLinks;
  if (kakaoLink) {
    kakaoLink.href = kakaoUrl || "#";
    kakaoLink.hidden = !kakaoUrl;
  }
  if (naverLink) {
    naverLink.href = naverUrl || "#";
    naverLink.hidden = !naverUrl;
  }
}

function setImageRegion(wrapper, image, url, fallbackAlt) {
  if (!wrapper || !image) return;
  const normalizedUrl = normalizeImageUrl(url);
  wrapper.hidden = !normalizedUrl;
  if (!normalizedUrl) {
    image.removeAttribute("src");
    return;
  }
  image.src = normalizedUrl;
  image.alt = fallbackAlt;
}

function setPosterMedia() {
  const videoUrl = normalizeImageUrl(config.posterVideoUrl);
  const imageUrl = normalizeImageUrl(config.posterImageUrl);

  if (posterCard) posterCard.hidden = !imageUrl;
  const imageButton = posterImage?.closest(".poster-open-button");
  if (imageButton) imageButton.hidden = !imageUrl;
  if (posterImage) {
    if (imageUrl) {
      posterImage.src = imageUrl;
      posterImage.alt = `${config.classTitle} 포스터`;
    } else {
      posterImage.removeAttribute("src");
    }
  }

  posterVideoUrl = videoUrl;
  signupShell?.classList.toggle("has-video", Boolean(videoUrl));
  if (videoCard) videoCard.hidden = false;
  if (videoThumb) {
    const thumbUrl = imageUrl || normalizeImageUrl(config.mainImageUrl || config.heroImageUrl);
    if (thumbUrl) videoThumb.src = thumbUrl;
  }
  if (videoPlayButton) videoPlayButton.hidden = false;
  if (videoStatus && !isPosterVideoLoading && !hasPosterVideoStarted) {
    videoStatus.textContent = videoUrl ? "영상 보기" : "영상 준비 중";
  }

  if (!videoUrl) {
    resetPosterVideo("영상 준비 중");
  }
}

function resetPosterVideo(message = "영상 보기") {
  isPosterVideoLoading = false;
  hasPosterVideoStarted = false;
  videoCard?.classList.remove("is-loading", "is-playing");
  if (videoPlayButton) videoPlayButton.hidden = false;
  if (videoStatus) videoStatus.textContent = message;
  if (!posterVideo) return;
  posterVideo.pause();
  posterVideo.hidden = true;
  posterVideo.removeAttribute("src");
  posterVideo.load();
}

function waitForPosterVideoReady() {
  if (!posterVideo) return Promise.reject(new Error("영상 요소를 찾을 수 없습니다."));
  if (posterVideo.readyState >= 2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      posterVideo.removeEventListener("loadeddata", handleReady);
      posterVideo.removeEventListener("canplay", handleReady);
      posterVideo.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("영상을 불러오지 못했습니다."));
    };
    posterVideo.addEventListener("loadeddata", handleReady, { once: true });
    posterVideo.addEventListener("canplay", handleReady, { once: true });
    posterVideo.addEventListener("error", handleError, { once: true });
  });
}

async function startPosterVideo() {
  if (!posterVideoUrl || !posterVideo || isPosterVideoLoading) return;
  isPosterVideoLoading = true;
  videoCard?.classList.add("is-loading");
  videoCard?.classList.remove("is-playing");
  if (videoStatus) videoStatus.textContent = "영상 불러오는 중";

  try {
    posterVideo.hidden = false;
    if (posterVideo.src !== posterVideoUrl) posterVideo.src = posterVideoUrl;
    posterVideo.load();
    await waitForPosterVideoReady();
    isPosterVideoLoading = false;
    hasPosterVideoStarted = true;
    videoCard?.classList.remove("is-loading");
    videoCard?.classList.add("is-playing");
    if (videoPlayButton) videoPlayButton.hidden = true;
    await posterVideo.play();
  } catch (error) {
    console.warn("원데이 영상 재생 실패", error);
    resetPosterVideo("영상 다시 보기");
  }
}

function applyConfig(nextConfig = {}) {
  config = {
    ...defaultConfig,
    ...nextConfig,
  };
  config.classTitle = textOrDefault(nextConfig.classTitle, defaultConfig.classTitle);
  config.heroLeadText = visualConfigText(nextConfig, "heroLeadText", defaultConfig.heroLeadText);
  config.mainImageUrl = visualConfigText(nextConfig, "mainImageUrl", defaultConfig.mainImageUrl);
  config.heroImageUrl = visualConfigText(nextConfig, "heroImageUrl", defaultConfig.heroImageUrl);
  config.posterImageUrl = visualConfigText(nextConfig, "posterImageUrl", defaultConfig.posterImageUrl);
  config.posterVideoUrl = visualConfigText(nextConfig, "posterVideoUrl", defaultConfig.posterVideoUrl);
  config.lessonDate = optionalConfigText(nextConfig, "lessonDate", defaultConfig.lessonDate);
  config.lessonTime = optionalConfigText(nextConfig, "lessonTime", defaultConfig.lessonTime);
  config.lessonPlace = optionalConfigText(nextConfig, "lessonPlace", defaultConfig.lessonPlace);
  config.kakaoMapUrl = optionalConfigText(nextConfig, "kakaoMapUrl", defaultConfig.kakaoMapUrl);
  config.naverMapUrl = optionalConfigText(nextConfig, "naverMapUrl", defaultConfig.naverMapUrl);
  config.lessonFee = optionalConfigText(nextConfig, "lessonFee", defaultConfig.lessonFee);
  config.spaceFeeNotice = optionalConfigText(nextConfig, "spaceFeeNotice", defaultConfig.spaceFeeNotice);
  config.promoCta = textOrDefault(nextConfig.promoCta, defaultConfig.promoCta);
  config.successMessage = optionalConfigText(nextConfig, "successMessage", defaultConfig.successMessage);

  setText("#classTitle", config.classTitle);
  setText("#heroLeadText", config.heroLeadText);
  setOptionalRow("#lessonDateRow", "#lessonDateText", config.lessonDate);
  setOptionalRow("#lessonTimeRow", "#lessonTimeText", config.lessonTime);
  setLessonPlace(config.lessonPlace);
  setOptionalRow("#lessonFeeRow", "#lessonFeeText", config.lessonFee);
  setOptionalText("#spaceFeeText", config.spaceFeeNotice);
  setOptionalText("#completeMessage", config.successMessage);
  setImageRegion(heroVisual, heroImage, config.mainImageUrl || config.heroImageUrl, `${config.classTitle} 사진`);
  setPosterMedia();
  updateSubmitButton();
  document.title = `${config.classTitle} 신청`;
}

function readCachedConfig({ allowExpired = false } = {}) {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY) || "null");
    if (!cached?.config) return null;
    if (!allowExpired && Date.now() - Number(cached.savedAt || 0) > CONFIG_CACHE_MAX_AGE_MS) return null;
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
    applyConfig(readCachedConfig({ allowExpired: true }) || defaultConfig);
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
  const posterTarget = event.target.closest("#posterCard");
  if (posterTarget && posterDialog && posterLarge && posterImage) {
    posterLarge.src = posterImage.currentSrc || posterImage.src;
    posterLarge.alt = posterImage.alt || "원데이 클래스 포스터";
    posterDialog.showModal();
    return;
  }

  if (event.target.closest("#videoPlayButton")) {
    startPosterVideo();
    return;
  }

  if (event.target.matches(".dialog-close")) {
    event.target.closest("dialog")?.close();
  }
});

applyConfig(readCachedConfig({ allowExpired: true }) || defaultConfig);
updateReferrerVisibility();
refreshConfig();
