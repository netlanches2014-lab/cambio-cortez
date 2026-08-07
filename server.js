const express = require("express");
const helmet = require("helmet");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "5567981740114";

const sessions = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000;

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
        formAction: ["'self'"],
      },
    },
  })
);

app.use(express.json({ limit: "20kb" }));
app.use(express.static(__dirname));

function requireEnv() {
  const missing = [];

  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY)
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!ADMIN_PASSWORD) missing.push("ADMIN_PASSWORD");

  if (missing.length) {
    throw new Error(
      `Variáveis ausentes: ${missing.join(", ")}`
    );
  }
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function supabaseRequest(endpoint, options = {}) {
  requireEnv();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${endpoint}`,
    {
      ...options,
      headers: {
        ...supabaseHeaders(),
        Prefer: "return=representation",
        ...(options.headers || {}),
      },
    }
  );

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      body?.message ||
      body?.hint ||
      `Supabase HTTP ${response.status}`;

    throw new Error(message);
  }

  return body;
}

function sanitizeNumber(value) {
  const n = Number(value);

  if (
    !Number.isFinite(n) ||
    n <= 0 ||
    n > 1000000
  ) {
    return null;
  }

  return n;
}

function authToken(req) {
  const header =
    req.get("authorization") || "";

  return header.startsWith("Bearer ")
    ? header.slice(7)
    : "";
}

function isAuthorized(req) {
  const token = authToken(req);
  const expires = sessions.get(token);

  if (!expires) return false;

  if (Date.now() > expires) {
    sessions.delete(token);
    return false;
  }

  return true;
}

function requireAdmin(req, res, next) {
  if (!isAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Sessão inválida ou expirada.",
    });
  }

  next();
}

async function getQuoteRow() {
  const rows = await supabaseRequest(
    "quotes?id=eq.main&select=id,brl_buy,brl_sell,bob_buy,bob_sell,updated_at",
    { method: "GET" }
  );

  if (
    !Array.isArray(rows) ||
    !rows.length
  ) {
    throw new Error(
      "Nenhuma cotação cadastrada."
    );
  }

  return rows[0];
}

function publicPayload(row) {
  const brlBuy = Number(row.brl_buy);
  const brlSell = Number(row.brl_sell);
  const bobBuy = Number(row.bob_buy);
  const bobSell = Number(row.bob_sell);

  return {
    ok: true,

    updatedAt: row.updated_at,

    source:
      "Cotação manual • Câmbio Cortez",

    methodology:
      "Valores definidos pelo administrador",

    whatsapp: WHATSAPP_NUMBER,

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
      brlToBobBuy:
        bobBuy / brlSell,

      brlToBobSell:
        bobSell / brlBuy,
    },
  };
}

app.get(
  "/api/quotes",
  async (_req, res) => {
    try {
      const row =
        await getQuoteRow();

      res.set(
        "Cache-Control",
        "no-store"
      );

      return res.json(
        publicPayload(row)
      );
    } catch (error) {
      console.error(
        "Erro ao carregar cotações:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Não foi possível carregar as cotações.",
      });
    }
  }
);

app.post(
  "/api/admin/login",
  (req, res) => {
    try {
      requireEnv();

      const password = String(
        req.body?.password || ""
      );

      const a =
        Buffer.from(password);

      const b =
        Buffer.from(ADMIN_PASSWORD);

      if (
        a.length !== b.length ||
        !crypto.timingSafeEqual(a, b)
      ) {
        return res.status(401).json({
          ok: false,
          error: "Senha incorreta.",
        });
      }

      const token =
        crypto
          .randomBytes(32)
          .toString("hex");

      sessions.set(
        token,
        Date.now() + SESSION_TTL
      );

      return res.json({
        ok: true,
        token,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error:
          "Painel não configurado.",
      });
    }
  }
);

app.get(
  "/api/admin/quotes",
  requireAdmin,
  async (_req, res) => {
    try {
      const row =
        await getQuoteRow();

      return res.json({
        ok: true,
        data: row,
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  }
);

app.put(
  "/api/admin/quotes",
  requireAdmin,
  async (req, res) => {
    const brlBuy =
      sanitizeNumber(
        req.body?.brlBuy
      );

    const brlSell =
      sanitizeNumber(
        req.body?.brlSell
      );

    const bobBuy =
      sanitizeNumber(
        req.body?.bobBuy
      );

    const bobSell =
      sanitizeNumber(
        req.body?.bobSell
      );

    if (
      ![
        brlBuy,
        brlSell,
        bobBuy,
        bobSell,
      ].every(Boolean)
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Preencha todos os campos com valores maiores que zero.",
      });
    }

    try {
      const rows =
        await supabaseRequest(
          "quotes?id=eq.main",
          {
            method: "PATCH",

            body: JSON.stringify({
              brl_buy: brlBuy,
              brl_sell: brlSell,
              bob_buy: bobBuy,
              bob_sell: bobSell,

              updated_at:
                new Date().toISOString(),
            }),
          }
        );

      if (
        !Array.isArray(rows) ||
        !rows.length
      ) {
        throw new Error(
          "Registro de cotação não encontrado."
        );
      }

      return res.json({
        ok: true,
        data: rows[0],
      });
    } catch (error) {
      console.error(
        "Erro ao salvar:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Não foi possível salvar.",
      });
    }
  }
);

app.post(
  "/api/admin/logout",
  requireAdmin,
  (req, res) => {
    sessions.delete(
      authToken(req)
    );

    return res.json({
      ok: true,
    });
  }
);

app.get(
  "/admin",
  (_req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "admin.html"
      )
    );
  }
);

app.get(
  "/api/health",
  (_req, res) => {
    res.json({
      ok: true,
      service: "Câmbio Cortez",
      time:
        new Date().toISOString(),
    });
  }
);

app.get(
  "*",
  (_req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );
  }
);

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Câmbio Cortez iniciado na porta ${PORT}`
    );
  }
);
