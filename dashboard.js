const Store = window.SweetySwingData;
const page = document.body.dataset.page;

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function setToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(setToast.timer);
  setToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function activeApplications() {
  return Store.getApplications().filter((application) => application.status !== "cancelled");
}

function lessonOptions(config, selected = "all") {
  return [
    `<option value="all"${selected === "all" ? " selected" : ""}>전체 강습</option>`,
    ...config.lessons
      .filter((lesson) => lesson.enabled !== false)
      .map((lesson) => `<option value="${lesson.id}"${selected === lesson.id ? " selected" : ""}>${escapeHtml(lesson.name)}</option>`),
  ].join("");
}

function selectedClassText(application) {
  return (application.selectedClasses || [])
    .map((item) => `${escapeHtml(item.name)} <span>${Store.roleLabels[item.role] || item.role}</span>`)
    .join("<br />");
}

function selectedClassPlain(application) {
  return (application.selectedClasses || [])
    .map((item) => `${item.name}(${Store.roleLabels[item.role] || item.role})`)
    .join(", ");
}

function saveBlob(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function initSettingsPage() {
  const config = Store.getConfig();
  $("#termLabelInput").value = config.termLabel;
  $("#firstIntermediateLabelInput").value = config.firstIntermediateLabel;
  $("#firstIntermediateDescriptionInput").value = config.firstIntermediateDescription;
  $("#introSignupUrlInput").value = config.introSignupUrl === "#" ? "" : config.introSignupUrl;
  $("#bankInput").value = config.bankAccount.bank;
  $("#accountNumberInput").value = config.bankAccount.accountNumber;
  $("#accountHolderInput").value = config.bankAccount.accountHolder;
  $("#trainingDiscountInput").value = config.discounts.firstIntermediateTraining;
  $("#generalTwoDiscountInput").value = config.discounts.generalTwoClasses;
  $("#generalThreeDiscountInput").value = config.discounts.generalThreePlusClasses;

  $("#lessonEditor").innerHTML = config.lessons
    .map(
      (lesson) => `
        <article class="lesson-editor-row" data-lesson-id="${lesson.id}">
          <img class="lesson-editor-preview" src="${escapeHtml(lesson.poster)}" alt="${escapeHtml(lesson.name)} 포스터 미리보기" />
          <div class="lesson-editor-fields">
            <label class="toggle-line">
              <input type="checkbox" data-field="enabled"${lesson.enabled !== false ? " checked" : ""} />
              <span>신청 페이지에 노출</span>
            </label>
            <label>
              <span>강습명</span>
              <input type="text" data-field="name" value="${escapeHtml(lesson.name)}" />
            </label>
            <label>
              <span>입금자명용 강좌명</span>
              <input type="text" data-field="shortName" value="${escapeHtml(lesson.shortName)}" />
            </label>
            <label>
              <span>가격</span>
              <input type="number" min="0" step="500" data-field="price" value="${Number(lesson.price || 0)}" />
            </label>
            <label>
              <span>구분</span>
              <select data-field="category">
                <option value="regular"${lesson.category === "regular" ? " selected" : ""}>정규 강습</option>
                <option value="training"${lesson.category === "training" ? " selected" : ""}>트레이닝</option>
              </select>
            </label>
            <label class="wide">
              <span>포스터 경로 또는 URL</span>
              <input type="text" data-field="poster" value="${escapeHtml(lesson.poster)}" />
            </label>
            <label class="wide">
              <span>포스터 파일로 교체</span>
              <input type="file" accept="image/*" data-poster-upload />
              <small>파일을 고르면 이 브라우저에 저장됩니다. 실제 운영에서는 이미지 파일을 assets 폴더에 넣고 경로를 쓰는 방식이 가장 안정적입니다.</small>
            </label>
          </div>
        </article>
      `,
    )
    .join("");

  $("#lessonEditor").addEventListener("input", (event) => {
    if (event.target.matches('[data-field="poster"]')) {
      const row = event.target.closest(".lesson-editor-row");
      $(".lesson-editor-preview", row).src = event.target.value;
    }
  });

  $("#lessonEditor").addEventListener("change", (event) => {
    if (!event.target.matches("[data-poster-upload]")) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const row = event.target.closest(".lesson-editor-row");
    const reader = new FileReader();
    reader.onload = () => {
      $('[data-field="poster"]', row).value = reader.result;
      $(".lesson-editor-preview", row).src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  $("#settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const current = Store.getConfig();
    const next = {
      ...current,
      termLabel: $("#termLabelInput").value.trim() || current.termLabel,
      firstIntermediateLabel: $("#firstIntermediateLabelInput").value.trim() || current.firstIntermediateLabel,
      firstIntermediateDescription: $("#firstIntermediateDescriptionInput").value.trim() || current.firstIntermediateDescription,
      introSignupUrl: $("#introSignupUrlInput").value.trim() || "#",
      bankAccount: {
        bank: $("#bankInput").value.trim() || current.bankAccount.bank,
        accountNumber: $("#accountNumberInput").value.trim() || current.bankAccount.accountNumber,
        accountHolder: $("#accountHolderInput").value.trim() || current.bankAccount.accountHolder,
      },
      discounts: {
        firstIntermediateTraining: Number($("#trainingDiscountInput").value || 0),
        generalTwoClasses: Number($("#generalTwoDiscountInput").value || 0),
        generalThreePlusClasses: Number($("#generalThreeDiscountInput").value || 0),
      },
      lessons: $all(".lesson-editor-row").map((row) => ({
        ...current.lessons.find((lesson) => lesson.id === row.dataset.lessonId),
        enabled: $('[data-field="enabled"]', row).checked,
        name: $('[data-field="name"]', row).value.trim(),
        shortName: $('[data-field="shortName"]', row).value.trim(),
        price: Number($('[data-field="price"]', row).value || 0),
        category: $('[data-field="category"]', row).value,
        poster: $('[data-field="poster"]', row).value.trim(),
        caption: `${$('[data-field="name"]', row).value.trim()} 포스터`,
      })),
    };

    try {
      Store.saveConfig(next);
      setToast("설정을 저장했습니다. 신청 페이지에 바로 반영됩니다.");
    } catch {
      setToast("저장 공간이 부족합니다. 큰 포스터 파일은 assets 폴더 경로 방식으로 연결해주세요.");
    }
  });

  $("#exportConfig").addEventListener("click", () => {
    $("#dataBox").value = JSON.stringify(
      {
        config: Store.getConfig(),
        applications: Store.getApplications(),
      },
      null,
      2,
    );
    setToast("설정과 신청 데이터를 아래 상자에 내보냈습니다.");
  });

  $("#downloadData").addEventListener("click", () => {
    saveBlob(
      "sweety-swing-data.json",
      JSON.stringify({ config: Store.getConfig(), applications: Store.getApplications() }, null, 2),
      "application/json;charset=utf-8",
    );
  });

  $("#importData").addEventListener("click", () => {
    const parsed = JSON.parse($("#dataBox").value);
    if (parsed.config) Store.saveConfig(parsed.config);
    if (Array.isArray(parsed.applications)) Store.saveApplications(parsed.applications);
    setToast("가져오기를 완료했습니다. 페이지를 새로고침합니다.");
    window.setTimeout(() => location.reload(), 700);
  });

  $("#resetConfig").addEventListener("click", () => {
    if (!confirm("강습 설정을 기본값으로 되돌릴까요? 신청 데이터는 유지됩니다.")) return;
    Store.resetConfig();
    location.reload();
  });

  $("#clearApplications").addEventListener("click", () => {
    if (!confirm("신청 데이터를 모두 삭제할까요? 이 브라우저에 저장된 신청 목록이 비워집니다.")) return;
    Store.clearApplications();
    setToast("신청 데이터를 초기화했습니다.");
  });

  $("#seedSample").addEventListener("click", async () => {
    const sampleLessons = Store.getEnabledLessons();
    const intermediate = sampleLessons.find((lesson) => lesson.id === "intermediate");
    const beginner = sampleLessons.find((lesson) => lesson.id === "beginner");
    const slow = sampleLessons.find((lesson) => lesson.id === "training-slow");
    const selected = [intermediate, beginner, slow].filter(Boolean);
    const price = Store.calculate(selected, "first_intermediate_134", Store.getConfig());
    try {
      await Store.addApplication({
        nickname: "로빈",
        realName: "홍길동",
        phone: "010-1234-5678",
        applicantType: "first_intermediate_134",
        selectedClasses: selected.map((lesson, index) => ({
          id: lesson.id,
          name: lesson.name,
          shortName: lesson.shortName,
          category: lesson.category,
          price: lesson.price,
          role: index === 1 ? "follower" : "leader",
        })),
        subtotal: price.subtotal,
        discountAmount: price.discountAmount,
        discountDetails: price.details,
        finalAmount: price.finalAmount,
        bankAccount: Store.getConfig().bankAccount,
        recommendedDepositorName: "로빈",
        submittedAt: new Date().toISOString(),
      });
      setToast("샘플 신청 1건을 추가했습니다.");
    } catch (error) {
      console.error(error);
      setToast("샘플 신청 저장에 실패했습니다.");
    }
  });
}

function initStudentsPage() {
  const config = Store.getConfig();
  $("#rosterTerm").textContent = config.termLabel;
  $("#lessonFilter").innerHTML = lessonOptions(config);

  function renderRosterPerson({ application }) {
    const paidBadge = application.paymentStatus === "paid" ? `<span class="paid-badge">입금확인</span>` : "";
    return `
      <div class="role-roster-person">
        <strong>${escapeHtml(application.nickname)}</strong>
        ${paidBadge}
      </div>
    `;
  }

  function renderRoleColumn(title, rows) {
    return `
      <div class="role-roster-column">
        <div class="role-roster-head">
          <h3>${title}</h3>
          <span>${rows.length}명</span>
        </div>
        <div class="role-roster-list">
          ${rows.length ? rows.map(renderRosterPerson).join("") : `<p class="role-roster-empty">아직 없음</p>`}
        </div>
      </div>
    `;
  }

  function render() {
    const filter = $("#lessonFilter").value;
    const lessons = config.lessons.filter((lesson) => lesson.enabled !== false && (filter === "all" || lesson.id === filter));
    const applications = activeApplications();
    $("#rosterContent").innerHTML = lessons
      .map((lesson) => {
        const rows = Store.flattenByLesson(lesson.id, applications);
        const leaderRows = rows.filter((row) => row.selectedClass.role === "leader");
        const followerRows = rows.filter((row) => row.selectedClass.role === "follower");
        const leaderCount = rows.filter((row) => row.selectedClass.role === "leader").length;
        const followerCount = rows.filter((row) => row.selectedClass.role === "follower").length;
        const paidCount = rows.filter((row) => row.application.paymentStatus === "paid").length;
        return `
          <section class="panel roster-section">
            <div class="section-title row-title">
              <div>
                <p class="eyebrow">${lesson.category === "training" ? "Training" : "Class"}</p>
                <h2>${escapeHtml(lesson.name)}</h2>
              </div>
              <p class="count-pill">총 ${rows.length}명 · 리더 ${leaderCount} · 팔뤄 ${followerCount} · 입금확인 ${paidCount}</p>
            </div>
            ${
              rows.length
                ? `<div class="role-roster" aria-label="${escapeHtml(lesson.name)} 신청 명단">
                    ${renderRoleColumn("리더", leaderRows)}
                    ${renderRoleColumn("팔뤄", followerRows)}
                  </div>`
                : `<p class="roster-empty">아직 신청자가 없습니다.</p>`
            }
          </section>
        `;
      })
      .join("");
  }

  $("#lessonFilter").addEventListener("change", render);
  render();
}

function filteredApplications() {
  const classFilter = $("#classFilter")?.value || "all";
  const paymentFilter = $("#paymentFilter")?.value || "all";
  const query = ($("#searchInput")?.value || "").trim().toLowerCase();
  return Store.getApplications().filter((application) => {
    const classMatch = classFilter === "all" || (application.selectedClasses || []).some((item) => item.id === classFilter);
    const paymentMatch = paymentFilter === "all" || application.paymentStatus === paymentFilter;
    const queryText = [
      application.nickname,
      application.realName,
      application.phone,
      application.recommendedDepositorName,
      selectedClassPlain(application),
    ]
      .join(" ")
      .toLowerCase();
    return classMatch && paymentMatch && (!query || queryText.includes(query));
  });
}

function renderManagementTable(targetId, mode) {
  const applications = filteredApplications();
  const rows = applications
    .map(
      (application) => `
        <tr>
          <td>
            <strong>${escapeHtml(application.nickname)}</strong>
            <span class="subtext">${escapeHtml(application.realName)} · ${escapeHtml(application.phone)}</span>
          </td>
          <td>${selectedClassText(application)}</td>
          <td>${escapeHtml(Store.applicantTypeLabels[application.applicantType] || application.applicantType)}</td>
          <td><strong>${Store.formatWon(application.finalAmount)}</strong><span class="subtext">${escapeHtml(application.recommendedDepositorName)}</span></td>
          <td>
            <select data-status="${application.id}">
              ${Object.entries(Store.applicationStatusLabels)
                .map(([value, label]) => `<option value="${value}"${application.status === value ? " selected" : ""}>${label}</option>`)
                .join("")}
            </select>
          </td>
          <td>
            <select data-payment="${application.id}">
              ${Object.entries(Store.paymentStatusLabels)
                .map(([value, label]) => `<option value="${value}"${application.paymentStatus === value ? " selected" : ""}>${label}</option>`)
                .join("")}
            </select>
          </td>
          <td>${formatDate(application.submittedAt)}</td>
          ${
            mode === "accounting"
              ? `<td><button class="mini-button" type="button" data-mark-paid="${application.id}">입금 확인</button></td>`
              : `<td><input class="memo-input" type="text" data-memo="${application.id}" value="${escapeHtml(application.memo || "")}" placeholder="메모" /></td>`
          }
        </tr>
      `,
    )
    .join("");

  $(targetId).innerHTML = rows || `<tr><td colspan="8" class="empty-cell">조건에 맞는 신청이 없습니다.</td></tr>`;
}

function bindManagementEvents(mode) {
  document.addEventListener("change", async (event) => {
    if (event.target.matches("[data-status]")) {
      try {
        await Store.updateApplication(event.target.dataset.status, { status: event.target.value });
        setToast("진행 상태를 저장했습니다.");
        refreshManagement(mode);
      } catch (error) {
        console.error(error);
        setToast("진행 상태 저장에 실패했습니다.");
      }
    }

    if (event.target.matches("[data-payment]")) {
      try {
        await Store.updateApplication(event.target.dataset.payment, { paymentStatus: event.target.value });
        setToast("입금 상태를 저장했습니다.");
        refreshManagement(mode);
      } catch (error) {
        console.error(error);
        setToast("입금 상태 저장에 실패했습니다.");
      }
    }

    if (event.target.matches("#classFilter, #paymentFilter")) refreshManagement(mode);
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("#searchInput")) refreshManagement(mode);
  });

  document.addEventListener("blur", async (event) => {
    if (!event.target.matches("[data-memo]")) return;
    try {
      await Store.updateApplication(event.target.dataset.memo, { memo: event.target.value });
      setToast("메모를 저장했습니다.");
    } catch (error) {
      console.error(error);
      setToast("메모 저장에 실패했습니다.");
    }
  }, true);

  document.addEventListener("click", async (event) => {
    if (event.target.matches("[data-mark-paid]")) {
      try {
        await Store.updateApplication(event.target.dataset.markPaid, { paymentStatus: "paid", status: "confirmed" });
        setToast("입금 확인으로 표시했습니다.");
        refreshManagement(mode);
      } catch (error) {
        console.error(error);
        setToast("입금 확인 저장에 실패했습니다.");
      }
    }

    if (event.target.matches("#downloadCsv")) {
      saveBlob("sweety-swing-applications.csv", Store.exportApplicationsCsv(Store.getApplications()), "text/csv;charset=utf-8");
    }
  });
}

function refreshStats() {
  const applications = Store.getApplications();
  const active = applications.filter((application) => application.status !== "cancelled");
  const paid = active.filter((application) => application.paymentStatus === "paid");
  const unpaid = active.filter((application) => application.paymentStatus !== "paid");
  $("#totalCount").textContent = `${active.length}명`;
  $("#expectedAmount").textContent = Store.formatWon(active.reduce((sum, item) => sum + Number(item.finalAmount || 0), 0));
  $("#paidAmount").textContent = Store.formatWon(paid.reduce((sum, item) => sum + Number(item.finalAmount || 0), 0));
  $("#unpaidCount").textContent = `${unpaid.length}건`;
}

function refreshManagement(mode) {
  if (mode === "accounting") refreshStats();
  renderManagementTable("#managementRows", mode);
}

function initOpsPage(mode) {
  const config = Store.getConfig();
  $("#classFilter").innerHTML = lessonOptions(config);
  $("#paymentFilter").innerHTML = [
    `<option value="all">전체 입금 상태</option>`,
    ...Object.entries(Store.paymentStatusLabels).map(([value, label]) => `<option value="${value}">${label}</option>`),
  ].join("");
  bindManagementEvents(mode);
  refreshManagement(mode);
}

async function loadApplicationsForDashboard() {
  if (!["students", "ops", "accounting"].includes(page)) return;
  try {
    await Store.refreshApplications();
  } catch (error) {
    console.error(error);
    setToast("신청 데이터를 불러오지 못했습니다. 잠시 후 새로고침해주세요.");
  }
}

async function loadConfigForDashboard() {
  try {
    await Store.refreshConfig();
  } catch (error) {
    console.error(error);
    setToast("설정 정보를 불러오지 못했습니다. 기본 설정으로 표시합니다.");
  }
}

async function boot() {
  await loadConfigForDashboard();
  await loadApplicationsForDashboard();
  if (page === "settings") initSettingsPage();
  if (page === "students") initStudentsPage();
  if (page === "ops") initOpsPage("ops");
  if (page === "accounting") initOpsPage("accounting");
}

boot();
