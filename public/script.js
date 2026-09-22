// script.js
// -------------------------------------------------------------
// 這支檔案負責「畫面互動邏輯」：
// 1. 使用者送出訊息 -> 顯示在畫面上
// 2. 把訊息 POST 給後端 /api/chat
// 3. 拿到回覆後顯示在畫面上
//
// 用最原生的 fetch + DOM API 寫，不引入任何前端框架（React/Vue...），
// 是因為對話介面的邏輯不複雜，原生寫法比較容易看懂每一步在做什麼。
// -------------------------------------------------------------

const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatVoiceBtn = document.getElementById("chat-voice-btn");

const tileSurvey = document.getElementById("tile-survey");
const surveyPanel = document.getElementById("survey-panel");
const surveyClose = document.getElementById("survey-close");
const surveyForm = document.getElementById("survey-form");
const surveyQuestionsContainer = document.getElementById("survey-questions");

const tileCompare = document.getElementById("tile-compare");
const comparePanel = document.getElementById("compare-panel");
const compareClose = document.getElementById("compare-close");
const compareCards = document.getElementById("compare-cards");
const comparePrev = document.getElementById("compare-prev");
const compareNext = document.getElementById("compare-next");
const comparePageIndicator = document.getElementById("compare-page-indicator");

const tileScenario = document.getElementById("tile-scenario");
const scenarioPanel = document.getElementById("scenario-panel");
const scenarioClose = document.getElementById("scenario-close");
const scenarioCards = document.getElementById("scenario-cards");
const scenarioPrev = document.getElementById("scenario-prev");
const scenarioNext = document.getElementById("scenario-next");
const scenarioPageIndicator = document.getElementById("scenario-page-indicator");
const scenarioForm = document.getElementById("scenario-form");
const scenarioQuestionInput = document.getElementById("scenario-question");
const scenarioVoiceBtn = document.getElementById("scenario-voice-btn");

const tileCost = document.getElementById("tile-cost");
const costPanel = document.getElementById("cost-panel");
const costClose = document.getElementById("cost-close");
const costForm = document.getElementById("cost-form");

const tileCharging = document.getElementById("tile-charging");
const chargingPanel = document.getElementById("charging-panel");
const chargingClose = document.getElementById("charging-close");
const chargingCards = document.getElementById("charging-cards");
const chargingPrev = document.getElementById("charging-prev");
const chargingNext = document.getElementById("charging-next");
const chargingPageIndicator = document.getElementById("charging-page-indicator");
const chargingForm = document.getElementById("charging-form");
const chargingQuestionInput = document.getElementById("charging-question");
const chargingVoiceBtn = document.getElementById("charging-voice-btn");

const tileContact = document.getElementById("tile-contact");
const contactPanel = document.getElementById("contact-panel");
const contactClose = document.getElementById("contact-close");
const contactForm = document.getElementById("contact-form");

// -------------------------------------------------------------
// 六個功能面板互斥：點開任何一個格子時，其他還開著的面板要自動收起來，
// 畫面上同時間只會看到一個面板，不會擠成一團。
// 之後如果再加新面板，把它加進這個陣列就會自動套用同一套規則。
// -------------------------------------------------------------
const allPanels = [surveyPanel, comparePanel, scenarioPanel, costPanel, chargingPanel, contactPanel];
const quickActions = document.querySelector(".quick-actions");

function closeOtherPanels(exceptPanel) {
  for (const panel of allPanels) {
    if (panel !== exceptPanel) {
      panel.hidden = true;
    }
  }
}

// 只要有任何一個面板是開著的，下面的 6 個快捷格子就收起來，
// 避免面板 + 格子同時佔畫面；全部面板都關閉後格子才會再出現。
// 每次改動任何一個 panel.hidden 之後都要呼叫這個函式同步狀態。
function updateQuickActionsVisibility() {
  quickActions.hidden = allPanels.some((panel) => !panel.hidden);
}

// 對話歷史存在記憶體裡（重新整理頁面就會消失），
// 每次送出訊息都會把整段歷史一起傳給後端，AI 才記得前面聊過什麼
const conversationHistory = [];

// -------------------------------------------------------------
// 適配度問卷：6 題，一次全部畫出來、直向排成一欄（每一題寬度 = 面板寬度），
// 面板本身可以上下捲動，題目多的話往下滑就看得到更多，不用左右箭頭分頁。
//
// surveyAnswers 是「唯一的答案來源」：使用者點選項時寫回這個物件，
// 送出前用它檢查有沒有漏答。題目本來要換頁才需要這樣做，
// 現在雖然一次全部顯示、不會有「換頁弄丟答案」的問題了，
// 但這個物件還是方便的作答狀態記錄，維持不變。
// -------------------------------------------------------------
let surveyQuestions = [];
const surveyAnswers = {};

async function loadSurveyQuestions() {
  if (surveyQuestions.length > 0) {
    renderSurveyQuestions();
    return;
  }
  const response = await fetch("/api/survey-questions");
  const data = await response.json();
  surveyQuestions = data.questions;
  renderSurveyQuestions();
}

function renderSurveyQuestions() {
  surveyQuestionsContainer.innerHTML = "";

  for (const question of surveyQuestions) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "likert-question";

    const legend = document.createElement("legend");
    legend.textContent = `${question.label}：${question.statement}`;
    fieldset.appendChild(legend);

    const scale = document.createElement("div");
    scale.className = "likert-scale";

    // 1~5 分的單選按鈕，兩端加上文字提示，中間用數字就好
    for (let score = 1; score <= 5; score++) {
      const option = document.createElement("label");
      option.className = "likert-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = question.id; // 同一題的 5 個選項要共用 name，瀏覽器才知道是單選
      input.value = String(score);
      input.checked = surveyAnswers[question.id] === score;
      input.addEventListener("change", () => {
        surveyAnswers[question.id] = score;
      });

      const scoreText = document.createElement("span");
      scoreText.textContent = score;

      option.appendChild(input);
      option.appendChild(scoreText);
      scale.appendChild(option);
    }

    const scaleLabels = document.createElement("div");
    scaleLabels.className = "likert-scale-labels";
    scaleLabels.innerHTML = "<span>非常不同意</span><span>非常同意</span>";

    fieldset.appendChild(scale);
    fieldset.appendChild(scaleLabels);
    surveyQuestionsContainer.appendChild(fieldset);
  }
}

// -------------------------------------------------------------
// 適配度調查表單送出：呼叫 /api/survey 算分數、存進資料庫，
// 再把結果丟進聊天室當一則訊息，然後把問卷面板關起來。
// -------------------------------------------------------------
surveyForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const unanswered = surveyQuestions.filter((q) => !surveyAnswers[q.id]);
  if (unanswered.length > 0) {
    alert(`還有 ${unanswered.length} 題尚未作答，請往上捲動確認每一題都選過分數。`);
    return;
  }

  const submitButton = surveyForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  submitButton.textContent = "評估中...";

  try {
    const response = await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: surveyAnswers }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `伺服器回傳錯誤狀態碼：${response.status}`);
    }

    // 問卷完成：面板關起來，格子上順便顯示總分，結果丟進聊天室
    surveyPanel.hidden = true;
    updateQuickActionsVisibility();
    tileSurvey.querySelector("span:last-child").textContent = `適配度調查（${data.totalScore} 分）`;

    submitButton.disabled = false;
    submitButton.textContent = "重新評估";

    const resultText = formatSurveyResult(data);
    appendMessage(resultText, "ai");
    // 把這則結果放進對話歷史，之後聊天時 AI 才會知道這位客戶的調查結果和分數
    conversationHistory.push({ role: "ai", text: resultText });

    chatInput.focus();
  } catch (error) {
    console.error(error);
    alert(`問卷送出失敗：${error.message}`);
    submitButton.disabled = false;
    submitButton.textContent = "開始評估";
  }
});

// 把 /api/survey 回傳的分數明細和 AI 摘要組成一段易讀的文字
function formatSurveyResult(data) {
  const { vehicle, details, totalScore, summary } = data;

  const detailLines = Object.values(details)
    .map((d) => `・${d.label}　${d.score}/5`)
    .join("\n");

  return (
    `【適配度評估結果：${vehicle.name}】\n` +
    `總分：${totalScore} / 100\n\n` +
    `${detailLines}\n\n` +
    `${summary}`
  );
}

// -------------------------------------------------------------
// 聊天室下面的快捷格子：
// 「適配度調查」格子 -> 打開／關閉適配度問卷面板
// 「車輛比較」格子 -> 打開／關閉車輛比較面板
// -------------------------------------------------------------
tileSurvey.addEventListener("click", () => {
  const willOpen = surveyPanel.hidden;
  if (willOpen) {
    closeOtherPanels(surveyPanel);
  }
  surveyPanel.hidden = !willOpen;
  updateQuickActionsVisibility();
  if (willOpen) {
    loadSurveyQuestions();
  }
});

surveyClose.addEventListener("click", () => {
  surveyPanel.hidden = true;
  updateQuickActionsVisibility();
});

tileCompare.addEventListener("click", () => {
  const willOpen = comparePanel.hidden;
  if (willOpen) {
    closeOtherPanels(comparePanel);
  }
  comparePanel.hidden = !willOpen;
  updateQuickActionsVisibility();
  if (willOpen) {
    loadComparePoints();
  }
});

compareClose.addEventListener("click", () => {
  comparePanel.hidden = true;
  updateQuickActionsVisibility();
});

tileScenario.addEventListener("click", () => {
  const willOpen = scenarioPanel.hidden;
  if (willOpen) {
    closeOtherPanels(scenarioPanel);
  }
  scenarioPanel.hidden = !willOpen;
  updateQuickActionsVisibility();
  if (willOpen) {
    loadScenarios();
  }
});

scenarioClose.addEventListener("click", () => {
  scenarioPanel.hidden = true;
  updateQuickActionsVisibility();
});

tileCost.addEventListener("click", () => {
  const willOpen = costPanel.hidden;
  if (willOpen) {
    closeOtherPanels(costPanel);
  }
  costPanel.hidden = !willOpen;
  updateQuickActionsVisibility();
});

costClose.addEventListener("click", () => {
  costPanel.hidden = true;
  updateQuickActionsVisibility();
});

tileCharging.addEventListener("click", () => {
  const willOpen = chargingPanel.hidden;
  if (willOpen) {
    closeOtherPanels(chargingPanel);
  }
  chargingPanel.hidden = !willOpen;
  updateQuickActionsVisibility();
  if (willOpen) {
    loadChargingTopics();
  }
});

chargingClose.addEventListener("click", () => {
  chargingPanel.hidden = true;
  updateQuickActionsVisibility();
});

tileContact.addEventListener("click", () => {
  const willOpen = contactPanel.hidden;
  if (willOpen) {
    closeOtherPanels(contactPanel);
  }
  contactPanel.hidden = !willOpen;
  updateQuickActionsVisibility();
});

contactClose.addEventListener("click", () => {
  contactPanel.hidden = true;
  updateQuickActionsVisibility();
});

// -------------------------------------------------------------
// 車輛比較：六個比較項目，預設一次顯示 3 個（第 1 頁），
// 用左右箭頭切換到第 2 頁看剩下的 3 個。
// 題目內容跟適配度問卷一樣走「後端是單一資料來源」的設計，
// 前端只負責跟 GET /api/compare-points 要資料、畫出來。
// -------------------------------------------------------------
const COMPARE_PAGE_SIZE = 3;
let comparePoints = [];
let comparePageIndex = 0;

async function loadComparePoints() {
  // 已經載入過就不用重打 API，直接顯示目前的頁次
  if (comparePoints.length > 0) {
    renderComparePage();
    return;
  }
  const response = await fetch("/api/compare-points");
  const data = await response.json();
  comparePoints = data.points;
  comparePageIndex = 0;
  renderComparePage();
}

function renderComparePage() {
  const totalPages = Math.ceil(comparePoints.length / COMPARE_PAGE_SIZE);
  const start = comparePageIndex * COMPARE_PAGE_SIZE;
  const pageItems = comparePoints.slice(start, start + COMPARE_PAGE_SIZE);

  compareCards.innerHTML = "";
  for (const point of pageItems) {
    const card = document.createElement("div");
    card.className = "compare-card";
    card.innerHTML = `
      <h3>${point.title}</h3>
      <p class="compare-row"><span class="compare-tag gasoline">燃油車</span>${point.gasoline}</p>
      <p class="compare-row"><span class="compare-tag ev">電動車</span>${point.ev}</p>
      <p class="compare-note">${point.note}</p>
    `;
    compareCards.appendChild(card);
  }

  comparePageIndicator.textContent = `第 ${comparePageIndex + 1} / ${totalPages} 組`;
  comparePrev.disabled = comparePageIndex === 0;
  compareNext.disabled = comparePageIndex >= totalPages - 1;
}

comparePrev.addEventListener("click", () => {
  if (comparePageIndex > 0) {
    comparePageIndex--;
    renderComparePage();
  }
});

compareNext.addEventListener("click", () => {
  const totalPages = Math.ceil(comparePoints.length / COMPARE_PAGE_SIZE);
  if (comparePageIndex < totalPages - 1) {
    comparePageIndex++;
    renderComparePage();
  }
});

// 情境卡片的極簡線條圖示，用 id 對應（跟主要 6 個快捷格子同一套視覺風格：
// stroke="currentColor"、細線條），資料本身（scenario.js）不放圖示，
// 圖示是純視覺呈現才放在前端這裡。
const SCENARIO_ICONS = {
  mountain:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19l6-10 4 6 2-3 6 7z"/><circle cx="7" cy="7" r="1.4"/></svg>',
  longtrip:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 4 21"/><path d="M16 3l4 18"/><path d="M12 4v3"/><path d="M12 10.5v3"/><path d="M12 17v3"/></svg>',
  cold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11"/></svg>',
  apartment:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01"/><path d="M10 21v-4h4v4"/></svg>',
};

// -------------------------------------------------------------
// 情境模擬：四張情境卡片（山區／長途／寒冷氣候／公寓充電），輪播設計跟車輛比較一樣，
// 一次顯示 3 個。點卡片會把情境 id 丟給 /api/scenario-query，
// 後端組好背景事實給 Gemini 寫說明，結果顯示成聊天室訊息。
// 面板不會自動關閉（跟問卷/成本試算不同），讓客戶可以連續點好幾個情境。
// -------------------------------------------------------------
const SCENARIO_PAGE_SIZE = 3;
let scenarios = [];
let scenarioPageIndex = 0;

async function loadScenarios() {
  if (scenarios.length > 0) {
    renderScenarioPage();
    return;
  }
  const response = await fetch("/api/scenarios");
  const data = await response.json();
  scenarios = data.scenarios;
  scenarioPageIndex = 0;
  renderScenarioPage();
}

function renderScenarioPage() {
  const totalPages = Math.ceil(scenarios.length / SCENARIO_PAGE_SIZE);
  const start = scenarioPageIndex * SCENARIO_PAGE_SIZE;
  const pageItems = scenarios.slice(start, start + SCENARIO_PAGE_SIZE);

  scenarioCards.innerHTML = "";
  for (const scenario of pageItems) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "compare-card clickable";
    card.innerHTML = `
      <h3><span class="card-icon">${SCENARIO_ICONS[scenario.id] || ""}</span>${scenario.title}</h3>
      <p class="compare-note">${scenario.blurb}</p>
    `;
    card.addEventListener("click", () => askScenario({ scenarioId: scenario.id }));
    scenarioCards.appendChild(card);
  }

  scenarioPageIndicator.textContent = `第 ${scenarioPageIndex + 1} / ${totalPages} 組`;
  scenarioPrev.disabled = scenarioPageIndex === 0;
  scenarioNext.disabled = scenarioPageIndex >= totalPages - 1;
}

scenarioPrev.addEventListener("click", () => {
  if (scenarioPageIndex > 0) {
    scenarioPageIndex--;
    renderScenarioPage();
  }
});

scenarioNext.addEventListener("click", () => {
  const totalPages = Math.ceil(scenarios.length / SCENARIO_PAGE_SIZE);
  if (scenarioPageIndex < totalPages - 1) {
    scenarioPageIndex++;
    renderScenarioPage();
  }
});

// 自由輸入框送出：跟點卡片走同一個 askScenario，只是帶 question 而不是 scenarioId
scenarioForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = scenarioQuestionInput.value.trim();
  if (!question) return;
  appendMessage(question, "user");
  conversationHistory.push({ role: "user", text: question });
  scenarioQuestionInput.value = "";
  askScenario({ question });
});

// 共用函式：不管是點卡片還是打字問，都是呼叫 /api/scenario-query，
// 用「AI 正在輸入...」暫時訊息，回來後換成真正的回覆，並記進對話歷史（讓後續聊天記得這段）。
async function askScenario({ scenarioId, question }) {
  const cardButtons = scenarioCards.querySelectorAll("button");
  cardButtons.forEach((btn) => (btn.disabled = true));

  const loadingBubble = appendMessage("AI 正在輸入...", "ai loading");

  try {
    const response = await fetch("/api/scenario-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId, question }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `伺服器回傳錯誤狀態碼：${response.status}`);
    }

    loadingBubble.textContent = data.reply;
    loadingBubble.className = "message ai";
    conversationHistory.push({ role: "ai", text: data.reply });
  } catch (error) {
    console.error(error);
    loadingBubble.textContent = `發生錯誤：${error.message}`;
    loadingBubble.className = "message ai";
  } finally {
    cardButtons.forEach((btn) => (btn.disabled = false));
  }
}

// -------------------------------------------------------------
// 成本試算：填月里程、油車油耗、油價、充電方式，送出後 costCalc.js 在後端
// 純算式算出油車 vs 電動車每月／每年花費（不靠 AI），算完才丟給 AI 寫成說明文字，
// 結果跟問卷一樣顯示成聊天室訊息，送出成功後面板自動關閉。
// -------------------------------------------------------------
costForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const monthlyKm = Number(document.getElementById("cost-monthly-km").value);
  const gasKmPerLiter = Number(document.getElementById("cost-gas-efficiency").value);
  const gasPricePerLiter = Number(document.getElementById("cost-gas-price").value);
  const chargingType = document.getElementById("cost-charging-type").value;

  const submitButton = costForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  submitButton.textContent = "試算中...";

  try {
    const response = await fetch("/api/cost-calc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyKm, gasKmPerLiter, gasPricePerLiter, chargingType }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `伺服器回傳錯誤狀態碼：${response.status}`);
    }

    costPanel.hidden = true;
    updateQuickActionsVisibility();
    submitButton.disabled = false;
    submitButton.textContent = "開始試算";

    const resultText = formatCostResult(data);
    appendMessage(resultText, "ai");
    conversationHistory.push({ role: "ai", text: resultText });

    chatInput.focus();
  } catch (error) {
    console.error(error);
    alert(`成本試算失敗：${error.message}`);
    submitButton.disabled = false;
    submitButton.textContent = "開始試算";
  }
});

// 把 /api/cost-calc 回傳的數字和 AI 摘要組成一段易讀的文字
function formatCostResult(data) {
  const { result, summary } = data;
  const chargingLabel = result.chargingType === "public" ? "公共快充" : "家用慢充";
  return (
    `【油電成本試算結果】（每月 ${result.monthlyKm} 公里，${chargingLabel}）\n` +
    `目前油車每月油錢：約 NT$${result.monthlyGasCost}\n` +
    `換成電動車每月電費：約 NT$${result.monthlyEvCost}\n` +
    `每月可省：約 NT$${result.monthlySavings}　每年可省：約 NT$${result.yearlySavings}\n\n` +
    `${summary}`
  );
}

// 充電主題卡片的極簡線條圖示，同樣用 id 對應，跟 SCENARIO_ICONS 是同一套風格。
const CHARGING_ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 12 4l8 7"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/><path d="M10 20v-5h4v5"/></svg>',
  public:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 16V8h3.5a2.5 2.5 0 0 1 0 5H9"/></svg>',
  highway:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18"/><path d="M6 17V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/><path d="M9 13h6"/></svg>',
  "tesla-supercharger":
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M13 8l-4 5h3l-1 4 4-5h-3z"/></svg>',
};

// -------------------------------------------------------------
// 充電站查詢：跟情境模擬幾乎同一套邏輯（卡片 + 自由輸入 + 面板不自動關閉），
// 只是換成 /api/charging-topics、/api/charging-query，題庫是 chargingStation.js。
// -------------------------------------------------------------
const CHARGING_PAGE_SIZE = 3;
let chargingTopics = [];
let chargingPageIndex = 0;

async function loadChargingTopics() {
  if (chargingTopics.length > 0) {
    renderChargingPage();
    return;
  }
  const response = await fetch("/api/charging-topics");
  const data = await response.json();
  chargingTopics = data.topics;
  chargingPageIndex = 0;
  renderChargingPage();
}

function renderChargingPage() {
  const totalPages = Math.ceil(chargingTopics.length / CHARGING_PAGE_SIZE);
  const start = chargingPageIndex * CHARGING_PAGE_SIZE;
  const pageItems = chargingTopics.slice(start, start + CHARGING_PAGE_SIZE);

  chargingCards.innerHTML = "";
  for (const topic of pageItems) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "compare-card clickable";
    card.innerHTML = `
      <h3><span class="card-icon">${CHARGING_ICONS[topic.id] || ""}</span>${topic.title}</h3>
      <p class="compare-note">${topic.blurb}</p>
    `;
    card.addEventListener("click", () => askCharging({ topicId: topic.id }));
    chargingCards.appendChild(card);
  }

  chargingPageIndicator.textContent = `第 ${chargingPageIndex + 1} / ${totalPages} 組`;
  chargingPrev.disabled = chargingPageIndex === 0;
  chargingNext.disabled = chargingPageIndex >= totalPages - 1;
}

chargingPrev.addEventListener("click", () => {
  if (chargingPageIndex > 0) {
    chargingPageIndex--;
    renderChargingPage();
  }
});

chargingNext.addEventListener("click", () => {
  const totalPages = Math.ceil(chargingTopics.length / CHARGING_PAGE_SIZE);
  if (chargingPageIndex < totalPages - 1) {
    chargingPageIndex++;
    renderChargingPage();
  }
});

chargingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = chargingQuestionInput.value.trim();
  if (!question) return;
  appendMessage(question, "user");
  conversationHistory.push({ role: "user", text: question });
  chargingQuestionInput.value = "";
  askCharging({ question });
});

async function askCharging({ topicId, question }) {
  const cardButtons = chargingCards.querySelectorAll("button");
  cardButtons.forEach((btn) => (btn.disabled = true));

  const loadingBubble = appendMessage("AI 正在輸入...", "ai loading");

  try {
    const response = await fetch("/api/charging-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, question }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `伺服器回傳錯誤狀態碼：${response.status}`);
    }

    loadingBubble.textContent = data.reply;
    loadingBubble.className = "message ai";
    conversationHistory.push({ role: "ai", text: data.reply });
  } catch (error) {
    console.error(error);
    loadingBubble.textContent = `發生錯誤：${error.message}`;
    loadingBubble.className = "message ai";
  } finally {
    cardButtons.forEach((btn) => (btn.disabled = false));
  }
}

// -------------------------------------------------------------
// 真人客服聯繫：純表單送出，內容原封不動存進資料庫（不經過 AI 改寫），
// 送出成功後面板自動關閉，聊天室顯示一則確認訊息（純前端組字，不用再打一次 API）。
// -------------------------------------------------------------
contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("contact-name").value.trim();
  const contactInfo = document.getElementById("contact-info").value.trim();
  const message = document.getElementById("contact-message").value.trim();

  const submitButton = contactForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  submitButton.textContent = "送出中...";

  try {
    const response = await fetch("/api/contact-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contactInfo, message }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `伺服器回傳錯誤狀態碼：${response.status}`);
    }

    contactPanel.hidden = true;
    updateQuickActionsVisibility();
    contactForm.reset();
    submitButton.disabled = false;
    submitButton.textContent = "送出留言";

    const confirmText = `已收到 ${name} 的留言，客服會盡快透過「${contactInfo}」與您聯繫（服務時間：週一至週五 9:00～18:00）。`;
    appendMessage(confirmText, "ai");
    conversationHistory.push({ role: "ai", text: confirmText });

    chatInput.focus();
  } catch (error) {
    console.error(error);
    alert(`留言送出失敗：${error.message}`);
    submitButton.disabled = false;
    submitButton.textContent = "送出留言";
  }
});

// -------------------------------------------------------------
// 語音輸入：用瀏覽器內建的 Web Speech API（SpeechRecognition），
// 不用另外申請金鑰、不用呼叫任何後端 API，語音辨識完全在瀏覽器裡做完，
// 辨識結果直接寫回輸入框讓使用者確認/編輯，不會自動送出。
//
// 目前只有 Chrome / Edge（桌機版）支援得比較完整，Safari/Firefox
// 不一定有 window.SpeechRecognition，所以要先做 feature detection，
// 偵測不到就直接把麥克風按鈕關掉，不要讓使用者點了沒反應。
//
// 同一時間只會有一支麥克風在錄音：共用同一個 recognition 實例，
// 用 activeVoiceButton / activeVoiceInput 記錄「現在是哪個按鈕、哪個輸入框」
// 在錄音，再點一次同一個按鈕就停止；點別的麥克風按鈕會先停掉前一個。
// -------------------------------------------------------------
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const voiceButtons = [chatVoiceBtn, scenarioVoiceBtn, chargingVoiceBtn];

let recognition = null;
let activeVoiceButton = null;
let activeVoiceInput = null;

if (SpeechRecognitionCtor) {
  recognition = new SpeechRecognitionCtor();
  recognition.lang = "zh-TW";
  recognition.interimResults = true; // 邊講邊即時顯示辨識中的文字，不用等講完才看到結果
  recognition.continuous = false; // 講完一段（偵測到停頓）就自動結束，不用手動停止

  recognition.addEventListener("result", (event) => {
    if (!activeVoiceInput) return;
    // interimResults 開著時，event.results 會包含「暫定」跟「確定」的片段，
    // 全部串起來顯示，確定的部分之後也不會再變動
    let transcript = "";
    for (const result of event.results) {
      transcript += result[0].transcript;
    }
    activeVoiceInput.value = transcript;
  });

  recognition.addEventListener("end", stopVoiceRecording);

  recognition.addEventListener("error", (event) => {
    console.error("語音辨識發生錯誤：", event.error);
    stopVoiceRecording();
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      alert("無法使用麥克風，請確認瀏覽器已允許這個網站使用麥克風權限。");
    }
  });
} else {
  // 這個瀏覽器不支援語音辨識：把麥克風按鈕關掉，滑鼠移過去會顯示原因
  for (const button of voiceButtons) {
    button.disabled = true;
    button.title = "此瀏覽器不支援語音輸入，建議改用電腦版 Chrome 或 Edge";
  }
}

function stopVoiceRecording() {
  if (activeVoiceButton) {
    activeVoiceButton.classList.remove("recording");
  }
  activeVoiceButton = null;
  activeVoiceInput = null;
}

// 按下麥克風：第一次按開始錄音，錄音中再按同一顆就停止；
// 按別顆麥克風按鈕的話，先停掉正在錄的那個，再開始新的一個
function toggleVoiceInput(button, input) {
  if (!recognition) return;

  if (activeVoiceButton === button) {
    recognition.stop();
    return;
  }

  if (activeVoiceButton) {
    recognition.stop();
  }

  activeVoiceButton = button;
  activeVoiceInput = input;
  input.value = "";
  input.focus();
  button.classList.add("recording");
  recognition.start();
}

chatVoiceBtn.addEventListener("click", () => toggleVoiceInput(chatVoiceBtn, chatInput));
scenarioVoiceBtn.addEventListener("click", () => toggleVoiceInput(scenarioVoiceBtn, scenarioQuestionInput));
chargingVoiceBtn.addEventListener("click", () => toggleVoiceInput(chargingVoiceBtn, chargingQuestionInput));

// 在畫面上新增一則訊息
// role: "user" 或 "ai"，決定訊息要靠左還靠右、什麼顏色
function appendMessage(text, role) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;
  bubble.textContent = text;
  chatMessages.appendChild(bubble);

  // 每次新增訊息後，自動捲到最底部，模擬一般聊天軟體的行為
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return bubble;
}

// 監聽表單送出事件（按 Enter 或按「送出」按鈕都會觸發 submit）
chatForm.addEventListener("submit", async (event) => {
  // 預設表單送出會重新整理頁面，這裡要擋掉，改用 fetch 自己處理
  event.preventDefault();

  const userText = chatInput.value.trim();
  if (!userText) return; // 空白訊息不處理

  appendMessage(userText, "user");
  conversationHistory.push({ role: "user", text: userText });
  chatInput.value = "";
  chatInput.focus();

  // 先顯示一個「AI 正在輸入...」的暫時訊息，等真的回覆回來再替換掉
  const loadingBubble = appendMessage("AI 正在輸入...", "ai loading");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationHistory }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `伺服器回傳錯誤狀態碼：${response.status}`);
    }

    // 把「正在輸入」的暫時訊息換成真正的回覆內容
    loadingBubble.textContent = data.reply;
    loadingBubble.className = "message ai";
    conversationHistory.push({ role: "ai", text: data.reply });
  } catch (error) {
    console.error(error);
    loadingBubble.textContent = `發生錯誤：${error.message}`;
    loadingBubble.className = "message ai";
    // 這輪失敗了，把剛剛加進歷史的使用者訊息拿掉，避免下次送出時歷史錯亂
    conversationHistory.pop();
  }
});
