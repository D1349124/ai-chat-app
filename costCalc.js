// costCalc.js
// ------------------------------------------------------------
// 「成本試算」功能的計算公式：純函式，輸入客戶的用車習慣，
// 算出換成電動車後每月／每年大概能省多少錢。
//
// 跟 scoring.js 的分工原則一樣：**計算完全在後端跑，不靠 AI**，
// 這樣數字才準確、可驗證，不會有 AI 算錯數字的風險；
// AI 只負責在算完之後把數字寫成一段說明文字（見 server.js 的 COST_SYSTEM_PROMPT）。
// ------------------------------------------------------------

// 電動車耗電量與電價目前是估計值，不是特定車款的官方數據，
// 之後有正式規格可以把這幾個數字換掉，calculateMonthlyCost 的邏輯不用改。
const EV_KWH_PER_KM = 0.15; // 每公里耗電量（度）
const CHARGING_PRICE_PER_KWH = {
  home: 3.5, // 家用慢充電價（約住宅用電費率）
  public: 8, // 公共快充電價（費率通常比家充高）
};

// 檢查一個數字是不是「大於 0 的有限數字」，用來防呆使用者輸入
function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// ------------------------------------------------------------
// 主函式：輸入客戶目前的用車習慣，輸出油車 vs 電動車的每月／每年花費比較。
//
// 參數：
// - monthlyKm：每月行駛里程（公里）
// - gasKmPerLiter：目前油車油耗（公里/公升，數字越大代表越省油）
// - gasPricePerLiter：目前油價（元/公升）
// - chargingType："home"（家用慢充）或 "public"（公共快充）
// ------------------------------------------------------------
function calculateMonthlyCost({ monthlyKm, gasKmPerLiter, gasPricePerLiter, chargingType }) {
  if (!isPositiveNumber(monthlyKm)) {
    throw new Error("monthlyKm 必須是大於 0 的數字");
  }
  if (!isPositiveNumber(gasKmPerLiter)) {
    throw new Error("gasKmPerLiter 必須是大於 0 的數字");
  }
  if (!isPositiveNumber(gasPricePerLiter)) {
    throw new Error("gasPricePerLiter 必須是大於 0 的數字");
  }
  const normalizedChargingType = chargingType === "public" ? "public" : "home";

  const monthlyLiters = monthlyKm / gasKmPerLiter;
  const monthlyGasCost = monthlyLiters * gasPricePerLiter;

  const monthlyKwh = monthlyKm * EV_KWH_PER_KM;
  const evPricePerKwh = CHARGING_PRICE_PER_KWH[normalizedChargingType];
  const monthlyEvCost = monthlyKwh * evPricePerKwh;

  const monthlySavings = monthlyGasCost - monthlyEvCost;

  return {
    monthlyKm,
    chargingType: normalizedChargingType,
    monthlyGasCost: Math.round(monthlyGasCost),
    monthlyEvCost: Math.round(monthlyEvCost),
    monthlySavings: Math.round(monthlySavings),
    yearlySavings: Math.round(monthlySavings * 12),
  };
}

module.exports = { calculateMonthlyCost, EV_KWH_PER_KM, CHARGING_PRICE_PER_KWH };
