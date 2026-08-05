const express = require("express");
const helmet = require("helmet");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const BINANCE_ENDPOINTS = [
  "https://api.binance.com/api/v3/ticker/bookTicker?symbol=USDTBRL",
  "https://api-gcp.binance.com/api/v3/ticker/bookTicker?symbol=USDTBRL",
  "https://api1.binance.com/api/v3/ticker/bookTicker?symbol=USDTBRL",
  "https://api2.binance.com/api/v3/ticker/bookTicker?symbol=USDTBRL",
  "https://api3.binance.com/api/v3/ticker/bookTicker?symbol=USDTBRL",
  "https://api4.binance.com/api/v3/ticker/bookTicker?symbol=USDTBRL"
];

const BOLIVIA_URL =
  "https://api.dolarbluebolivia.click/v1/officialRate";

const CACHE_TIME_MS = 60000;
const REQUEST_TIMEOUT_MS = 12000;

let cachedResult = null;
let cachedAt = 0;

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"]
      }
    }
  })
);

app.use(express.json({ limit: "20kb" }));
app.use(express.static(__dirname));

async function fetchJson(url) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "CambioCortez/4.0"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        `A fonte respondeu HTTP ${response.status}`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBinanceSpot() {
  let lastError = null;

  for (const endpoint of BINANCE_ENDPOINTS) {
    try {
      const data = await fetchJson(endpoint);

      const bidPrice = Number(data?.bidPrice);
      const askPrice = Number(data?.askPrice);

      if (
        !Number.isFinite(bidPrice) ||
        !Number.isFinite(askPrice) ||
        bidPrice <= 0 ||
        askPrice <= 0
      ) {
        throw new Error(
          "A Binance retornou valores inválidos."
        );
      }

      return {
        bidPrice,
        askPrice,
        endpoint
      };
    } catch (error) {
      lastError = error;
      console.error(
        `Falha no endpoint Binance ${endpoint}:`,
        error.message
      );
    }
  }

  throw new Error(
    `Todos os endpoints da Binance falharam. ${
      lastError?.message || ""
    }`
  );
}

async function fetchBoliviaRate() {
  const response = await fetchJson(BOLIVIA_URL);

  const blue = response?.data?.blue;

  const buy = Number(blue?.buy);
  const sell = Number(blue?.sell);

  if (
    !Number.isFinite(buy) ||
    !Number.isFinite(sell) ||
    buy <= 0 ||
    sell <= 0
  ) {
    throw new Error(
      "A fonte boliviana retornou valores inválidos."
    );
  }

  return {
    buy,
    sell
  };
}

async function buildQuotes() {
  const [binance, bolivia] = await Promise.all([
    fetchBinanceSpot(),
    fetchBoliviaRate()
  ]);

  const brlBuy = binance.bidPrice;
  const brlSell = binance.askPrice;

  const bobBuy = bolivia.buy;
  const bobSell = bolivia.sell;

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    cached: false,
    stale: false,

    source:
      "USDT/BRL: Binance Spot • " +
      "USDT/BOB: Powered by dolarbluebolivia.click",

    methodology:
      "USDT/BRL usa o melhor preço de compra e venda " +
      "do livro Spot da Binance. " +
      "USDT/BOB usa a cotação blue da Bolívia. " +
      "BRL/BOB é calculado pelo cruzamento via USDT.",

    quotes: {
      BRL: {
        fiat: "BRL",
        buy: brlBuy,
        sell: brlSell
      },

      BOB: {
        fiat: "BOB",
        buy: bobBuy,
        sell: bobSell
      }
    },

    cross: {
      brlToBobBuy: bobBuy / brlSell,
      brlToBobSell: bobSell / brlBuy
    }
  };
}

app.get("/api/quotes", async (_req, res) => {
  const now = Date.now();

  if (
    cachedResult &&
    now - cachedAt < CACHE_TIME_MS
  ) {
    return res.json({
      ...cachedResult,
      cached: true
    });
  }

  try {
    const result = await buildQuotes();

    cachedResult = result;
    cachedAt = now;

    return res.json(result);
  } catch (error) {
    console.error(
      "Erro ao atualizar cotações:",
      error
    );

    if (cachedResult) {
      return res.json({
        ...cachedResult,
        cached: true,
        stale: true,
        error: error.message
      });
    }

    return res.status(502).json({
      ok: false,
      error:
        error.name === "AbortError"
          ? "A consulta demorou mais que o esperado."
          : error.message
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Câmbio Cortez",
    time: new Date().toISOString()
  });
});

app.get("*", (_req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Câmbio Cortez iniciado na porta ${PORT}`
  );
});
