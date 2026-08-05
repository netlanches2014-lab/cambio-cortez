const express = require("express");
const helmet = require("helmet");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const BINANCE_ENDPOINT =
  process.env.BINANCE_P2P_ENDPOINT ||
  "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 15000);
const cache = new Map();

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function buildPayload(fiat, tradeType, amount) {
  return {
    asset: "USDT",
    fiat,
    tradeType,
    page: 1,
    rows: 20,
    payTypes: [],
    publisherType: "merchant",
    transAmount: amount ? String(amount) : ""
  };
}

async function fetchAds(fiat, tradeType, amount) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(BINANCE_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
        "user-agent": "CambioCortez/1.0"
      },
      body: JSON.stringify(buildPayload(fiat, tradeType, amount)),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Fonte P2P respondeu com HTTP ${response.status}`);
    }

    const payload = await response.json();
    const entries = Array.isArray(payload?.data) ? payload.data : [];

    return entries
      .map((entry) => {
        const adv = entry?.adv || {};
        const advertiser = entry?.advertiser || {};
        return {
          price: Number(adv.price),
          min: Number(adv.minSingleTransAmount || 0),
          max: Number(adv.dynamicMaxSingleTransAmount || adv.maxSingleTransAmount || 0),
          available: Number(adv.surplusAmount || 0),
          merchant: Boolean(advertiser.userType === "merchant" || advertiser.isMerchant),
          monthOrders: Number(advertiser.monthOrderCount || 0),
          completion: Number(advertiser.monthFinishRate || 0)
        };
      })
      .filter((ad) =>
        Number.isFinite(ad.price) &&
        ad.price > 0 &&
        ad.available > 0 &&
        ad.completion >= 0.80
      );
  } finally {
    clearTimeout(timer);
  }
}

function chooseAds(ads, amount) {
  let valid = ads;
  if (amount) {
    valid = valid.filter((ad) => {
      const withinMin = !ad.min || amount >= ad.min;
      const withinMax = !ad.max || amount <= ad.max;
      return withinMin && withinMax;
    });
  }

  valid.sort((a, b) => {
    if (b.completion !== a.completion) return b.completion - a.completion;
    if (b.monthOrders !== a.monthOrders) return b.monthOrders - a.monthOrders;
    return a.price - b.price;
  });

  return valid.slice(0, 5);
}

async function quoteFiat(fiat, amount) {
  // BUY: anunciante compra USDT e paga fiat → referência para cliente vendendo USDT.
  // SELL: anunciante vende USDT e recebe fiat → referência para cliente comprando USDT.
  const [buyAdsRaw, sellAdsRaw] = await Promise.all([
    fetchAds(fiat, "BUY", amount),
    fetchAds(fiat, "SELL", amount)
  ]);

  const buyAds = chooseAds(buyAdsRaw, amount);
  const sellAds = chooseAds(sellAdsRaw, amount);

  const buy = median(buyAds.map((ad) => ad.price));
  const sell = median(sellAds.map((ad) => ad.price));

  if (!buy || !sell) {
    throw new Error(`Não foram encontrados anúncios válidos para ${fiat}.`);
  }

  return {
    fiat,
    buy,
    sell,
    buyAds: buyAds.length,
    sellAds: sellAds.length
  };
}

app.get("/api/quotes", async (req, res) => {
  const amount = Math.max(0, Number(req.query.amount || 0));
  const cacheKey = `quotes:${amount || "default"}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return res.json({ ...cached.data, cached: true });
  }

  try {
    const [brl, bob] = await Promise.all([
      quoteFiat("BRL", amount),
      quoteFiat("BOB", amount)
    ]);

    const result = {
      ok: true,
      source: "Binance P2P",
      methodology: "Mediana de até 5 anúncios com disponibilidade e conclusão mínima de 80%",
      updatedAt: new Date().toISOString(),
      cached: false,
      quotes: { BRL: brl, BOB: bob },
      cross: {
        // Valor aproximado de 1 BRL em BOB, cruzando por USDT.
        brlToBobBuy: bob.buy / brl.sell,
        brlToBobSell: bob.sell / brl.buy
      }
    };

    cache.set(cacheKey, { time: Date.now(), data: result });
    res.json(result);
  } catch (error) {
    const stale = cache.get(cacheKey);
    res.status(stale ? 200 : 502).json({
      ...(stale?.data || {}),
      ok: Boolean(stale),
      stale: Boolean(stale),
      error: error?.message || "Não foi possível consultar a fonte P2P.",
      updatedAt: stale?.data?.updatedAt || null
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Câmbio Cortez", time: new Date().toISOString() });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Câmbio Cortez disponível em http://localhost:${PORT}`);
});
