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


// ======================================
// CONFIGURAÇÃO
// ======================================

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(express.json({ limit: "20kb" }));
app.use(express.static(__dirname));


// ======================================
// VERIFICAR VARIÁVEIS
// ======================================

function checkEnv() {
  if (!SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL não configurada."
    );
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada."
    );
  }

  if (!ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_PASSWORD não configurada."
    );
  }
}


// ======================================
// HEADERS SUPABASE
// ======================================

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization:
      "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json"
  };
}


// ======================================
// REQUISIÇÃO SUPABASE
// ======================================

async function supabaseRequest(
  endpoint,
  options = {}
) {
  checkEnv();

  const response = await fetch(
    SUPABASE_URL + "/rest/v1/" + endpoint,
    {
      ...options,

      headers: {
        ...supabaseHeaders(),
        Prefer: "return=representation",
        ...(options.headers || {})
      }
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


// ======================================
// VALIDAR NÚMERO
// ======================================

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


// ======================================
// TOKEN ADMIN
// ======================================

function getToken(req) {
  const authorization =
    req.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice(7);
}


// ======================================
// PROTEGER ROTAS ADMIN
// ======================================

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
      error: "Sessão inválida ou expirada."
    });
  }

  next();
}


// ======================================
// BUSCAR COTAÇÕES
// ======================================

async function getQuote() {
  const rows = await supabaseRequest(
    "quotes?id=eq.main&select=" +
    [
      "id",
      "brl_to_bob",
      "bob_to_brl",
      "cliente_brl_to_bob",
      "cliente_bob_to_brl",
      "cambista_brl_to_bob",
      "cambista_bob_to_brl",
      "updated_at"
    ].join(","),
    {
      method: "GET"
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


// ======================================
// COTAÇÃO PÚBLICA
// ======================================

app.get("/api/quotes", async (req, res) => {
  try {
    const quote = await getQuote();

    const brlToBob =
      quote.cliente_brl_to_bob ??
      quote.brl_to_bob;

    const bobToBrl =
      quote.cliente_bob_to_brl ??
      quote.bob_to_brl;

    res.set("Cache-Control", "no-store");

    return res.json({
      ok: true,

      updatedAt: quote.updated_at,

      source: "Câmbio Cortez",

      methodology: "Cotação manual",

      quote: {
        brl_to_bob:
          brlToBob === null ||
          brlToBob === undefined
            ? null
            : Number(brlToBob),

        bob_to_brl:
          bobToBrl === null ||
          bobToBrl === undefined
            ? null
            : Number(bobToBrl)
      }
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});


// ======================================
// LOGIN ADMIN
// ======================================

app.post("/api/admin/login", (req, res) => {
  try {
    checkEnv();

    const password =
      String(req.body?.password || "");

    const received =
      Buffer.from(password);

    const expected =
      Buffer.from(ADMIN_PASSWORD);

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
        error: "Senha
                  error: "Senha incorreta."
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
      token
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      error: "Erro no painel administrativo."
    });
  }
});


// ======================================
// CARREGAR COTAÇÕES NO ADMIN
// ======================================

app.get(
  "/api/admin/quotes",
  requireAdmin,
  async (req, res) => {
    try {
      const quote = await getQuote();

      return res.json({
        ok: true,
        data: quote
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);


// ======================================
// SALVAR AS 4 COTAÇÕES
// ======================================

app.put(
  "/api/admin/quotes",
  requireAdmin,
  async (req, res) => {

    const clienteBrlToBob =
      validNumber(req.body?.clienteBrlToBob);

    const clienteBobToBrl =
      validNumber(req.body?.clienteBobToBrl);

    const cambistaBrlToBob =
      validNumber(req.body?.cambistaBrlToBob);

    const cambistaBobToBrl =
      validNumber(req.body?.cambistaBobToBrl);
        if (clienteBrlToBob === null) {
      return res.status(400).json({
        ok: false,
        error:
          "Digite uma cotação válida de CLIENTE para REAL → BOLIVIANO."
      });
    }

    if (clienteBobToBrl === null) {
      return res.status(400).json({
        ok: false,
        error:
          "Digite uma cotação válida de CLIENTE para BOLIVIANO → REAL."
      });
    }

    if (cambistaBrlToBob === null) {
      return res.status(400).json({
        ok: false,
        error:
          "Digite uma cotação válida de CAMBISTA para REAL → BOLIVIANO."
      });
    }

    if (cambistaBobToBrl === null) {
      return res.status(400).json({
        ok: false,
        error:
          "Digite uma cotação válida de CAMBISTA para BOLIVIANO → REAL."
      });
    }

    try {
      const rows = await supabaseRequest(
        "quotes?id=eq.main",
        {
          method: "PATCH",

          body: JSON.stringify({
            cliente_brl_to_bob:
              clienteBrlToBob,

            cliente_bob_to_brl:
              clienteBobToBrl,

            cambista_brl_to_bob:
              cambistaBrlToBob,

            cambista_bob_to_brl:
              cambistaBobToBrl,

            brl_to_bob:
              clienteBrlToBob,

            bob_to_brl:
              clienteBobToBrl,

            updated_at:
              new Date().toISOString()
          })
        }
      );

      return res.json({
        ok: true,
        data: rows?.[0] || null
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error:
          "Não foi possível salvar as cotações."
      });
    }
  }
);
// ======================================
// LOGOUT
// ======================================

app.post(
  "/api/admin/logout",
  requireAdmin,
  (req, res) => {

    sessions.delete(
      getToken(req)
    );

    return res.json({
      ok: true
    });
  }
);


// ======================================
// PÁGINA ADMIN
// ======================================

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "admin.html"
    )
  );
});


// ======================================
// TESTE DO SERVIDOR
// ======================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Câmbio Cortez"
  });
});


// ======================================
// INICIAR SERVIDOR
// ======================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    "Câmbio Cortez iniciado na porta " +
    PORT
  );
});
