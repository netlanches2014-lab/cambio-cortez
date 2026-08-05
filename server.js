const express = require("express");
const helmet = require("helmet");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const BINANCE_ENDPOINT =
  "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

const CACHE_TTL_MS = 20000;
const REQUEST_TIMEOUT_MS = 12000;
const cache = new Map();

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

app.use(express.json({ limit: "20kb" }));
app.use(express.static(__dirname));

function median(values) {
  const sorted = values
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!sorted.length) return null;

  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function createPayload(fiat, tradeType, publisherType = null) {
  const body = {
    asset: "USDT",
    fiat,
    tradeType,
    page: 1,
    rows: 20,
    payTypes: [],
    transAmount: "",
  };

  if (publisherType) {
    body.publisherType = publisherType;
  }

  return body;
}

async function requestAds(fiat, tradeType, publisherType = "merchant") {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(BINANCE_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        origin: "https://p2p.binance.com",
        referer: "https://p2p.binance.com/",
        clienttype: "web",
      },
      body: JSON.stringify(
        createPayload(fiat, tradeType, publisherType)
      ),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Binance P2P respondeu HTTP ${response.status}`
      );
    }

    const data = await response.json();

    return Array.isArray(data?.data) ? data.data : [];
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAds(entries) {
  return entries
    .map((item) => {
      const adv = item?.adv || {};
      const advertiser = item?.advertiser || {};

      return {
        price: Number(adv.price),
        available: Number(adv.surplusAmount || 0),
        completion: Number(
          advertiser.monthFinishRate || 0
        ),
      };
    })
    .filter(
      (ad) =>
        Number.isFinite(ad.price) &&
        ad.price > 0 &&
        ad.available > 0 &&
        (ad.completion === 0 || ad.completion >= 0.8)
    );
}

async function getSide(fiat, tradeType) {
  let entries = await requestAds(
    fiat,
    tradeType,
    "merchant"
  );

  let ads = normalizeAds(entries);

  if (ads.length < 3) {
    entries = await requestAds(
      fiat,
      tradeType,
      null
    );

    ads = normalizeAds(entries);
  }

  const selected = ads.slice(0, 5);

  const value = median(
    selected.map((ad) => ad.price)
  );

  if (!value) {
    throw new Error(
      `Sem anúncios P2P válidos para ${fiat}`
    );
  }

  return {
    value,
    adsUsed: selected.length,
  };
}

async function quoteFiat(fiat) {
  const [buy, sell] = await Promise.all([
    getSide(fiat, "BUY"),
    getSide(fiat, "SELL"),
  ]);

  return {
    fiat,
    buy: buy.value,
    sell: sell.value,
    buyAds: buy.adsUsed,
    sellAds: sell.adsUsed,
  };
}

app.get("/api/quotes", async (_req, res) => {
  const cacheKey = "quotes";
  const cached = cache.get(cacheKey);

  if (
    cached &&
    Date.now() - cached.savedAt < CACHE_TTL_MS
  ) {
    return res.json({
      ...cached.data,
      cached: true,
    });
  }

  try {
    const [brl, bob] = await Promise.all([
      quoteFiat("BRL"),
      quoteFiat("BOB"),
    ]);

    const result = {
      ok: true,
      source: "Binance P2P",
      methodology:
        "Mediana de até 5 anúncios válidos",
      updatedAt: new Date().toISOString(),
      cached: false,
      stale: false,
      quotes: {
        BRL: brl,
        BOB: bob,
      },
      cross: {
        brlToBobBuy: bob.buy / brl.sell,
        brlToBobSell: bob.sell / brl.buy,
      },
    };

    cache.set(cacheKey, {
      savedAt: Date.now(),
      data: result,
    });

    return res.json(result);
  } catch (error) {
    const stale = cache.get(cacheKey);

    if (stale) {
      return res.json({
        ...stale.data,
        cached: true,
        stale: true,
        error: error.message,
      });
    }

    console.error(
      "Erro ao consultar P2P:",
      error
    );

    return res.status(502).json({
      ok: false,
      error:
        error.name === "AbortError"
          ? "A consulta à Binance demorou demais."
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
