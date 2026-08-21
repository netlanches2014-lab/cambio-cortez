const express = require("express");
const helmet = require("helmet");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// ======================================
// SESSÃO ADMIN
// ======================================

const adminSessions = new Map();
const ADMIN_SESSION_TTL = 24 * 60 * 60 * 1000;

// ======================================
// EXPRESS
// ======================================

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  express.json({
    limit: "30kb"
  })
);

app.use(express.static(__dirname));

// ======================================
// VARIÁVEIS
// ======================================

function checkEnv() {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL não configurada.");
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada."
    );
  }

  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEY não configurada."
    );
  }

  if (!ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD não configurada.");
  }
}

// ======================================
// JSON SEGURO
// ======================================

async function readJson(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: text
    };
  }
}

// ======================================
// SUPABASE DATABASE
// ======================================

async function supabaseDatabaseRequest(
  endpoint,
  options = {}
) {
  checkEnv();

  const response = await fetch(
    SUPABASE_URL + "/rest/v1/" + endpoint,
    {
      ...options,

      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,

        Authorization:
          "Bearer " + SUPABASE_SERVICE_ROLE_KEY,

        "Content-Type": "application/json",

        Prefer: "return=representation",

        ...(options.headers || {})
      }
    }
  );

  const data = await readJson(response);

  if (!response.ok) {
    console.error(
      "Erro Supabase DB:",
      response.status,
      data
    );

    throw new Error(
      data?.message ||
      data?.error ||
      "Erro no banco de dados."
    );
  }

  return data;
}

// ======================================
// SUPABASE AUTH
// ======================================

async function supabaseAuthRequest(
  endpoint,
  options = {}
) {
  checkEnv();

  const response = await fetch(
    SUPABASE_URL + "/auth/v1/" + endpoint,
    {
      ...options,

      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,

        "Content-Type": "application/json",

        ...(options.headers || {})
      }
    }
  );

  const data = await readJson(response);

  return {
    response,
    data
  };
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
// BEARER TOKEN
// ======================================

function getBearerToken(req) {
  const authorization =
    req.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function getAdminToken(req) {
  return getBearerToken(req);
}

// ======================================
// PROTEGER ADMIN
// ======================================

function requireAdmin(req, res, next) {
  const token = getAdminToken(req);
  const expiration = adminSessions.get(token);

  if (
    !token ||
    !expiration ||
    Date.now() > expiration
  ) {
    if (token) {
      adminSessions.delete(token);
    }

    return res.status(401).json({
      ok: false,
      error:
        "Sessão administrativa inválida ou expirada."
    });
  }

  next();
}

// ======================================
// USUÁRIO SUPABASE
// ======================================

async function getAuthenticatedUser(accessToken) {
  if (!accessToken) return null;

  const { response, data } =
    await supabaseAuthRequest("user", {
      method: "GET",

      headers: {
        Authorization:
          "Bearer " + accessToken
      }
    });

  if (!response.ok) return null;

  return data;
}

async function requireUser(req, res, next) {
  try {
    const token = getBearerToken(req);

    const user =
      await getAuthenticatedUser(token);

    if (!user?.id) {
      return res.status(401).json({
        ok: false,
        error: "Faça login para continuar."
      });
    }

    req.user = user;
    req.userToken = token;

    next();

  } catch (error) {
    console.error(error);

    return res.status(401).json({
      ok: false,
      error: "Sessão inválida."
    });
  }
}

// ======================================
// PERFIL
// ======================================

async function getProfile(userId) {
  const rows =
    await supabaseDatabaseRequest(
      "profiles?id=eq." +
      encodeURIComponent(userId) +
      "&select=id,nome,telefone,tipo,created_at,updated_at",
      {
        method: "GET"
      }
    );

  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return null;
  }

  return rows[0];
}

// ======================================
// COTAÇÕES
// ======================================

async function getQuote() {
  const rows =
    await supabaseDatabaseRequest(
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

    res.set("Cache-Control", "no-store");

    return res.json({
      ok: true,

      updatedAt: quote.updated_at,

      source:
        "Cortez & Sarmento Câmbios",

      methodology:
        "Cotação automática por volume",

      quote: {
        brl_to_bob:
          Number(quote.brl_to_bob),

        bob_to_brl:
          Number(quote.bob_to_brl)
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
// CADASTRO
// ======================================

app.post(
  "/api/auth/signup",
  async (req, res) => {
    try {
      const nome =
        String(req.body?.nome || "").trim();

      const email =
        String(req.body?.email || "")
          .trim()
          .toLowerCase();

      const password =
        String(req.body?.password || "");

      if (nome.length < 2) {
        return res.status(400).json({
          ok: false,
          error: "Digite seu nome."
        });
      }

      if (!email || !email.includes("@")) {
        return res.status(400).json({
          ok: false,
          error: "Digite um e-mail válido."
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          ok: false,
          error:
            "A senha deve ter pelo menos 6 caracteres."
        });
      }

      const { response, data } =
        await supabaseAuthRequest(
          "signup",
          {
            method: "POST",

            body: JSON.stringify({
              email,
              password,

              data: {
                nome
              }
            })
          }
        );

      if (!response.ok) {
        return res
          .status(response.status)
          .json({
            ok: false,

            error:
              data?.msg ||
              data?.message ||
              data?.error_description ||
              "Não foi possível criar o cadastro."
          });
      }

      return res.json({
        ok: true,

        message:
          "Cadastro criado com sucesso.",

        accessToken:
          data?.access_token || null,

        refreshToken:
          data?.refresh_token || null,

        user:
          data?.user || null
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error: "Erro ao criar cadastro."
      });
    }
  }
);

// ======================================
// LOGIN USUÁRIO
// ======================================

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const email =
        String(req.body?.email || "")
          .trim()
          .toLowerCase();

      const password =
        String(req.body?.password || "");

      if (!email || !password) {
        return res.status(400).json({
          ok: false,
          error: "Informe e-mail e senha."
        });
      }

      const { response, data } =
        await supabaseAuthRequest(
          "token?grant_type=password",
          {
            method: "POST",

            body: JSON.stringify({
              email,
              password
            })
          }
        );

      if (!response.ok) {
        return res.status(401).json({
          ok: false,

          error:
            data?.msg ||
            data?.message ||
            data?.error_description ||
            "E-mail ou senha incorretos."
        });
      }

      const user = data?.user;

      let profile = null;

      if (user?.id) {
        profile =
          await getProfile(user.id);
      }

      return res.json({
        ok: true,

        accessToken:
          data.access_token,

        refreshToken:
          data.refresh_token,

        expiresIn:
          data.expires_in,

        user: {
          id: user?.id,
          email: user?.email,

          nome:
            profile?.nome ||
            user?.user_metadata?.nome ||
            "",

          tipo:
            profile?.tipo ||
            "cliente"
        }
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error: "Erro ao entrar."
      });
    }
  }
);

// ======================================
// USUÁRIO LOGADO
// ======================================

app.get(
  "/api/auth/me",
  requireUser,
  async (req, res) => {
    try {
      const profile =
        await getProfile(req.user.id);

      return res.json({
        ok: true,

        user: {
          id: req.user.id,
          email: req.user.email,

          nome:
            profile?.nome ||
            req.user?.user_metadata?.nome ||
            "",

          telefone:
            profile?.telefone || "",

          tipo:
            profile?.tipo ||
            "cliente"
        }
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error:
          "Não foi possível carregar o perfil."
      });
    }
  }
);

// ======================================
// COTAÇÃO DO USUÁRIO
// ======================================

app.get(
  "/api/user/quotes",
  requireUser,
  async (req, res) => {
    try {
      const profile =
        await getProfile(req.user.id);

      const tipo =
        profile?.tipo || "cliente";

      const quote =
        await getQuote();

      // CLIENTE < R$ 1.000
      const clienteMenorBrlToBob =
        Number(quote.brl_to_bob);

      const clienteMenorBobToBrl =
        Number(quote.bob_to_brl);

      // CLIENTE >= R$ 1.000
      const clienteMaiorBrlToBob =
        Number(
          quote.cliente_brl_to_bob ??
          quote.brl_to_bob
        );

      const clienteMaiorBobToBrl =
        Number(
          quote.cliente_bob_to_brl ??
          quote.bob_to_brl
        );

      // CAMBISTA
      const cambistaBrlToBob =
        Number(
          quote.cambista_brl_to_bob ??
          quote.cliente_brl_to_bob ??
          quote.brl_to_bob
        );

      const cambistaBobToBrl =
        Number(
          quote.cambista_bob_to_brl ??
          quote.cliente_bob_to_brl ??
          quote.bob_to_brl
        );

      const brlToBob =
        tipo === "cambista"
          ? cambistaBrlToBob
          : clienteMenorBrlToBob;

      const bobToBrl =
        tipo === "cambista"
          ? cambistaBobToBrl
          : clienteMenorBobToBrl;

      res.set(
        "Cache-Control",
        "no-store"
      );

      return res.json({
        ok: true,

        tipo,

        updatedAt:
          quote.updated_at,

        source:
          "Cortez & Sarmento Câmbios",

        methodology:
          tipo === "cambista"
            ? "Taxa especial para cambista"
            : "Cotação automática por volume",

        quote: {
          brl_to_bob: brlToBob,
          bob_to_brl: bobToBrl,

          cliente_menor_brl_to_bob:
            clienteMenorBrlToBob,

          cliente_menor_bob_to_brl:
            clienteMenorBobToBrl,

          cliente_maior_brl_to_bob:
            clienteMaiorBrlToBob,

          cliente_maior_bob_to_brl:
            clienteMaiorBobToBrl,

          cambista_brl_to_bob:
            cambistaBrlToBob,

          cambista_bob_to_brl:
            cambistaBobToBrl
        }
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error:
          "Não foi possível carregar sua cotação."
      });
    }
  }
);

// ======================================
// LOGOUT USUÁRIO
// ======================================

app.post(
  "/api/auth/logout",
  requireUser,
  async (req, res) => {
    try {
      const { response } =
        await supabaseAuthRequest(
          "logout",
          {
            method: "POST",

            headers: {
              Authorization:
                "Bearer " +
                req.userToken
            }
          }
        );

      return res.json({
        ok: response.ok
      });

    } catch (error) {
      console.error(error);

      return res.json({
        ok: true
      });
    }
  }
);

// ======================================
// LOGIN ADMIN
// ======================================

app.post(
  "/api/admin/login",
  (req, res) => {
    try {
      checkEnv();

      const password =
        String(req.body?.password || "");

      const received =
        Buffer.from(password);

      const expected =
        Buffer.from(ADMIN_PASSWORD);

      let correct = false;

      if (
        received.length ===
        expected.length
      ) {
        correct =
          crypto.timingSafeEqual(
            received,
            expected
          );
      }

      if (!correct) {
        return res.status(401).json({
          ok: false,
          error: "Senha incorreta."
        });
      }

      const token =
        crypto
          .randomBytes(32)
          .toString("hex");

      adminSessions.set(
        token,
        Date.now() +
          ADMIN_SESSION_TTL
      );

      return res.json({
        ok: true,
        token
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error:
          "Erro no painel administrativo."
      });
    }
  }
);

// ======================================
// CARREGAR COTAÇÕES ADMIN
// ======================================

app.get(
  "/api/admin/quotes",
  requireAdmin,
  async (req, res) => {
    try {
      const quote =
        await getQuote();

      return res.json({
        ok: true,

        data: {
          // CLIENTE < 1000
          cliente_menor_brl_to_bob:
            Number(quote.brl_to_bob),

          cliente_menor_bob_to_brl:
            Number(quote.bob_to_brl),

          // CLIENTE >= 1000
          cliente_maior_brl_to_bob:
            Number(
              quote.cliente_brl_to_bob ??
              quote.brl_to_bob
            ),

          cliente_maior_bob_to_brl:
            Number(
              quote.cliente_bob_to_brl ??
              quote.bob_to_brl
            ),

          // CAMBISTA
          cambista_brl_to_bob:
            Number(
              quote.cambista_brl_to_bob ??
              quote.cliente_brl_to_bob ??
              quote.brl_to_bob
            ),

          cambista_bob_to_brl:
            Number(
              quote.cambista_bob_to_brl ??
              quote.cliente_bob_to_brl ??
              quote.bob_to_brl
            ),

          updated_at:
            quote.updated_at
        }
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
// SALVAR 6 COTAÇÕES
// ======================================

app.put(
  "/api/admin/quotes",
  requireAdmin,
  async (req, res) => {
    const clienteMenorBrlToBob =
      validNumber(
        req.body?.clienteMenorBrlToBob
      );

    const clienteMenorBobToBrl =
      validNumber(
        req.body?.clienteMenorBobToBrl
      );

    const clienteMaiorBrlToBob =
      validNumber(
        req.body?.clienteMaiorBrlToBob
      );

    const clienteMaiorBobToBrl =
      validNumber(
        req.body?.clienteMaiorBobToBrl
      );

    const cambistaBrlToBob =
      validNumber(
        req.body?.cambistaBrlToBob
      );

    const cambistaBobToBrl =
      validNumber(
        req.body?.cambistaBobToBrl
      );

    if (
      clienteMenorBrlToBob === null ||
      clienteMenorBobToBrl === null
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Confira as taxas de cliente abaixo de R$ 1.000."
      });
    }

    if (
      clienteMaiorBrlToBob === null ||
      clienteMaiorBobToBrl === null
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Confira as taxas de cliente a partir de R$ 1.000."
      });
    }

    if (
      cambistaBrlToBob === null ||
      cambistaBobToBrl === null
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Confira as taxas de cambista."
      });
    }

    try {
      const rows =
        await supabaseDatabaseRequest(
          "quotes?id=eq.main",
          {
            method: "PATCH",

            body: JSON.stringify({
              // CLIENTE < 1000
              brl_to_bob:
                clienteMenorBrlToBob,

              bob_to_brl:
                clienteMenorBobToBrl,

              // CLIENTE >= 1000
              cliente_brl_to_bob:
                clienteMaiorBrlToBob,

              cliente_bob_to_brl:
                clienteMaiorBobToBrl,

              // CAMBISTA
              cambista_brl_to_bob:
                cambistaBrlToBob,

              cambista_bob_to_brl:
                cambistaBobToBrl,

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
// LISTAR USUÁRIOS
// ======================================

app.get(
  "/api/admin/users",
  requireAdmin,
  async (req, res) => {
    try {
      const profiles =
        await supabaseDatabaseRequest(
          "profiles?select=id,nome,telefone,tipo,created_at&order=created_at.desc",
          {
            method: "GET"
          }
        );

      return res.json({
        ok: true,
        users: profiles || []
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error:
          "Não foi possível carregar os usuários."
      });
    }
  }
);

// ======================================
// ALTERAR CLIENTE / CAMBISTA
// ======================================

app.put(
  "/api/admin/users/:id/type",
  requireAdmin,
  async (req, res) => {
    try {
      const userId =
        String(req.params.id || "");

      const tipo =
        String(req.body?.tipo || "");

      if (
        tipo !== "cliente" &&
        tipo !== "cambista"
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Tipo de usuário inválido."
        });
      }

      const rows =
        await supabaseDatabaseRequest(
          "profiles?id=eq." +
          encodeURIComponent(userId),
          {
            method: "PATCH",

            body: JSON.stringify({
              tipo,

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
          "Não foi possível alterar o tipo do usuário."
      });
    }
  }
);

// ======================================
// LOGOUT ADMIN
// ======================================

app.post(
  "/api/admin/logout",
  requireAdmin,
  (req, res) => {
    adminSessions.delete(
      getAdminToken(req)
    );

    return res.json({
      ok: true
    });
  }
);

// ======================================
// PÁGINA ADMIN
// ======================================

app.get(
  "/admin",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "admin.html"
      )
    );
  }
);

// ======================================
// HEALTH CHECK
// ======================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service:
        "Cortez & Sarmento Câmbios"
    });
  }
);

// ======================================
// INICIAR
// ======================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "Cortez & Sarmento Câmbios iniciado na porta " +
      PORT
    );
  }
);
