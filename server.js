const express = require("express");
const helmet = require("helmet");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const BOB_URL =
  "https://api.dolarbluebolivia.click/v1/officialRate";

const BRL_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=brl";

const CACHE_TIME = 60000;

let cache = null;
let cacheTime = 0;

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(express.json());
app.use(express.static(__dirname));

async function fetchJson(url) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 12000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "CambioCortez/3.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Fonte respondeu HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function buildQuotes() {
  const [bobResponse, brlResponse] = await Promise.all([
    fetchJson(BOB_URL),
    fetchJson(BRL_URL),
  ]);

  const bobBlue = bobResponse?.data?.blue;
  const usdtBrl = Number(brlResponse?.tether?.brl);

  const bobBuy = Number(bobBlue?.buy);
  const bobSell = Number(bobBlue?.sell);

  if (
    !Number.isFinite(usdtBrl) ||
    !Number.isFinite(bobBuy) ||
    !Number.isFinite(bobSell) ||
    usdtBrl <= 0 ||
    bobBuy <= 0 ||
    bobSell <= 0
  ) {
    throw new Error("Uma fonte retornou valores inválidos.");
  }

  const brlSpread = 0.003;

  const brlBuy = usdtBrl * (1 - brlSpread);
  const brlSell = usdtBrl * (1 + brlSpread);

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    cached: false,
    stale: false,

    source:
      "USDT/BRL: CoinGecko • USDT/BOB: Powered by dolarbluebolivia.click",

    methodology:
      "USDT/BRL com spread indicativo de 0,3%; USDT/BOB pela cotação blue; BRL/BOB cruzado via USDT",

    quotes: {
      BRL: {
        fiat: "BRL",
        buy: brlBuy,
        sell: brlSell,
      },

      BOB: {
        fiat: "BOB",
        buy: bobBuy,
        sell: bobSell,
      },
    },

    cross: {
      brlToBobBuy: bobBuy / brlSell,
      brlToBobSell: bobSell / brlBuy,
    },
  };
}

app.get("/api/quotes", async (_req, res) => {
  const now = Date.now();

  if (cache && now - cacheTime < CACHE_TIME) {
    return res.json({
      ...cache,
      cached: true,
    });
  }

  try {
    const result = await buildQuotes();

    cache = result;
    cacheTime = now;

    return res.json(result);
  } catch (error) {
    console.error("Erro nas cotações:", error);

    if (cache) {
      return res.json({
        ...cache,
        cached: true,
        stale: true,
        error: error.message,
      });
    }

    return res.status(502).json({
      ok: false,
      error:
        error.name === "AbortError"
          ? "A consulta demorou mais que o esperado."
          : error.message,
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Câmbio Cortez",
    time: new Date().toISOString(),
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Câmbio Cortez iniciado na porta ${PORT}`);
});
