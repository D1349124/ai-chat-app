// server.js
// ------------------------------------------------------------
// 這是整個對話 AI 的後端伺服器。
// 用 Express 是因為它是 Node.js 生態裡最主流、文件最完整、
// 社群資源最多的網頁框架，語法也很直覺，適合先求「能動」。
// ------------------------------------------------------------

// dotenv 負責把 .env 檔案裡的變數（像 GEMINI_API_KEY）讀進 process.env，
// 這樣金鑰就不用寫死在程式碼裡，也不會被 commit 上 GitHub（.env 已經在 .gitignore）
require("dotenv").config();

const express = require("express");
const path = require("path");
const { calculateFitScore, QUESTIONS } = require("./scoring");
const { COMPARISON_POINTS } = require("./compare");
const { SCENARIOS } = require("./scenario");
const { CHARGING_TOPICS } = require("./chargingStation");
const { calculateMonthlyCost } = require("./costCalc");
const { insertCustomer, insertContactRequest } = require("./db");

const app = express();
const PORT = 3000;

// 金鑰放在 .env 裡，環境變數名稱要跟 .env 裡的一致
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// 模型也放在 .env，方便之後想換模型不用改程式碼
// gemini-2.0-flash 是 Google AI Studio 免費額度可以用的模型
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// 系統提示詞：決定 AI 的角色和說話語氣，之後客製化主題主要就是改這裡
const SYSTEM_PROMPT =
  "你是一個親切、有耐心的 AI 助理，一律用繁體中文回覆，回答盡量簡潔清楚。";

// 適配度摘要專用的提示詞：特別強調中立、不誇大電動車也不刻意貶低客戶原本的車
const SURVEY_SYSTEM_PROMPT =
  "你是一個中立、專業的購車顧問，負責把系統算好的分數改寫成通順的說明文字。" +
  "你只能根據提供的分數和說明來寫，不能自己編造新的優缺點或數字。" +
  "語氣要中立客觀：電動車表現好的地方可以講，但表現不如燃油車的地方也要照實說，不要為了推銷而誇大電動車或貶低客戶原本的車。" +
  "一律用繁體中文回覆。";

// 情境模擬專用的提示詞：有比對到情境資料時只能根據資料寫，
// 沒比對到的極端問題要老實承認不確定，並建議轉真人客服，不能自己編造數字
const SCENARIO_SYSTEM_PROMPT =
  "你是一個中立、專業的購車顧問，負責回答客戶關於特殊用車情境（例如山區、長途、寒冷氣候、沒有固定車位等）的疑問。" +
  "如果訊息裡有提供「背景事實」，你只能根據這些事實來回答，不能自己編造數字或超出資料範圍的細節。" +
  "如果訊息裡沒有提供背景事實（代表系統沒有比對到相關資料），就用你的一般知識簡短回答，" +
  "但一定要誠實告知這是概略性的說明、實際情況因車型而異，並建議客戶洽詢真人客服取得精確資訊，不要假裝有把握。" +
  "一律用繁體中文回覆，語氣中立、不誇大也不刻意貶低。";

// 成本試算專用的提示詞：數字已經由後端算好，AI 只能照著寫，不能自己重新計算
const COST_SYSTEM_PROMPT =
  "你是一個中立、專業的購車顧問，負責把系統已經算好的油電用車成本數字改寫成一段通順的中文說明。" +
  "數字是系統算好的，你不能自己重新計算、修改或編造任何數字，只能原封不動地引用。" +
  "語氣中立客觀，省錢就照實說省多少，如果算出來電動車沒有比較省，也要照實講，不要為了推銷硬說有省錢。" +
  "一律用繁體中文回覆。";

// 充電站查詢專用的提示詞：這裡只有「概略性的充電情境資訊」，不是即時地圖資料，
// 一定要提醒客戶這不是即時站況，請用實際的充電 App／地圖確認，不能講得好像有即時定位能力
const CHARGING_SYSTEM_PROMPT =
  "你是一個中立、專業的購車顧問，負責回答客戶關於充電方式與充電站的疑問（例如家用充電、公共充電站、國道服務區快充等）。" +
  "如果訊息裡有提供「背景事實」，你只能根據這些事實來回答，不能自己編造數字或即時站點資訊。" +
  "你沒有即時地圖或定位能力，不知道客戶當下位置附近實際有哪些充電站、有沒有空位，" +
  "一定要在回覆中提醒客戶這只是概略性說明，實際站點與即時使用狀況要用充電業者的 App 或地圖查詢確認。" +
  "如果訊息裡沒有提供背景事實（代表系統沒有比對到相關資料），就用一般知識簡短回答，並同樣誠實告知不確定之處。" +
  "一律用繁體中文回覆，語氣中立、不誇大也不刻意貶低。";

// 讓伺服器看得懂前端送過來的 JSON body（不加這行 req.body 會是 undefined）
app.use(express.json());

// 把 public 資料夾設成「靜態檔案」目錄，
// 這樣瀏覽器打 http://localhost:3000 就會自動載入 public/index.html
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------------
// 問卷題目 API：前端一打開頁面就會呼叫這個，動態把題目畫出來。
// 題目內容只維護在 scoring.js 的 QUESTIONS 裡，這裡只是原封不動回傳。
// ------------------------------------------------------------
app.get("/api/survey-questions", (req, res) => {
  res.json({ questions: QUESTIONS });
});

// ------------------------------------------------------------
// 車輛比較 API：「車輛比較」格子點開時，前端呼叫這個拿六個比較項目。
// 內容只維護在 compare.js 的 COMPARISON_POINTS 裡，這裡原封不動回傳。
// ------------------------------------------------------------
app.get("/api/compare-points", (req, res) => {
  res.json({ points: COMPARISON_POINTS });
});

// ------------------------------------------------------------
// 情境模擬 API：「情境模擬」格子點開時，前端呼叫這個拿情境卡片清單。
// 回傳整份 SCENARIOS（含 facts），前端畫卡片只會用到 icon/title/blurb，
// facts 留著是因為前端點卡片時要把 id 傳回來，這裡直接給完整資料省一次查表。
// ------------------------------------------------------------
app.get("/api/scenarios", (req, res) => {
  res.json({ scenarios: SCENARIOS });
});

// 用關鍵字比對「自由輸入」的問題有沒有碰到已經寫好資料的情境，
// 抓不準時準確度會下降，但先求堪用，之後要更準可以升級成向量搜尋
function findScenarioByKeyword(question) {
  return SCENARIOS.find((scenario) =>
    scenario.keywords.some((keyword) => question.includes(keyword))
  );
}

// ------------------------------------------------------------
// 情境模擬查詢 API：「情境卡片」被點擊，或「自由輸入」送出問題都會打這裡。
//
// body 二擇一：
// - { scenarioId: "mountain" }：點卡片，直接用該情境的 facts 當背景資料
// - { question: "冬天在山上開會不會很快沒電？" }：自由輸入，先用關鍵字比對，
//   比對到就把該情境的 facts 當背景資料，比對不到就不給背景資料，
//   讓 AI 老實承認不確定（見 SCENARIO_SYSTEM_PROMPT 的交代）。
// ------------------------------------------------------------
app.post("/api/scenario-query", async (req, res) => {
  const { scenarioId, question } = req.body;

  let scenario = null;
  let userQuestionText;

  if (scenarioId) {
    scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) {
      return res.status(400).json({ error: "找不到對應的情境，請確認 scenarioId 是否正確。" });
    }
    userQuestionText = `請說明「${scenario.title}」情境下，這台電動車大概會遇到什麼狀況、有什麼建議。`;
  } else if (typeof question === "string" && question.trim()) {
    userQuestionText = question.trim();
    scenario = findScenarioByKeyword(userQuestionText);
  } else {
    return res.status(400).json({ error: "請提供 scenarioId 或 question 其中一項。" });
  }

  const prompt = scenario
    ? `客戶的問題／想了解的情境：${userQuestionText}\n\n以下是系統整理好的「${scenario.title}」背景事實，請根據這些事實回答，不要自己編造其他數字：\n` +
      `- 續航影響：${scenario.facts.rangeImpact}\n` +
      `- 充電站密度：${scenario.facts.chargingDensity}\n` +
      `- 建議：${scenario.facts.advice}\n\n` +
      `請把以上內容整理成一段大約 150 字的中文說明，直接回答客戶的問題，不用重複條列，不用開場白或結語客套話。`
    : `客戶的問題：${userQuestionText}\n\n系統沒有比對到現成的背景資料，請用一般知識簡短回答，並誠實告知這只是概略說明、建議客戶洽詢真人客服取得精確資訊。`;

  try {
    const replyText = await callGemini([{ role: "user", text: prompt }], SCENARIO_SYSTEM_PROMPT);
    res.json({ reply: replyText, matchedScenario: scenario ? scenario.title : null });
  } catch (error) {
    console.error("情境模擬查詢失敗：", error);
    res.status(500).json({ error: "呼叫 AI 服務失敗，請稍後再試。" });
  }
});

// ------------------------------------------------------------
// 充電站查詢 API：「充電站查詢」格子點開時，前端呼叫這個拿主題卡片清單。
// 跟情境模擬同一套設計，詳見 chargingStation.js 開頭的說明。
// ------------------------------------------------------------
app.get("/api/charging-topics", (req, res) => {
  res.json({ topics: CHARGING_TOPICS });
});

function findChargingTopicByKeyword(question) {
  return CHARGING_TOPICS.find((topic) =>
    topic.keywords.some((keyword) => question.includes(keyword))
  );
}

// 充電站查詢問答 API：跟 /api/scenario-query 同一套流程，body 二擇一
// { topicId } 或 { question }，差別只在用的題庫和系統提示詞不同。
app.post("/api/charging-query", async (req, res) => {
  const { topicId, question } = req.body;

  let topic = null;
  let userQuestionText;

  if (topicId) {
    topic = CHARGING_TOPICS.find((t) => t.id === topicId);
    if (!topic) {
      return res.status(400).json({ error: "找不到對應的充電主題，請確認 topicId 是否正確。" });
    }
    userQuestionText = `請說明「${topic.title}」這種充電方式大概是什麼狀況、有什麼要注意的地方。`;
  } else if (typeof question === "string" && question.trim()) {
    userQuestionText = question.trim();
    topic = findChargingTopicByKeyword(userQuestionText);
  } else {
    return res.status(400).json({ error: "請提供 topicId 或 question 其中一項。" });
  }

  const prompt = topic
    ? `客戶的問題／想了解的主題：${userQuestionText}\n\n以下是系統整理好的「${topic.title}」背景事實，請根據這些事實回答，不要自己編造其他數字或即時站點資訊：\n` +
      `- 站點密度／普及程度：${topic.facts.density}\n` +
      `- 充電速度：${topic.facts.speed}\n` +
      `- 費用／使用方式：${topic.facts.costOrAccess}\n` +
      `- 建議：${topic.facts.advice}\n\n` +
      `請把以上內容整理成一段大約 150 字的中文說明，直接回答客戶的問題，並提醒客戶這不是即時站況，實際請用充電 App／地圖確認，不用重複條列，不用開場白或結語客套話。`
    : `客戶的問題：${userQuestionText}\n\n系統沒有比對到現成的背景資料，請用一般知識簡短回答，並誠實告知這只是概略說明、沒有即時站點資訊，建議客戶用充電業者的 App 或地圖確認實際狀況。`;

  try {
    const replyText = await callGemini([{ role: "user", text: prompt }], CHARGING_SYSTEM_PROMPT);
    res.json({ reply: replyText, matchedTopic: topic ? topic.title : null });
  } catch (error) {
    console.error("充電站查詢失敗：", error);
    res.status(500).json({ error: "呼叫 AI 服務失敗，請稍後再試。" });
  }
});

// ------------------------------------------------------------
// 真人客服留言 API：「真人客服聯繫」表單送出會 POST 到這裡。
// 純粹存進資料庫（contact_requests 表），不呼叫 AI —— 這是要轉真人處理的管道，
// 內容原封不動存起來就好，不需要也不應該讓 AI 改寫客戶的留言內容。
// ------------------------------------------------------------
app.post("/api/contact-request", (req, res) => {
  const { name, contactInfo, message } = req.body;

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "請填寫姓名。" });
  }
  if (typeof contactInfo !== "string" || !contactInfo.trim()) {
    return res.status(400).json({ error: "請填寫聯絡方式（電話或 Email）。" });
  }

  const id = insertContactRequest({
    createdAt: new Date().toISOString(),
    name: name.trim(),
    contactInfo: contactInfo.trim(),
    message: typeof message === "string" ? message.trim() : "",
  });

  res.json({ id });
});

// ------------------------------------------------------------
// 成本試算 API：「成本試算」表單送出會 POST 到這裡。
//
// 流程（跟 /api/survey 同一套分工）：
// 1. costCalc.js 用純函式算出油車 vs 電動車的每月／每年花費 —— 這部分完全不靠 AI，數字才可驗證
// 2. 把算好的數字丟給 Gemini，請它寫成一段中立的說明文字（AI 只負責組織語言，不負責算數字）
// ------------------------------------------------------------
app.post("/api/cost-calc", async (req, res) => {
  const { monthlyKm, gasKmPerLiter, gasPricePerLiter, chargingType } = req.body;

  let result;
  try {
    result = calculateMonthlyCost({
      monthlyKm: Number(monthlyKm),
      gasKmPerLiter: Number(gasKmPerLiter),
      gasPricePerLiter: Number(gasPricePerLiter),
      chargingType,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  let summaryText;
  try {
    summaryText = await callGemini(
      [{ role: "user", text: buildCostSummaryPrompt(result) }],
      COST_SYSTEM_PROMPT
    );
  } catch (error) {
    console.error("產生成本試算摘要失敗：", error);
    summaryText = "（AI 摘要產生失敗，以下仍提供試算數字供參考。）";
  }

  res.json({ result, summary: summaryText });
});

// 組出請 AI 寫成本試算摘要用的 prompt，數字已經算好，AI 只負責組織成通順的說明
function buildCostSummaryPrompt(result) {
  const chargingLabel = result.chargingType === "public" ? "公共快充" : "家用慢充";
  return `
以下是系統算好的油電用車成本比較（每月行駛 ${result.monthlyKm} 公里，充電方式：${chargingLabel}），請整理成一段大約 120 字的中文說明，語氣中立、專業：

目前油車每月油錢：約 NT$${result.monthlyGasCost}
換成電動車每月電費：約 NT$${result.monthlyEvCost}
每月可省下：約 NT$${result.monthlySavings}
每年可省下：約 NT$${result.yearlySavings}

請直接輸出說明文字，不要重複條列上面的數字，也不要加開場白或結語客套話。
`.trim();
}

// ------------------------------------------------------------
// 客戶適配度調查 API：對話一開始的問卷會 POST 到這裡。
// answers 格式：{ [題目 id]: 1~5 的整數自評分數 }
//
// 流程：
// 1. 用 scoring.js 直接把客戶自評的 1~5 分加總算出總分（1~100）—— 這部分是單純加總，不靠 AI
// 2. 把分數丟給 Gemini，請它「用文字說明」這些分數代表的意義（AI 只負責組織語言，不負責算分）
// 3. 整包資料存進資料庫（customers.db）
// 4. 回傳分數明細 + AI 摘要給前端顯示
// ------------------------------------------------------------
app.post("/api/survey", async (req, res) => {
  const answers = req.body.answers;

  // 防呆：每一題都要有作答，且答案必須是 1~5 的整數
  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ error: "answers 欄位不完整，請確認每一題都有作答。" });
  }
  const missingOrInvalid = QUESTIONS.some((q) => {
    const value = answers[q.id];
    return !Number.isInteger(value) || value < 1 || value > 5;
  });
  if (missingOrInvalid) {
    return res.status(400).json({ error: "每一題都必須選擇 1~5 分，請確認全部作答完畢。" });
  }

  const result = calculateFitScore(answers);

  let summaryText;
  try {
    summaryText = await callGemini(
      [{ role: "user", text: buildSurveySummaryPrompt(result) }],
      SURVEY_SYSTEM_PROMPT
    );
  } catch (error) {
    console.error("產生適配度摘要失敗：", error);
    summaryText = "（AI 摘要產生失敗，以下仍提供各項分數供參考。）";
  }

  const customerId = insertCustomer({
    createdAt: new Date().toISOString(),
    details: result.details,
    totalScore: result.totalScore,
    summaryText,
  });

  res.json({
    customerId,
    vehicle: result.vehicle,
    details: result.details,
    totalScore: result.totalScore,
    summary: summaryText,
  });
});

// 組出請 AI 寫摘要用的 prompt，把每題的分數和敘述餵給它，AI 只負責組織成一段通順、中立的文字
function buildSurveySummaryPrompt(result) {
  const { vehicle, details, totalScore } = result;
  const lines = Object.values(details)
    .map((d) => `- ${d.label}（${d.score}/5）：${d.note}`)
    .join("\n");

  return `
以下是一位客戶的購車適配度調查結果（李克特量表，1 分=非常不同意，5 分=非常同意，分數越高代表客戶自評的同意程度越高），請你把這些資訊整理成一段大約 200 字的中文摘要，語氣中立、專業，像是客服顧問在跟客戶解說：

車輛：${vehicle.name}
總適配度分數：${totalScore} / 100

各項細節：
${lines}

請直接輸出摘要文字，不要重複條列上面的分數，也不要加開場白或結語客套話。
`.trim();
}

// ------------------------------------------------------------
// 對話用的 API：前端會把「完整對話歷史」POST 到這裡（不只是這次輸入的一句話），
// 這樣 AI 才會記得前面聊過什麼，回覆才會有上下文。
//
// messages 格式：[{ role: "user" | "ai", text: "..." }, ...]
// ------------------------------------------------------------
app.post("/api/chat", async (req, res) => {
  const messages = req.body.messages;

  // 簡單防呆：格式不對就回傳錯誤，不要讓伺服器爆掉
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages 欄位必須是非空陣列" });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error:
        "伺服器沒有設定 GEMINI_API_KEY，請在 .env 檔案裡加入你的 Gemini API 金鑰後重新啟動伺服器。",
    });
  }

  try {
    const replyText = await callGemini(messages);
    res.json({ reply: replyText });
  } catch (error) {
    console.error("呼叫 Gemini API 失敗：", error);
    res.status(500).json({ error: "呼叫 AI 服務失敗，請稍後再試。" });
  }
});

// 呼叫 Google Gemini API，把對話歷史整理成 Gemini 要求的格式後送出
// systemPrompt 可以不傳，預設用一般聊天的 SYSTEM_PROMPT；
// 適配度摘要那段呼叫會傳入 SURVEY_SYSTEM_PROMPT，換一種角色設定
async function callGemini(messages, systemPrompt = SYSTEM_PROMPT) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  // Gemini 用 "user" / "model" 當角色名稱，跟前端內部用的 "user" / "ai" 不同，這裡要轉換一下
  const contents = messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.text }],
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API 回傳 ${response.status}：${errorBody}`);
  }

  const data = await response.json();

  // Gemini 回傳的內容藏在這一長串路徑裡，取不到就給一個保底訊息避免整個壞掉
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "（AI 沒有回傳任何內容，請再試一次）"
  );
}

app.listen(PORT, () => {
  console.log(`伺服器啟動成功：http://localhost:${PORT}`);
});
