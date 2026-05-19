const {
  addApplication,
  calculate,
  formatWon,
  getConfig,
  getDepositorName,
  getEnabledLessons,
  roleLabels,
} = window.SweetySwingData;

const config = getConfig();
const lessons = getEnabledLessons(config);
const bankAccount = config.bankAccount;

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
const posterCaption = document.querySelector("#posterCaption");
const completeDialog = document.querySelector("#completeDialog");

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

function renderLessons() {
  lessonGrid.innerHTML = lessons
    .map(
      (lesson) => `
        <article class="lesson-card" data-lesson-card="${lesson.id}" tabindex="-1">
          <button class="poster-button" type="button" data-poster="${lesson.id}" aria-label="${lesson.name} 포스터 크게 보기">
            <img src="${lesson.poster}" alt="${lesson.caption || `${lesson.name} 포스터`}" />
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
}

function updateSummary() {
  const selectedLessons = getSelectedLessons();
  const applicantType = getApplicantType();
  const price = calculate(selectedLessons, applicantType, config);
  const depositorName = getDepositorName(selectedLessons, document.querySelector("#nickname").value, config);

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
  ["lessonError", "typeError", "nicknameError", "realNameError", "phoneError"].forEach((id) => setError(id, ""));
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
    applicantType,
    selectedClasses: selectedLessons.map((lesson) => ({
      id: lesson.id,
      name: lesson.name,
      shortName: lesson.shortName,
      category: lesson.category,
      price: lesson.price,
      role: getRole(lesson.id),
    })),
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

applyConfigText();
renderLessons();
updateLessonCards();
updateSummary();

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

document.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-copy-account]");
  if (copyButton) {
    copyAccountNumber(copyButton);
    return;
  }

  const posterButton = event.target.closest("[data-poster]");
  if (posterButton) {
    const lesson = lessons.find((item) => item.id === posterButton.dataset.poster);
    if (!lesson) return;
    posterLarge.src = lesson.poster;
    posterLarge.alt = lesson.caption || `${lesson.name} 포스터`;
    posterCaption.textContent = lesson.name;
    posterDialog.showModal();
  }

  if (event.target.matches(".dialog-close")) {
    event.target.closest("dialog")?.close();
  }
});

document.querySelector("#mobileSubmit").addEventListener("click", () => {
  document.querySelector("#signupForm").requestSubmit();
});

document.querySelector("#signupForm").addEventListener("submit", (event) => {
  event.preventDefault();
  updateLessonCards();
  updateSummary();

  if (!validateForm()) {
    if (!focusFirstInvalidLessonCard()) {
      document.querySelector(".field-error:not(:empty)")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  const payload = addApplication(buildPayload());
  console.log("신청 데이터", payload);
  completeDepositor.textContent = payload.recommendedDepositorName;
  completeAmount.textContent = formatWon(payload.finalAmount);
  completeDialog.showModal();
});
