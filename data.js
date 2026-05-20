(function () {
  const CONFIG_KEY = "sweetySwing.config.v2";
  const APPLICATIONS_KEY = "sweetySwing.applications.v2";
  const PUBLIC_ROSTER_KEY = "sweetySwing.publicRoster.v2";
  const API_URL = "https://script.google.com/macros/s/AKfycbyXhHR_VEz_0a4guDUBI8t1VK88pFcbryxNovMZwQDqlkg0Vc3dAOi_YNInDSx9qQ-R/exec";
  const USE_REMOTE_API = Boolean(API_URL);
  let configCache = null;
  let applicationsCache = null;
  let publicRosterCache = null;

  const legacyLessonIds = {
    "training-slow": "training-a",
    "training-rnb": "training-b",
  };

  const defaultConfig = {
    termLabel: "134기 정규 강습 신청",
    applicationStartDate: "",
    applicationEndDate: "",
    signupOpen: true,
    signupClosedReason: "",
    today: "",
    firstIntermediateLabel: "134기 첫 중급 수강자",
    firstIntermediateDescription: "중급과 초급/트레이닝 중복 수강 할인 적용",
    introSignupUrl: "#",
    bankAccount: {
      bank: "카카오뱅크",
      accountNumber: "3333-35-1975536",
      accountHolder: "이기연",
    },
    discounts: {
      firstIntermediateTraining: 10000,
      generalTwoClasses: 10000,
      generalThreePlusClasses: 20000,
    },
    depositPriority: ["intermediate", "pre-intermediate", "beginner", "training-a", "training-b"],
    lessons: [
      {
        id: "beginner",
        name: "초급",
        shortName: "초급",
        category: "regular",
        price: 65000,
        poster: "./assets/poster-beginner.svg",
        caption: "초급 포스터",
        enabled: true,
      },
      {
        id: "pre-intermediate",
        name: "초중급",
        shortName: "초중급",
        category: "regular",
        price: 65000,
        poster: "./assets/poster-pre-intermediate.svg",
        caption: "초중급 포스터",
        enabled: true,
      },
      {
        id: "intermediate",
        name: "중급",
        shortName: "중급",
        category: "regular",
        price: 70000,
        poster: "./assets/poster-intermediate.svg",
        caption: "중급 포스터",
        enabled: true,
      },
      {
        id: "training-a",
        name: "트레이닝 A",
        shortName: "트레이닝 A",
        category: "training",
        price: 40000,
        poster: "./assets/poster-training-a.svg",
        caption: "트레이닝 A 포스터",
        enabled: true,
      },
      {
        id: "training-b",
        name: "트레이닝 B",
        shortName: "트레이닝 B",
        category: "training",
        price: 40000,
        poster: "./assets/poster-training-b.svg",
        caption: "트레이닝 B 포스터",
        enabled: true,
      },
    ],
  };

  const roleLabels = {
    leader: "리더",
    follower: "팔뤄",
  };

  const applicantTypeLabels = {
    first_intermediate_134: "134기 첫 중급 수강자",
    general: "그 외 강습생",
  };

  const applicationStatusLabels = {
    submitted: "접수",
    confirmed: "확정",
    cancelled: "취소",
  };

  const paymentStatusLabels = {
    unpaid: "입금 대기",
    paid: "입금 확인",
    issue: "확인 필요",
    refunded: "환불",
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeJsonParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function normalizeLessonId(id) {
    return legacyLessonIds[id] || id;
  }

  function normalizeLesson(lesson) {
    return { ...lesson, id: normalizeLessonId(lesson.id) };
  }

  function normalizeApplication(application) {
    return {
      ...application,
      selectedClasses: Array.isArray(application.selectedClasses)
        ? application.selectedClasses.map(normalizeLesson)
        : [],
    };
  }

  function normalizePublicRosterRow(row) {
    return {
      ...row,
      lessonId: normalizeLessonId(row.lessonId || row.classId || row.id || ""),
      lessonName: row.lessonName || row.className || row.name || "",
      nickname: row.nickname || "",
      role: row.role || "",
      status: row.status || "submitted",
      paymentStatus: row.paymentStatus || "unpaid",
      submittedAt: row.submittedAt || "",
    };
  }

  function normalizeConfig(input) {
    const saved = input && typeof input === "object" ? input : {};
    const config = {
      ...clone(defaultConfig),
      ...saved,
      bankAccount: { ...defaultConfig.bankAccount, ...(saved.bankAccount || {}) },
      discounts: { ...defaultConfig.discounts, ...(saved.discounts || {}) },
      depositPriority: Array.isArray(saved.depositPriority)
        ? saved.depositPriority.map(normalizeLessonId)
        : clone(defaultConfig.depositPriority),
    };

    const savedLessons = Array.isArray(saved.lessons) ? saved.lessons.map(normalizeLesson) : [];
    config.lessons = defaultConfig.lessons.map((lesson) => {
      const override = savedLessons.find((item) => item.id === lesson.id) || {};
      return { ...lesson, ...override, price: Number(override.price ?? lesson.price) || 0 };
    });

    savedLessons
      .filter((lesson) => !config.lessons.some((item) => item.id === lesson.id))
      .forEach((lesson) => config.lessons.push({ ...lesson, price: Number(lesson.price) || 0 }));

    return config;
  }

  function getConfig() {
    if (configCache) return configCache;
    return normalizeConfig(safeJsonParse(localStorage.getItem(CONFIG_KEY), null));
  }

  function saveConfig(config) {
    const normalized = normalizeConfig(config);
    configCache = normalized;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function resetConfig() {
    configCache = null;
    localStorage.removeItem(CONFIG_KEY);
    return getConfig();
  }

  function getEnabledLessons(config = getConfig()) {
    return config.lessons.filter((lesson) => lesson.enabled !== false);
  }

  function getApplications() {
    if (Array.isArray(applicationsCache)) return applicationsCache;
    const applications = safeJsonParse(localStorage.getItem(APPLICATIONS_KEY), []);
    return Array.isArray(applications) ? applications.map(normalizeApplication) : [];
  }

  function saveApplications(applications) {
    const normalized = Array.isArray(applications) ? applications.map(normalizeApplication) : [];
    applicationsCache = normalized;
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function getPublicRosterRows() {
    if (Array.isArray(publicRosterCache)) return publicRosterCache;
    const rows = safeJsonParse(localStorage.getItem(PUBLIC_ROSTER_KEY), []);
    return Array.isArray(rows) ? rows.map(normalizePublicRosterRow) : [];
  }

  function savePublicRosterRows(rows) {
    const normalized = Array.isArray(rows) ? rows.map(normalizePublicRosterRow) : [];
    publicRosterCache = normalized;
    localStorage.setItem(PUBLIC_ROSTER_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function publicRosterRowsFromApplications(applications = getApplications()) {
    return applications.flatMap((application) =>
      (application.selectedClasses || []).map((selectedClass) => ({
        termId: application.termId,
        termName: application.termName,
        lessonId: selectedClass.id,
        lessonName: selectedClass.name,
        nickname: application.nickname,
        role: selectedClass.role,
        status: application.status,
        paymentStatus: application.paymentStatus,
        submittedAt: application.submittedAt,
      })),
    );
  }

  function makeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `app-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function buildApiUrl(action, params = {}) {
    const url = new URL(API_URL);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) url.searchParams.set(key, value);
    });
    url.searchParams.set("_", Date.now());
    return url.toString();
  }

  async function apiGet(action, params = {}) {
    const response = await fetch(buildApiUrl(action, params), { cache: "no-store" });
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

  async function refreshApplications(termId = "") {
    if (!USE_REMOTE_API) return getApplications();
    const applications = await apiGet("listApplications", termId ? { termId } : {});
    return saveApplications(Array.isArray(applications) ? applications : []);
  }

  async function refreshPublicRosterRows(termId = "") {
    if (!USE_REMOTE_API) return savePublicRosterRows(publicRosterRowsFromApplications());
    try {
      const rows = await apiGet("listPublicRoster", termId ? { termId } : {});
      return savePublicRosterRows(Array.isArray(rows) ? rows : []);
    } catch (error) {
      const applications = await refreshApplications(termId);
      return savePublicRosterRows(publicRosterRowsFromApplications(applications));
    }
  }

  async function refreshStudentsPageData(termId = "") {
    if (!USE_REMOTE_API) {
      return {
        config: getConfig(),
        publicRoster: savePublicRosterRows(publicRosterRowsFromApplications()),
      };
    }

    try {
      const data = await apiGet("getStudentsPageData", termId ? { termId } : {});
      const config = data?.config ? saveConfig(data.config) : getConfig();
      const publicRoster = savePublicRosterRows(Array.isArray(data?.publicRoster) ? data.publicRoster : []);
      return { config, publicRoster };
    } catch (error) {
      const [config, publicRoster] = await Promise.all([refreshConfig(), refreshPublicRosterRows(termId)]);
      return { config, publicRoster };
    }
  }

  async function refreshConfig() {
    if (!USE_REMOTE_API) return getConfig();
    const config = await apiGet("getConfig");
    return saveConfig(config);
  }

  function addLocalApplication(payload) {
    const now = new Date().toISOString();
    const record = {
      ...payload,
      id: payload.id || makeId(),
      status: payload.status || "submitted",
      paymentStatus: payload.paymentStatus || "unpaid",
      memo: payload.memo || "",
      paidAt: payload.paidAt || "",
      submittedAt: payload.submittedAt || now,
      updatedAt: now,
    };
    const applications = getApplications();
    applications.unshift(record);
    saveApplications(applications);
    return record;
  }

  async function addApplication(payload) {
    if (!USE_REMOTE_API) return addLocalApplication(payload);
    const record = await apiPost("addApplication", { payload });
    const applications = getApplications().filter((application) => application.id !== record.id);
    saveApplications([record, ...applications]);
    return record;
  }

  function updateLocalApplication(id, patch) {
    const now = new Date().toISOString();
    const applications = getApplications();
    const next = applications.map((application) => {
      if (application.id !== id) return application;
      const updated = { ...application, ...patch, updatedAt: now };
      if (patch.paymentStatus === "paid" && !application.paidAt) updated.paidAt = now;
      if (patch.paymentStatus && patch.paymentStatus !== "paid") updated.paidAt = "";
      return updated;
    });
    saveApplications(next);
    return next.find((application) => application.id === id);
  }

  async function updateApplication(id, patch) {
    if (!USE_REMOTE_API) return updateLocalApplication(id, patch);
    const updated = await apiPost("updateApplication", { id, patch });
    const next = getApplications().map((application) => (application.id === id ? updated : application));
    saveApplications(next.some((application) => application.id === id) ? next : [updated, ...next]);
    return updated;
  }

  function deleteApplication(id) {
    saveApplications(getApplications().filter((application) => application.id !== id));
  }

  function clearApplications() {
    localStorage.removeItem(APPLICATIONS_KEY);
  }

  function formatWon(value) {
    return `${Number(value || 0).toLocaleString("ko-KR")}원`;
  }

  function calculate(selectedLessons, applicantType, config = getConfig()) {
    const subtotal = selectedLessons.reduce((sum, lesson) => sum + Number(lesson.price || 0), 0);
    const ids = new Set(selectedLessons.map((lesson) => lesson.id));
    const details = [];
    let discountAmount = 0;
    let hint = "";

    if (applicantType === "first_intermediate_134") {
      if (ids.has("intermediate")) {
        const beginner = selectedLessons.find((lesson) => lesson.id === "beginner");
        if (beginner) {
          const beginnerDiscount = Math.round(Number(beginner.price || 0) / 2);
          discountAmount += beginnerDiscount;
          details.push(`${beginner.shortName} 중복 수강 반값 할인 -${formatWon(beginnerDiscount)}`);
        }

        selectedLessons
          .filter((lesson) => lesson.category === "training")
          .forEach((lesson) => {
            discountAmount += Number(config.discounts.firstIntermediateTraining || 0);
            details.push(`${lesson.shortName} 트레이닝 중복 수강 할인 -${formatWon(config.discounts.firstIntermediateTraining)}`);
          });
      } else if (selectedLessons.length > 0) {
        hint = `${config.firstIntermediateLabel} 할인은 중급 강습을 함께 선택하면 적용됩니다.`;
      }
    }

    if (applicantType === "general") {
      if (selectedLessons.length >= 3) {
        discountAmount = Number(config.discounts.generalThreePlusClasses || 0);
        details.push(`3개 이상 중복 수강 할인 -${formatWon(discountAmount)}`);
      } else if (selectedLessons.length === 2) {
        discountAmount = Number(config.discounts.generalTwoClasses || 0);
        details.push(`2개 중복 수강 할인 -${formatWon(discountAmount)}`);
      }
    }

    return {
      subtotal,
      discountAmount,
      details,
      hint,
      finalAmount: Math.max(subtotal - discountAmount, 0),
    };
  }

  function getDepositorName(selectedLessons, nickname, config = getConfig()) {
    return nickname?.trim() || "닉네임";
  }

  function flattenByLesson(lessonId, applications = getApplications()) {
    return applications.flatMap((application) =>
      (application.selectedClasses || [])
        .filter((selectedClass) => selectedClass.id === lessonId)
        .map((selectedClass) => ({ application, selectedClass })),
    );
  }

  function toCsv(rows) {
    return rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
  }

  function exportApplicationsCsv(applications = getApplications()) {
    const rows = [
      [
        "신청일",
        "닉네임",
        "이름",
        "연락처",
        "신청자유형",
        "강습",
        "역할",
        "합계",
        "할인",
        "최종금액",
        "입금자명",
        "진행상태",
        "입금상태",
        "메모",
      ],
      ...applications.map((application) => [
        application.submittedAt,
        application.nickname,
        application.realName,
        application.phone,
        applicantTypeLabels[application.applicantType] || application.applicantType,
        (application.selectedClasses || []).map((item) => item.name).join(" / "),
        (application.selectedClasses || []).map((item) => `${item.name}:${roleLabels[item.role] || item.role}`).join(" / "),
        application.subtotal,
        application.discountAmount,
        application.finalAmount,
        application.recommendedDepositorName,
        applicationStatusLabels[application.status] || application.status,
        paymentStatusLabels[application.paymentStatus] || application.paymentStatus,
        application.memo,
      ]),
    ];
    return `\uFEFF${toCsv(rows)}`;
  }

  window.SweetySwingData = {
    CONFIG_KEY,
    APPLICATIONS_KEY,
    API_URL,
    USE_REMOTE_API,
    roleLabels,
    applicantTypeLabels,
    applicationStatusLabels,
    paymentStatusLabels,
    defaultConfig: clone(defaultConfig),
    getConfig,
    refreshConfig,
    saveConfig,
    resetConfig,
    getEnabledLessons,
    getApplications,
    saveApplications,
    getPublicRosterRows,
    savePublicRosterRows,
    refreshApplications,
    refreshPublicRosterRows,
    refreshStudentsPageData,
    addApplication,
    updateApplication,
    deleteApplication,
    clearApplications,
    calculate,
    formatWon,
    getDepositorName,
    flattenByLesson,
    exportApplicationsCsv,
  };
})();
