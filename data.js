(function () {
  const CONFIG_KEY = "sweetySwing.config.v2";
  const APPLICATIONS_KEY = "sweetySwing.applications.v2";
  const API_URL = "https://script.google.com/macros/s/AKfycbyXhHR_VEz_0a4guDUBI8t1VK88pFcbryxNovMZwQDqlkg0Vc3dAOi_YNInDSx9qQ-R/exec";
  const USE_REMOTE_API = Boolean(API_URL);
  let applicationsCache = null;

  const defaultConfig = {
    termLabel: "134기 정규 강습 신청",
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
    depositPriority: ["intermediate", "pre-intermediate", "beginner", "training-slow", "training-rnb"],
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
        id: "training-slow",
        name: "트레이닝 9기 - 슬로우",
        shortName: "슬로우",
        category: "training",
        price: 40000,
        poster: "./assets/poster-training-slow.svg",
        caption: "트레이닝 9기 슬로우 포스터",
        enabled: true,
      },
      {
        id: "training-rnb",
        name: "트레이닝 10기 - 리듬앤블루스",
        shortName: "리듬앤블루스",
        category: "training",
        price: 40000,
        poster: "./assets/poster-training-rnb.svg",
        caption: "트레이닝 10기 리듬앤블루스 포스터",
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

  function normalizeConfig(input) {
    const saved = input && typeof input === "object" ? input : {};
    const config = {
      ...clone(defaultConfig),
      ...saved,
      bankAccount: { ...defaultConfig.bankAccount, ...(saved.bankAccount || {}) },
      discounts: { ...defaultConfig.discounts, ...(saved.discounts || {}) },
      depositPriority: Array.isArray(saved.depositPriority)
        ? saved.depositPriority
        : clone(defaultConfig.depositPriority),
    };

    const savedLessons = Array.isArray(saved.lessons) ? saved.lessons : [];
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
    return normalizeConfig(safeJsonParse(localStorage.getItem(CONFIG_KEY), null));
  }

  function saveConfig(config) {
    const normalized = normalizeConfig(config);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function resetConfig() {
    localStorage.removeItem(CONFIG_KEY);
    return getConfig();
  }

  function getEnabledLessons(config = getConfig()) {
    return config.lessons.filter((lesson) => lesson.enabled !== false);
  }

  function getApplications() {
    if (Array.isArray(applicationsCache)) return applicationsCache;
    const applications = safeJsonParse(localStorage.getItem(APPLICATIONS_KEY), []);
    return Array.isArray(applications) ? applications : [];
  }

  function saveApplications(applications) {
    const normalized = Array.isArray(applications) ? applications : [];
    applicationsCache = normalized;
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(normalized));
    return normalized;
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
    saveConfig,
    resetConfig,
    getEnabledLessons,
    getApplications,
    saveApplications,
    refreshApplications,
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
