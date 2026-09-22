// scoring.js
// ------------------------------------------------------------
// 適配度問卷用「李克特量表」（Likert scale）設計：
// 每一題都是一句「敘述」，客戶自己從 1（非常不同意）到 5（非常同意）選一個程度，
// 這個選擇本身就是這一題的分數，不需要系統再另外用規則去猜、去換算。
//
// 這跟之前的版本（系統根據客戶填的里程、預算數字自己套規則算分）不一樣：
// 這裡分數完全來自客戶的自我評估，系統只負責加總。
// ------------------------------------------------------------

// 這台電動車的基本資訊，主要給 AI 寫摘要時當背景資訊用。
// 數字取自 Toyota 台灣官網 bZ4X 車型頁（https://www.toyota.com.tw/showroom/bZ4X/）：
// 建議售價 128 萬元、純電續航 743 公里（NEDC 測試值，非實際路測，會因天候路況而異）、
// 電池容量 74.7 kWh。之後車型異動或官網數字更新，只要改這裡就好，其他程式碼不用動。
const TARGET_VEHICLE = {
  name: "TOYOTA bZ4X",
  priceTWD: 1_280_000,
  rangeKm: 743,
  batteryKwh: 74.7,
};

// 1~5 分對應的文字標籤，前端畫量表、AI 寫摘要都會用到
const LEVEL_LABELS = {
  1: "非常不同意",
  2: "不同意",
  3: "普通",
  4: "同意",
  5: "非常同意",
};

// ------------------------------------------------------------
// 問卷題目：只有這裡是「單一資料來源」。
// 前端會用 GET /api/survey-questions 拿到這份清單動態畫出量表，
// 之後想增減題目、改文字，只要改這裡，前端和後端都會自動同步，不用兩邊各改一次。
// ------------------------------------------------------------
const QUESTIONS = [
  {
    id: "commute",
    label: "通勤型態",
    statement: "我平常開車大多是市區或市區加近郊的短程移動，較少跑高速長途。",
  },
  {
    id: "distance",
    label: "每日里程",
    statement: `我每天開車的總里程不長（例如 60 公里以內），這台車 ${TARGET_VEHICLE.rangeKm} 公里的續航力對我來說綽綽有餘。`,
  },
  {
    id: "budget",
    label: "購車預算",
    statement: `我的購車預算大致能涵蓋這台車約 ${TARGET_VEHICLE.priceTWD.toLocaleString("zh-TW")} 元的建議售價，資金壓力不大。`,
  },
  {
    id: "currentCar",
    label: "原車狀況",
    statement: "我現在的車已經有一定車齡、或用車成本偏高，是考慮換車的好時機。",
  },
  {
    id: "chargingAccess",
    label: "充電條件",
    statement: "我平常停車的地方（自家車位或社區）方便裝設或使用充電設備。",
  },
  {
    id: "fuelCost",
    label: "現有用車成本",
    statement: "我目前的油錢／交通花費不低，換成電動車應該能感受到明顯的省錢效果。",
  },
];

// 檢查一個分數是不是合法的 1~5 整數，不合法就用 3（普通）當保底值
function normalizeScore(rawScore) {
  const score = Number(rawScore);
  if (Number.isInteger(score) && score >= 1 && score <= 5) {
    return score;
  }
  return 3;
}

// ------------------------------------------------------------
// 主函式：輸入客戶對每一題的自評分數（1~5），輸出各題明細與總分（1~100）
// 總分算法：把所有題目分數加總，除以「題數 × 5」的滿分，再換算成 1~100 的區間，
// 這樣寫是為了讓題數增減時（QUESTIONS 陣列改長度）不用跟著改這裡的算法
// ------------------------------------------------------------
function calculateFitScore(answers) {
  const details = {};
  let rawTotal = 0;

  for (const question of QUESTIONS) {
    const score = normalizeScore(answers[question.id]);
    rawTotal += score;
    details[question.id] = {
      label: question.label,
      statement: question.statement,
      score,
      note: `${question.statement}（客戶自評：${LEVEL_LABELS[score]}）`,
    };
  }

  const totalScore = Math.round((rawTotal / (QUESTIONS.length * 5)) * 100);

  return { vehicle: TARGET_VEHICLE, details, totalScore };
}

module.exports = { calculateFitScore, QUESTIONS, LEVEL_LABELS, TARGET_VEHICLE };
