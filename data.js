(function () {
  const CONFIG_KEY = "sweetySwing.config.v2";
  const APPLICATIONS_KEY = "sweetySwing.applications.v2";
  const PUBLIC_ROSTER_KEY = "sweetySwing.publicRoster.v2";
  const CACHE_VERSION_KEY = "sweetySwing.cacheVersion.v1";
  const CACHE_VERSION = "20260521-discount-rules";
  const API_URL = "https://script.google.com/macros/s/AKfycbyXhHR_VEz_0a4guDUBI8t1VK88pFcbryxNovMZwQDqlkg0Vc3dAOi_YNInDSx9qQ-R/exec";
  const USE_REMOTE_API = Boolean(API_URL);
  let configCache = null;
  let applicationsCache = null;
  let publicRosterCache = null;

  const legacyLessonIds = {
    "training-slow": "training-a",
    "training-rnb": "training-b",
  };

  function migrateLocalCache() {
    if (localStorage.getItem(CACHE_VERSION_KEY) === CACHE_VERSION) return;
    localStorage.removeItem(CONFIG_KEY);
    localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
  }

  migrateLocalCache();

  const defaultConfig = {
    termLabel: "137기 정규 강습 신청",
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
    discountRules: [
      {
        id: "first-intermediate-beginner-half",
        name: "첫 중급자 초급 반값 할인",
        enabled: true,
        applicantType: "first_intermediate_134",
        requiresLessonId: "intermediate",
        targetLessonId: "beginner",
        targetCategory: "",
        minClassCount: "",
        maxClassCount: "",
        discountType: "percent",
        discountValue: 50,
        label: "{강습명} 중복 수강 반값 할인",
      },
      {
        id: "first-intermediate-training",
        name: "첫 중급자 트레이닝 중복 할인",
        enabled: true,
        applicantType: "first_intermediate_134",
        requiresLessonId: "intermediate",
        targetLessonId: "",
        targetCategory: "training",
        minClassCount: "",
        maxClassCount: "",
        discountType: "amount_per_lesson",
        discountValue: 10000,
        label: "{강습명} 트레이닝 중복 수강 할인",
      },
      {
        id: "general-two-classes",
        name: "일반 2개 수강 할인",
        enabled: true,
        applicantType: "general",
        requiresLessonId: "",
        targetLessonId: "",
        targetCategory: "",
        minClassCount: 2,
        maxClassCount: 2,
        discountType: "amount_once",
        discountValue: 10000,
        label: "2개 중복 수강 할인",
      },
      {
        id: "general-three-plus-classes",
        name: "일반 3개 이상 수강 할인",
        enabled: true,
        applicantType: "general",
        requiresLessonId: "",
        targetLessonId: "",
        targetCategory: "",
        minClassCount: 3,
        maxClassCount: "",
        discountType: "amount_once",
        discountValue: 20000,
        label: "3개 이상 중복 수강 할인",
      },
    ],
    lessons: [
      {
        id: "beginner",
        name: "초급",
        shortName: "초급",
        category: "regular",
        price: 65000,
        poster: "./assets/poster-beginner.png?v=137-regular-20260521131449",
        caption: "초급 포스터",
        enabled: true,
      },
      {
        id: "pre-intermediate",
        name: "초중급",
        shortName: "초중급",
        category: "regular",
        price: 65000,
        poster: "./assets/poster-pre-intermediate.png?v=137-regular-20260521110657",
        caption: "초중급 포스터",
        enabled: true,
      },
      {
        id: "intermediate",
        name: "중급",
        shortName: "중급",
        category: "regular",
        price: 70000,
        poster: "./assets/poster-intermediate.png?v=137-regular-20260521110657",
        caption: "중급 포스터",
        enabled: true,
      },
      {
        id: "training-a",
        name: "트레이닝 9기 - 슬로우",
        shortName: "슬로우",
        category: "training",
        price: 40000,
        poster: "./assets/poster-training-a.svg",
        caption: "트레이닝 9기 - 슬로우 포스터",
        enabled: true,
      },
      {
        id: "training-b",
        name: "트레이닝 10기 - 리듬앤블루스",
        shortName: "리듬앤블루스",
        category: "training",
        price: 40000,
        poster: "./assets/poster-training-b.svg",
        caption: "트레이닝 10기 - 리듬앤블루스 포스터",
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

  function normalizeDiscountRule(rule) {
    return {
      id: String(rule.id || "").trim(),
      name: String(rule.name || "").trim(),
      enabled: rule.enabled !== false,
      applicantType: rule.applicantType || "all",
      requiresLessonId: normalizeLessonId(String(rule.requiresLessonId || "").trim()),
      targetLessonId: normalizeLessonId(String(rule.targetLessonId || "").trim()),
      targetCategory: String(rule.targetCategory || "").trim(),
      minClassCount: rule.minClassCount === "" || rule.minClassCount === null || rule.minClassCount === undefined ? "" : Number(rule.minClassCount),
      maxClassCount: rule.maxClassCount === "" || rule.maxClassCount === null || rule.maxClassCount === undefined ? "" : Number(rule.maxClassCount),
      discountType: ["percent", "amount_per_lesson", "amount_once"].includes(rule.discountType) ? rule.discountType : "amount_once",
      discountValue: Number(rule.discountValue || 0),
      label: String(rule.label || "").trim(),
    };
  }

  function buildDefaultDiscountRules(discounts = defaultConfig.discounts) {
    return defaultConfig.discountRules.map((rule) => {
      if (rule.id === "first-intermediate-training") {
        return normalizeDiscountRule({ ...rule, discountValue: discounts.firstIntermediateTraining ?? rule.discountValue });
      }
      if (rule.id === "general-two-classes") {
        return normalizeDiscountRule({ ...rule, discountValue: discounts.generalTwoClasses ?? rule.discountValue });
      }
      if (rule.id === "general-three-plus-classes") {
        return normalizeDiscountRule({ ...rule, discountValue: discounts.generalThreePlusClasses ?? rule.discountValue });
      }
      return normalizeDiscountRule(rule);
    });
  }

  function normalizeConfig(input) {
    const saved = input && typeof input === "object" ? input : {};
    const config = {
      ...clone(defaultConfig),
      ...saved,
      bankAccount: { ...defaultConfig.bankAccount, ...(saved.bankAccount || {}) },
      discounts: { ...defaultConfig.discounts, ...(saved.discounts || {}) },
      discountRules: Array.isArray(saved.discountRules)
        ? saved.discountRules.map(normalizeDiscountRule)
        : buildDefaultDiscountRules(saved.discounts || defaultConfig.discounts),
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

  function ruleMatchesApplicantType(rule, applicantType) {
    return !rule.applicantType || rule.applicantType === "all" || rule.applicantType === "전체" || rule.applicantType === applicantType;
  }

  function ruleMatchesClassCount(rule, classCount) {
    const min = Number(rule.minClassCount || 0);
    const max = Number(rule.maxClassCount || 0);
    if (min && classCount < min) return false;
    if (max && classCount > max) return false;
    return true;
  }

  function getDiscountTargets(rule, selectedLessons) {
    if (rule.targetLessonId) return selectedLessons.filter((lesson) => lesson.id === rule.targetLessonId);
    if (rule.targetCategory) return selectedLessons.filter((lesson) => lesson.category === rule.targetCategory);
    return [];
  }

  function formatDiscountRuleLabel(rule, lesson) {
    const fallback = lesson ? `${lesson.shortName || lesson.name} ${rule.name}` : rule.name;
    return (rule.label || fallback)
      .replaceAll("{강습명}", lesson?.shortName || lesson?.name || "")
      .replaceAll("{할인명}", rule.name || "")
      .trim();
  }

  function calculateRuleDiscount(rule, targets) {
    if (rule.discountType === "percent") {
      return targets.map((lesson) => ({
        lesson,
        amount: Math.round(Number(lesson.price || 0) * (Number(rule.discountValue || 0) / 100)),
      }));
    }
    if (rule.discountType === "amount_per_lesson") {
      return targets.map((lesson) => ({ lesson, amount: Number(rule.discountValue || 0) }));
    }
    return [{ lesson: targets[0] || null, amount: Number(rule.discountValue || 0) }];
  }

  function calculate(selectedLessons, applicantType, config = getConfig()) {
    const subtotal = selectedLessons.reduce((sum, lesson) => sum + Number(lesson.price || 0), 0);
    const ids = new Set(selectedLessons.map((lesson) => lesson.id));
    const details = [];
    let discountAmount = 0;
    let hint = "";
    const discountRules = Array.isArray(config.discountRules) && config.discountRules.length
      ? config.discountRules.map(normalizeDiscountRule)
      : buildDefaultDiscountRules(config.discounts || defaultConfig.discounts);

    discountRules
      .filter((rule) => rule.enabled !== false)
      .filter((rule) => ruleMatchesApplicantType(rule, applicantType))
      .filter((rule) => ruleMatchesClassCount(rule, selectedLessons.length))
      .filter((rule) => !rule.requiresLessonId || ids.has(rule.requiresLessonId))
      .forEach((rule) => {
        const targets = getDiscountTargets(rule, selectedLessons);
        if ((rule.targetLessonId || rule.targetCategory) && targets.length === 0) return;

        calculateRuleDiscount(rule, targets).forEach(({ lesson, amount }) => {
          if (!amount) return;
          discountAmount += amount;
          details.push(`${formatDiscountRuleLabel(rule, lesson)} -${formatWon(amount)}`);
        });
      });

    if (
      applicantType === "first_intermediate_134" &&
      selectedLessons.length > 0 &&
      discountRules.some((rule) => rule.enabled !== false && rule.applicantType === "first_intermediate_134" && rule.requiresLessonId === "intermediate") &&
      !ids.has("intermediate")
    ) {
      hint = `${config.firstIntermediateLabel} 할인은 중급 강습을 함께 선택하면 적용됩니다.`;
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
