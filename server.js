const express = require("express");
const helmet = require("helmet");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const BINANCE_URL =
  "https://api.binance.com/api/v3/ticker/bookTicker?symbol=USDTBRL";

const BOLIVIA_URL =
  "https://api.dolarbluebolivia.click/v1/officialRate";

const CACHE_TIME = 60000;

let lastResult = null;
let lastRequestTime = 0;

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
        "user-agent": "CambioCortez/2.1",
      },
      signal: controller.signal,
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

async function getQuotes() {
  const [binance, bolivia] = await Promise.all([
    fetchJson(BINANCE_URL),
    fetchJson(BOLIVIA_URL),
  ]);

  const brlBuy = Number(binance.bidPrice);
  const brlSell = Number(binance.askPrice);

  const blue = bolivia?.data?.blue;

  const bobBuy = Number(blue?.buy);
  const bobSell = Number(blue?.sell);

  const values = [
    brlBuy,
    brlSell,
    bobBuy,
    bobSell,
  ];

  if (
    values.some(
      (value) =>
        !Number.isFinite(value) || value <= 0
    )
  ) {
    throw new Error(
      "Uma das fontes retornou uma cotação inválida."
    );
  }

  return {
    ok: true,

    source:
      "USDT/BRL: Binance Spot • " +
      "USDT/BOB: Powered by dolarbluebolivia.click",

    methodology:
      "Compra e venda disponíveis nas fontes; " +
      "BRL/BOB calculado pelo cruzamento via USDT",

    updatedAt: new Date().toISOString(),

    cached: false,
    stale: false,

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

  if (
    lastResult &&
    now - lastRequestTime < CACHE_TIME
  ) {
    return res.json({
      ...lastResult,
      cached: true,
    });
  }

  try {
    const result = await getQuotes();

    lastResult = result;
    lastRequestTime = now;

    return res.json(result);
  } catch (error) {
    console.error(
      "Erro ao atualizar cotações:",
      error
    );

    if (lastResult) {
      return res.json({
        ...lastResult,
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
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Câmbio Cortez iniciado na porta ${PORT}`
  );
});
