import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const FALLBACK_RATE = 7.25;
const RATE_API = "https://open.er-api.com/v6/latest/USD";
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cnyRate = FALLBACK_RATE;
let lastFetchTime = 0;

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export default function (pi: ExtensionAPI) {
  // ---- Fetch live rate ----
  async function fetchRate(): Promise<number | null> {
    try {
      const res = await fetch(RATE_API);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        result: string;
        rates: { CNY: number };
      };
      if (data.result === "success" && typeof data.rates?.CNY === "number") {
        return data.rates.CNY;
      }
      return null;
    } catch {
      return null;
    }
  }
  // ---- Get rate (cached + auto-refresh) ----
  async function getRate(): Promise<number> {
    const now = Date.now();
    if (now - lastFetchTime < REFRESH_INTERVAL_MS) {
      return cnyRate;
    }
    const rate = await fetchRate();
    lastFetchTime = now;
    if (rate !== null) {
      cnyRate = rate;
    }
    return cnyRate;
  }

  // ---- Initial fetch on load ----
  fetchRate().then((rate) => {
    if (rate !== null) {
      cnyRate = rate;
    }
    lastFetchTime = Date.now();
  });

  pi.on("message_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    let totalCost = 0;
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === "message" && entry.message.role === "assistant") {
        totalCost += entry.message.usage.cost.total;
      }
    }

    if (totalCost > 0) {
      const rate = await getRate();
      const cny = totalCost * rate;
      ctx.ui.setStatus("cny-cost", `${DIM}≈ ¥${cny.toFixed(3)} (汇率 ${rate.toFixed(4)})${RESET}`);
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setStatus("cny-cost", undefined);
  });
}
