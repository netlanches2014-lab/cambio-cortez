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

  if (!SUPABASE_URL) {
    missing.push("SUPABASE_URL");
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!ADMIN_PASSWORD) {
    missing.push("ADMIN_PASSWORD");
  }

  if (missing.length) {
    throw new Error(
      `Variáveis ausentes: ${missing.join(", ")}`
    );
  }
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization:
      `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function supabaseRequest(
  endpoint,
  options = {}
) {
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

  const body = text
    ? JSON.parse(text)
    : null;

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
  const n = Number(value
