const express = require("express");
const helmet = require("helmet");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const NOVADAX_URL =
  "https://api.novadax.com/v1/market/ticker?symbol=USDT_BRL";

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
        "user-agent": "CambioCortez/5.0"
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

async function fetchNovadaxRate() {
  const response = await fetchJson(NOVADAX_URL);

  if (response?.code !== "A10000") {
    throw new Error(
      response?.message || "Erro na resposta da NovaDAX."
    );
  }

  const ticker = response?.data;

  const buy = Number(ticker?.bid);
  const sell = Number(ticker?.ask);

  if (
    !Number.isFinite(buy) ||
    !Number.isFinite(sell) ||
    buy <= 0 ||
    sell <= 0
  ) {
    throw new Error(
      "A NovaDAX retornou valores inválidos."
    );
  }

  return {
    buy,
    sell
  };
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
  const [brl, bob] = await Promise.all([
    fetchNovadaxRate(),
    fetchBoliviaRate()
  ]);

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    cached: false,
    stale: false,

    source:
      "USDT/BRL: NovaDAX • " +
      "USDT/BOB: Powered by dolarbluebolivia.click",

    methodology:
      "USDT/BRL usa os melhores preços bid e ask da NovaDAX. " +
      "USDT/BOB usa a cotação blue da Bolívia. " +
      "BRL/BOB é calculado pelo cruzamento via USDT.",

    quotes: {
      BRL: {
        fiat: "BRL",
        buy: brl.buy,
        sell: brl.sell
      },

      BOB: {
        fiat: "BOB",
        buy: bob.buy,
        sell: bob.sell
      }
    },

    cross: {
      brlToBobBuy: bob.buy / brl.sell,
      brlToBobSell: bob.sell / brl.buy
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
