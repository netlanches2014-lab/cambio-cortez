const express = require("express");
const helmet = require("helmet");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const sessions = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000;

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(express.json({ limit: "20kb" }));
app.use(express.static(__dirname));

function checkEnv() {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL não configurada.");
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada."
    );
  }

  if (!ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD não configurada.");
  }
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization:
      "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
  };
}

async function supabaseRequest(endpoint, options = {}) {
  checkEnv();

  const response = await fetch(
    SUPABASE_URL + "/rest/v1/" + endpoint,
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

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      "Erro Supabase: " + response.status
    );
  }

  return data;
}

function validNumber(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function getToken(req) {
  const authorization =
    req.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice(7);
}

function requireAdmin(req, res, next) {
  const token = getToken(req);
  const expiration = sessions.get(token);

  if (
    !token ||
    !expiration ||
    Date.now() > expiration
  ) {
    if (token) {
      sessions.delete(token);
    }

    return res.status(401).json({
      ok: false,
      error: "Sessão inválida ou expirada.",
    });
  }

  next();
}

async function getQuote() {
  const rows = await supabaseRequest(
    "quotes?id=eq.main&select=id,brl_to_bob,bob_to_brl,updated_at",
    {
      method: "GET",
    }
  );

  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    throw new Error(
      "Cotação principal não encontrada."
    );
  }

  return rows[0];
}
/* COTAÇÃO PÚBLICA */

app.get("/api/quotes", async (req, res) => {
  try {
    const quote = await getQuote();

    res.set("Cache-Control", "no-store");

    return res.json({
      ok: true,
      updatedAt: quote.updated_at,
      source: "Câmbio Cortez",
      methodology: "Cotação manual",
      quote: {
        brl_to_bob:
          quote.brl_to_bob === null
            ? null
            : Number(quote.brl_to_bob),

        bob_to_brl:
          quote.bob_to_brl === null
            ? null
            : Number(quote.bob_to_brl),
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});


/* LOGIN */

app.post("/api/admin/login", (req, res) => {
  try {
    checkEnv();

    const password = String(
      req.body?.password || ""
    );

    const received = Buffer.from(password);
    const expected = Buffer.from(ADMIN_PASSWORD);

    let correct = false;

    if (received.length === expected.length) {
      correct = crypto.timingSafeEqual(
        received,
        expected
      );
    }

    if (!correct) {
      return res.status(401).json({
        ok: false,
        error: "Senha incorreta.",
      });
    }

    const token = crypto
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
      error: "Erro no painel administrativo.",
    });
  }
});


/* CARREGAR COTAÇÕES NO ADMIN */

app.get(
  "/api/admin/quotes",
  requireAdmin,
  async (req, res) => {
    try {
      const quote = await getQuote();

      return res.json({
        ok: true,
        data: quote,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  }
);


/* SALVAR COTAÇÕES */

app.put(
  "/api/admin/quotes",
  requireAdmin,
  async (req, res) => {
    const brlToBob = validNumber(
      req.body?.brlToBob
    );

    const bobToBrl = validNumber(
      req.body?.bobToBrl
    );

    if (brlToBob === null) {
      return res.status(400).json({
        ok: false,
        error:
          "Digite a cotação REAL → BOLIVIANO.",
      });
    }

    if (bobToBrl === null) {
      return res.status(400).json({
        ok: false,
        error:
          "Digite a cotação BOLIVIANO → REAL.",
      });
    }

    try {
      const rows = await supabaseRequest(
        "quotes?id=eq.main",
        {
          method: "PATCH",
          body: JSON.stringify({
            brl_to_bob: brlToBob,
            bob_to_brl: bobToBrl,
            updated_at:
              new Date().toISOString(),
          }),
        }
      );

      return res.json({
        ok: true,
        data: rows?.[0] || null,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error:
          "Não foi possível salvar as cotações.",
      });
    }
  }
);
/* LOGOUT */

app.post(
  "/api/admin/logout",
  requireAdmin,
  (req, res) => {
    sessions.delete(getToken(req));

    return res.json({
      ok: true,
    });
  }
);


/* ADMIN */

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(__dirname, "admin.html")
  );
});


/* TESTE */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Câmbio Cortez",
  });
});


/* INICIAR */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    "Câmbio Cortez iniciado na porta " + PORT
  );
});
