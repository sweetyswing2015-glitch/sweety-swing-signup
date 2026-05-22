const {
  addApplication,
  calculate,
  formatWon,
  getConfig,
  getDepositorName,
  getEnabledLessons,
  refreshConfig,
  roleLabels,
  USE_REMOTE_API,
} = window.SweetySwingData;

let config = getConfig();
let lessons = getEnabledLessons(config);
let bankAccount = config.bankAccount;
const ASSET_CACHE_VERSION = "20260521-discount-rules";
const pageMode = document.body.dataset.pageMode || "";
const previewMode = new URLSearchParams(window.location.search).get("preview") || "";
const isTestPage = pageMode === "test";
const isClosedPreview = previewMode === "closed";

const lessonGrid = document.querySelector("#lessonGrid");
const selectedList = document.querySelector("#selectedList");
const discountDetails = document.querySelector("#discountDetails");
const subtotalText = document.querySelector("#subtotalText");
const discountText = document.querySelector("#discountText");
const finalText = document.querySelector("#finalText");
const mobileFinalText = document.querySelector("#mobileFinalText");
const depositorPreview = document.querySelector("#depositorPreview");
const summaryDepositor = document.querySelector("#summaryDepositor");
const completeDepositor = document.querySelector("#completeDepositor");
const completeAmount = document.querySelector("#completeAmount");
const posterDialog = document.querySelector("#posterDialog");
const posterLarge = document.querySelector("#posterLarge");
const completeDialog = document.querySelector("#completeDialog");
const heroSection = document.querySelector(".hero");
const closedNotice = document.querySelector("#closedNotice");
const closedNoticeMessage = document.querySelector("#closedNoticeMessage");
const closedIntroSignupLink = document.querySelector("#closedIntroSignupLink");
const signupForm = document.querySelector("#signupForm");
const mobileTotal = document.querySelector(".mobile-total");
const configLoadingBar = document.querySelector("#configLoadingBar");
const configLoadingText = document.querySelector("#configLoadingText");
const swingExperienceField = document.querySelector("#swingExperienceField");
const swingExperienceInput = document.querySelector("#swingExperience");
const submitButtons = [
  document.querySelector('#signupForm button[type="submit"]'),
  document.querySelector("#mobileSubmit"),
].filter(Boolean);
let isSubmitting = false;
let isConfigReady = !USE_REMOTE_API;

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function applyConfigState(nextConfig) {
  config = nextConfig || getConfig();
  applyPageModeOverrides();
  lessons = getEnabledLessons(config);
  bankAccount = config.bankAccount;
}

function applyPageModeOverrides() {
  if (isClosedPreview) {
    config = {
      ...config,
      applicationStartDate: config.applicationStartDate || "2026-06-01",
      applicationEndDate: config.applicationEndDate || "2026-06-30",
      signupOpen: false,
      signupClosedReason: config.signupClosedReason || "before",
    };
  }

  if (isTestPage) {
    config = {
      ...config,
      signupOpen: true,
      signupClosedReason: "",
    };
  }
}

function applyConfigText() {
  document.querySelector("#termLabel").textContent = config.termLabel;
  document.querySelector("#firstIntermediateTitle").textContent = config.firstIntermediateLabel;
  document.querySelector("#firstIntermediateDescription").textContent = config.firstIntermediateDescription;

  const introLink = document.querySelector("#introSignupLink");
  introLink.href = config.introSignupUrl || "#";
  introLink.toggleAttribute("aria-disabled", !config.introSignupUrl || config.introSignupUrl === "#");

  document.querySelectorAll("[data-bank-account]").forEach((node) => {
    node.textContent = `${bankAccount.bank} ${bankAccount.accountNumber}`;
  });
  document.querySelectorAll("[data-bank-holder]").forEach((node) => {
    node.textContent = `예금주: ${bankAccount.accountHolder}`;
  });
}

function formatDateLabel(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  return `${match[1]}.${match[2]}.${match[3]}`;
}

function getClosedMessage() {
  const startDate = formatDateLabel(config.applicationStartDate);
  const endDate = formatDateLabel(config.applicationEndDate);
  const period = [startDate, endDate].filter(Boolean).join(" ~ ");

  if (config.signupClosedReason === "before") {
    return period ? `신청 기간은 ${period}입니다. 시작일 이후 다시 방문해주세요.` : "신청 기간이 열리면 이 페이지에서 신청할 수 있습니다.";
  }
  if (config.signupClosedReason === "after") {
    return period ? `신청 기간은 ${period}까지였습니다. 다음 강습 신청을 기다려주세요.` : "신청 기간이 종료되었습니다.";
  }
  return "신청 기간이 열리면 이 페이지에서 신청할 수 있습니다.";
}

function applySignupPeriodState() {
  const isOpen = config.signupOpen !== false;
  heroSection.hidden = !isOpen;
  closedNotice.hidden = isOpen;
  signupForm.hidden = !isOpen;
  mobileTotal.hidden = !isOpen;
  if (!isOpen) {
    closedNoticeMessage.textContent = getClosedMessage();
  }

  closedIntroSignupLink.href = config.introSignupUrl || "#";
  closedIntroSignupLink.toggleAttribute("aria-disabled", !config.introSignupUrl || config.introSignupUrl === "#");
}

function getPosterSrc(lesson) {
  const poster = lesson?.poster || "";
  if (!poster) return "";
  const separator = poster.includes("?") ? "&" : "?";
  return `${poster}${separator}sitev=${ASSET_CACHE_VERSION}`;
}

function renderLessons() {
  lessonGrid.innerHTML = lessons
    .map(
      (lesson) => `
        <article class="lesson-card" data-lesson-card="${lesson.id}" tabindex="-1">
          <button class="poster-button" type="button" data-poster="${lesson.id}" aria-label="${lesson.name} 포스터 크게 보기">
            <img src="${getPosterSrc(lesson)}" alt="${lesson.caption || `${lesson.name} 포스터`}" />
          </button>
          <div class="lesson-head">
            <div>
              <h3>${lesson.name}</h3>
              <p>${lesson.category === "training" ? "트레이닝 강습" : "정규 강습"}</p>
            </div>
            <span class="price-badge">${formatWon(lesson.price)}</span>
          </div>
          <label class="select-line">
            <input type="checkbox" name="lesson" value="${lesson.id}" />
            <span>${lesson.name} 신청</span>
          </label>
          <fieldset class="role-box" aria-label="${lesson.name} 역할 선택">
            <legend>${lesson.name} 역할</legend>
            <div class="role-options">
              <label>
                <input type="radio" name="role-${lesson.id}" value="leader" aria-describedby="role-error-${lesson.id}" disabled />
                <span>리더</span>
              </label>
              <label>
                <input type="radio" name="role-${lesson.id}" value="follower" aria-describedby="role-error-${lesson.id}" disabled />
                <span>팔뤄</span>
              </label>
            </div>
          </fieldset>
          <p id="role-error-${lesson.id}" class="field-error role-error" data-role-error="${lesson.id}" role="alert"></p>
        </article>
      `,
    )
    .join("");
}

function getLessonFormState() {
  const selectedIds = $all('input[name="lesson"]:checked').map((input) => input.value);
  const roles = Object.fromEntries(
    $all('input[type="radio"][name^="role-"]:checked').map((input) => [input.name.replace("role-", ""), input.value]),
  );
  return { selectedIds, roles };
}

function restoreLessonFormState(state) {
  if (!state) return;
  state.selectedIds.forEach((lessonId) => {
    const checkbox = document.querySelector(`input[name="lesson"][value="${lessonId}"]`);
    if (checkbox) checkbox.checked = true;
  });
  Object.entries(state.roles).forEach(([lessonId, role]) => {
    const radio = document.querySelector(`input[name="role-${lessonId}"][value="${role}"]`);
    if (radio) radio.checked = true;
  });
}

function renderPage({ preserveLessonState = false } = {}) {
  const lessonState = preserveLessonState ? getLessonFormState() : null;
  applyConfigText();
  applySignupPeriodState();
  renderLessons();
  restoreLessonFormState(lessonState);
  updateLessonCards();
  updateSummary();
  updateSubmitButtons();
}

function updateConfigLoadingBar({ error = false } = {}) {
  if (!configLoadingBar) return;
  configLoadingBar.hidden = isConfigReady && !error;
  configLoadingBar.classList.toggle("is-error", error);
  if (configLoadingText) {
    configLoadingText.textContent = error
      ? "최신 강습 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요."
      : "최신 강습 정보를 확인하는 중입니다.";
  }
}

function getSelectedLessons() {
  return lessons.filter((lesson) => {
    const input = document.querySelector(`input[name="lesson"][value="${lesson.id}"]`);
    return input?.checked;
  });
}

function getApplicantType() {
  return document.querySelector('input[name="applicantType"]:checked')?.value ?? "";
}

function getRole(lessonId) {
  return document.querySelector(`input[name="role-${lessonId}"]:checked`)?.value ?? "";
}

function hasTrainingLesson(selectedLessons = getSelectedLessons()) {
  return selectedLessons.some((lesson) => lesson.category === "training");
}

function normalizeSwingExperience(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d+)\s*년\s*(\d+)\s*개월$/);
  if (!match) return "";
  return `${Number(match[1])}년 ${Number(match[2])}개월`;
}

function buildSelectedClasses(selectedLessons) {
  return selectedLessons.map((lesson) => ({
    id: lesson.id,
    name: lesson.name,
    shortName: lesson.shortName,
    category: lesson.category,
    price: lesson.price,
    role: getRole(lesson.id),
  }));
}

function shouldSkipLessonCardToggle(target) {
  return Boolean(
    target.closest(".poster-button, .role-box, .select-line, a, button, input, select, textarea, label"),
  );
}

function toggleLessonFromCardClick(target) {
  const card = target.closest("[data-lesson-card]");
  if (!card || shouldSkipLessonCardToggle(target)) return false;
  const checkbox = card.querySelector(`input[name="lesson"][value="${card.dataset.lessonCard}"]`);
  if (!checkbox) return false;
  checkbox.checked = !checkbox.checked;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function updateLessonCards() {
  lessons.forEach((lesson) => {
    const card = document.querySelector(`[data-lesson-card="${lesson.id}"]`);
    const checkbox = document.querySelector(`input[name="lesson"][value="${lesson.id}"]`);
    const isSelected = Boolean(checkbox?.checked);
    const roleInputs = document.querySelectorAll(`input[name="role-${lesson.id}"]`);
    card?.classList.toggle("is-selected", isSelected);
    roleInputs.forEach((input) => {
      input.disabled = !isSelected;
      input.required = isSelected;
      input.setAttribute("aria-required", String(isSelected));
      if (!isSelected) {
        input.checked = false;
      }
    });
    if (!isSelected) {
      card?.classList.remove("has-error");
      setRoleError(lesson.id, "");
    }
  });
  updateSwingExperienceVisibility();
}

function updateSwingExperienceVisibility() {
  if (!swingExperienceField || !swingExperienceInput) return;
  const shouldShow = hasTrainingLesson();
  swingExperienceField.hidden = !shouldShow;
  swingExperienceInput.required = shouldShow;
  swingExperienceInput.setAttribute("aria-required", String(shouldShow));
  if (!shouldShow) {
    swingExperienceInput.value = "";
    setError("swingExperienceError", "");
  }
}

function renderSummary(selectedLessons, price, depositorName) {

  selectedList.innerHTML = selectedLessons.length
    ? selectedLessons
        .map((lesson) => {
          const role = getRole(lesson.id);
          return `
            <div class="selected-item">
              <div>
                <strong>${lesson.name}</strong>
                <span>${role ? roleLabels[role] : "역할 미선택"}</span>
              </div>
              <b>${formatWon(lesson.price)}</b>
            </div>
          `;
        })
        .join("")
    : `<p class="empty">강습을 선택하면 요약이 표시됩니다.</p>`;

  subtotalText.textContent = formatWon(price.subtotal);
  discountText.textContent = price.discountAmount ? `-${formatWon(price.discountAmount)}` : "0원";
  finalText.textContent = formatWon(price.finalAmount);
  mobileFinalText.textContent = formatWon(price.finalAmount);
  depositorPreview.textContent = depositorName;
  summaryDepositor.textContent = depositorName;

  if (price.details.length > 0) {
    discountDetails.innerHTML = price.details.map((detail) => `<li>${detail}</li>`).join("");
  } else {
    discountDetails.innerHTML = `<li>${price.hint || "적용된 할인이 없습니다."}</li>`;
  }
}

function updateSummary() {
  const selectedLessons = getSelectedLessons();
  const applicantType = getApplicantType();
  const price = calculate(selectedLessons, applicantType, config);
  const depositorName = getDepositorName(selectedLessons, document.querySelector("#nickname").value, config);

  renderSummary(selectedLessons, price, depositorName);
}

function setError(id, message) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = message;
}

function setRoleError(lessonId, message) {
  const node = document.querySelector(`[data-role-error="${lessonId}"]`);
  if (node) node.textContent = message;
}

function clearRoleError(lessonId) {
  setRoleError(lessonId, "");
  document.querySelector(`[data-lesson-card="${lessonId}"]`)?.classList.remove("has-error");
}

function focusFirstInvalidLessonCard() {
  const card = document.querySelector(".lesson-card.has-error");
  if (!card) return false;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.focus({ preventScroll: true });
  return true;
}

function clearErrors() {
  ["lessonError", "typeError", "nicknameError", "realNameError", "phoneError", "swingExperienceError"].forEach((id) => setError(id, ""));
  document.querySelectorAll(".lesson-card").forEach((card) => card.classList.remove("has-error"));
  document.querySelectorAll("[data-role-error]").forEach((node) => {
    node.textContent = "";
  });
}

function validateForm() {
  clearErrors();
  const selectedLessons = getSelectedLessons();
  const applicantType = getApplicantType();
  const nickname = document.querySelector("#nickname").value.trim();
  const realName = document.querySelector("#realName").value.trim();
  const phone = document.querySelector("#phone").value.trim();
  const needsSwingExperience = hasTrainingLesson(selectedLessons);
  const swingExperience = normalizeSwingExperience(swingExperienceInput?.value || "");
  let isValid = true;

  if (selectedLessons.length === 0) {
    setError("lessonError", "신청할 강습을 최소 1개 이상 선택해주세요.");
    isValid = false;
  }

  const missingRoleLessons = selectedLessons.filter((lesson) => !getRole(lesson.id));
  missingRoleLessons.forEach((lesson) => {
    document.querySelector(`[data-lesson-card="${lesson.id}"]`)?.classList.add("has-error");
    setRoleError(lesson.id, "이 강습의 리더/팔뤄 역할을 선택해주세요.");
  });
  if (missingRoleLessons.length > 0) {
    isValid = false;
  }
  if (!applicantType) {
    setError("typeError", "신청자 유형을 선택해주세요.");
    isValid = false;
  }

  if (!nickname) {
    setError("nicknameError", "닉네임을 입력해주세요.");
    isValid = false;
  }

  if (!realName) {
    setError("realNameError", "이름을 입력해주세요.");
    isValid = false;
  }

  if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)) {
    setError("phoneError", "휴대폰 번호 형식으로 입력해주세요. 예: 010-0000-0000");
    isValid = false;
  }

  if (needsSwingExperience && !swingExperience) {
    setError("swingExperienceError", "스윙경력을 0년 0개월 형식으로 입력해주세요.");
    isValid = false;
  }

  return isValid;
}

function buildPayload() {
  const selectedLessons = getSelectedLessons();
  const applicantType = getApplicantType();
  const price = calculate(selectedLessons, applicantType, config);

  return {
    nickname: document.querySelector("#nickname").value.trim(),
    realName: document.querySelector("#realName").value.trim(),
    phone: document.querySelector("#phone").value.trim(),
    swingExperience: hasTrainingLesson(selectedLessons) ? normalizeSwingExperience(swingExperienceInput?.value || "") : "",
    applicantType,
    selectedClasses: buildSelectedClasses(selectedLessons),
    subtotal: price.subtotal,
    discountAmount: price.discountAmount,
    discountDetails: price.details,
    finalAmount: price.finalAmount,
    bankAccount,
    recommendedDepositorName: getDepositorName(selectedLessons, document.querySelector("#nickname").value, config),
    submittedAt: new Date().toISOString(),
  };
}

function normalizePhone(value) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  if (numbers.length < 4) return numbers;
  if (numbers.length < 8) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, numbers.length - 4)}-${numbers.slice(-4)}`;
}

async function copyAccountNumber(button) {
  const text = bankAccount.accountNumber;
  const fallbackCopy = () => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Fallback copy failed");
  };

  try {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        fallbackCopy();
      }
    } else {
      fallbackCopy();
    }
    button.textContent = "복사됨";
    button.classList.add("is-copied");
    window.setTimeout(() => {
      button.textContent = "복사";
      button.classList.remove("is-copied");
    }, 1600);
  } catch {
    const accountText = button.closest(".bank-copy-row")?.querySelector("[data-bank-account]");
    if (accountText) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(accountText);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    button.textContent = "번호 선택됨";
    button.classList.add("is-copied");
    window.setTimeout(() => {
      button.textContent = "복사";
      button.classList.remove("is-copied");
    }, 1600);
  }
}

function updateSubmitButtons() {
  submitButtons.forEach((button) => {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.disabled = isSubmitting || !isConfigReady;
    button.textContent = isSubmitting ? "신청 저장 중" : isConfigReady ? button.dataset.originalText : "정보 확인 중";
  });
}

async function refreshPageConfig() {
  if (!USE_REMOTE_API) {
    isConfigReady = true;
    updateConfigLoadingBar();
    updateSubmitButtons();
    return;
  }

  try {
    const nextConfig = await refreshConfig();
    isConfigReady = true;
    applyConfigState(nextConfig);
    renderPage({ preserveLessonState: true });
    updateConfigLoadingBar();
  } catch (error) {
    console.error(error);
    isConfigReady = false;
    updateSubmitButtons();
    updateConfigLoadingBar({ error: true });
  }
}

function boot() {
  applyConfigState(getConfig());
  updateConfigLoadingBar();
  renderPage();
  refreshPageConfig();
}

boot();

document.addEventListener("change", (event) => {
  if (event.target.matches('input[name="lesson"]')) updateLessonCards();
  if (event.target.matches('input[type="radio"][name^="role-"]')) {
    clearRoleError(event.target.name.replace("role-", ""));
  }
  if (event.target.matches("input")) updateSummary();
});

document.querySelector("#nickname").addEventListener("input", updateSummary);
document.querySelector("#phone").addEventListener("input", (event) => {
  event.target.value = normalizePhone(event.target.value);
});
swingExperienceInput?.addEventListener("blur", (event) => {
  const normalized = normalizeSwingExperience(event.target.value);
  if (normalized) event.target.value = normalized;
});

document.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-copy-account]");
  if (copyButton) {
    copyAccountNumber(copyButton);
    return;
  }

  if (toggleLessonFromCardClick(event.target)) return;

  const posterButton = event.target.closest("[data-poster]");
  if (posterButton) {
    const lesson = lessons.find((item) => item.id === posterButton.dataset.poster);
    if (!lesson) return;
    posterLarge.src = getPosterSrc(lesson);
    posterLarge.alt = lesson.caption || `${lesson.name} 포스터`;
    posterDialog.showModal();
  }

  if (event.target.matches(".dialog-close")) {
    event.target.closest("dialog")?.close();
  }
});

document.querySelector("#mobileSubmit").addEventListener("click", () => {
  document.querySelector("#signupForm").requestSubmit();
});

function setSubmitting(nextSubmitting) {
  isSubmitting = nextSubmitting;
  updateSubmitButtons();
}

document.querySelector("#signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSubmitting || !isConfigReady) return;
  if (config.signupOpen === false) {
    closedNotice.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (isTestPage) {
    alert("테스트 화면에서는 신청 저장을 하지 않습니다. 강습 정보와 금액 확인용으로만 사용해주세요.");
    return;
  }
  updateLessonCards();
  updateSummary();

  if (!validateForm()) {
    if (!focusFirstInvalidLessonCard()) {
      document.querySelector(".field-error:not(:empty)")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  try {
    setSubmitting(true);
    const payload = await addApplication(buildPayload());
    console.log("신청 데이터", payload);
    completeDepositor.textContent = payload.recommendedDepositorName;
    completeAmount.textContent = formatWon(payload.finalAmount);
    completeDialog.showModal();
  } catch (error) {
    console.error(error);
    if (error.message.includes("현재 강습 신청 기간")) {
      config.signupOpen = false;
      applySignupPeriodState();
      closedNotice.scrollIntoView({ behavior: "smooth", block: "center" });
      alert(error.message);
      return;
    }
    alert("신청 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    setSubmitting(false);
  }
});
