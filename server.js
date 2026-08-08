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


/* =========================
   SUPABASE
========================= */

function requireEnv() {
  const missing = [];

  if (!SUPABASE_URL) {
    missing.push("SUPABASE_URL");
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!ADMIN_PASSWORD) {
    missing.push("ADMIN_PASSWORD");
  }

  if (missing.length > 0) {
    throw new Error(
      "Variáveis ausentes: " + missing.join(", ")
    );
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
  requireEnv();

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

  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      body?.message ||
      body?.hint ||
      "Erro Supabase HTTP " + response.status;

    throw new Error(message);
  }

  return body;
}


/* =========================
   VALIDAÇÃO
========================= */

function sanitizeNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (number <= 0) {
    return null;
  }

  if (number > 1000000) {
    return null;
  }

  return number;
}


/* =========================
   AUTENTICAÇÃO ADMIN
========================= */

function getAuthToken(req) {
  const header =
    req.get("authorization") || "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice(7);
}


function isAuthorized(req) {
  const token = getAuthToken(req);

  if (!token) {
    return false;
  }

  const expires = sessions.get(token);

  if (!expires
