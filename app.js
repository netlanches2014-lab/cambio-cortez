const state = {
  data: null,
  timer: null,
  user: null
};

const $ = (id) => document.getElementById(id);


// ======================================
// TOKEN DO USUÁRIO
// ======================================

function getUserToken() {
  return localStorage.getItem("cambioCortezToken") || "";
}

function saveUserToken(token) {
  localStorage.setItem("cambioCortezToken", token);
}

function removeUserToken() {
  localStorage.removeItem("cambioCortezToken");
}


// ======================================
// STATUS
// ======================================

function setStatus(type, text) {
  const status = $("status");

  if (!status) return;

  status.className = `status ${type}`;
  status.textContent = `● ${text}`;
}


// ======================================
// FORMATAR MOEDA
// ======================================

function formatCurrency(value, currency) {
  if (!Number.isFinite(value)) return "—";

  if (currency === "BRL") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  return (
    value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " Bs"
  );
}


// ======================================
// ERROS
// ======================================

function showError(message) {
  const box = $("errorMessage");
  if (!box) return;

  box.textContent = message;
  box.classList.remove("hidden");
}

function hideError() {
  $("errorMessage")?.classList.add("hidden");
}


// ======================================
// LOGIN
// ======================================

function showAuthMessage(message, isError = true) {
  const box = $("authMessage");
  if (!box) return;

  box.textContent = message;
  box.classList.remove("hidden");
  box.style.color = isError ? "#f77485" : "#67d99a";
}

function hideAuthMessage() {
  const box = $("authMessage");
  if (!box) return;

  box.textContent = "";
  box.classList.add("hidden");
}

function showApp() {
  $("accessScreen")?.classList.add("hidden");
  $("app")?.classList.remove("hidden");
}

function showLogin() {
  $("app")?.classList.add("hidden");
  $("accessScreen")?.classList.remove("hidden");
}


// ======================================
// ENTRAR
// ======================================

async function loginUser() {
  hideAuthMessage();

  const email = String($("authEmail")?.value || "")
    .trim()
    .toLowerCase();

  const password = String($("authPassword")?.value || "");

  if (!email) {
    showAuthMessage("Digite seu e-mail.");
    return;
  }

  if (!password) {
    showAuthMessage("Digite sua senha.");
    return;
  }

  const button = $("loginUserButton");

  if (button) {
    button.disabled = true;
    button.textContent = "ENTRANDO...";
  }

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Não foi possível entrar.");
    }

    if (!data.accessToken) {
      throw new Error("Sessão não recebida.");
    }

    saveUserToken(data.accessToken);
    state.user = data.user || null;

    showApp();
    await loadQuotes();

  } catch (error) {
    showAuthMessage(error.message || "Erro ao entrar.");

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "ENTRAR";
    }
  }
}


// ======================================
// CADASTRO
// ======================================

async function signupUser() {
  hideAuthMessage();

  const nome = String($("authName")?.value || "").trim();

  const email = String($("authEmail")?.value || "")
    .trim()
    .toLowerCase();

  const password = String($("authPassword")?.value || "");

  if (nome.length < 2) {
    showAuthMessage("Digite seu nome.");
    return;
  }

  if (!email || !email.includes("@")) {
    showAuthMessage("Digite um e-mail válido.");
    return;
  }

  if (password.length < 6) {
    showAuthMessage("A senha precisa ter pelo menos 6 caracteres.");
    return;
  }

  const button = $("signupUserButton");

  if (button) {
    button.disabled = true;
    button.textContent = "CRIANDO...";
  }

  try {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nome,
        email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Não foi possível criar o cadastro."
      );
    }

    const loginResponse = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const loginData = await loginResponse.json();

    if (
      loginResponse.ok &&
      loginData.ok &&
      loginData.accessToken
    ) {
      saveUserToken(loginData.accessToken);
      state.user = loginData.user || null;

      showApp();
      await loadQuotes();
      return;
    }

    showAuthMessage(
      "Cadastro criado. Agora toque em ENTRAR.",
      false
    );

  } catch (error) {
    showAuthMessage(
      error.message || "Erro ao criar cadastro."
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "CRIAR CADASTRO";
    }
  }
}


// ======================================
// RESTAURAR SESSÃO
// ======================================

async function restoreSession() {
  const token = getUserToken();

  if (!token) {
    showLogin();
    return;
  }

  try {
    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error("Sessão inválida.");
    }

    state.user = data.user || null;

    showApp();
    await loadQuotes();

  } catch (error) {
    removeUserToken();
    state.user = null;
    showLogin();
  }
}


// ======================================
// CARREGAR COTAÇÕES
// ======================================

async function loadQuotes() {
  const refreshButton = $("refreshButton");

  refreshButton?.classList.add("rotating");

  setStatus("loading", "Atualizando");
  hideError();

  try {
    const token = getUserToken();

    if (!token) {
      removeUserToken();
      showLogin();

      throw new Error(
        "Faça login para acessar as cotações."
      );
    }

    const response = await fetch("/api/user/quotes", {
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await response.json();

    if (response.status === 401) {
      removeUserToken();
      state.user = null;
      showLogin();

      throw new Error(
        "Sua sessão expirou. Entre novamente."
      );
    }

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Não foi possível carregar as cotações."
      );
    }

    state.data = data;

    renderQuotes();

    const tipo = String(data.tipo || "cliente").toUpperCase();

    setStatus("online", `Online • ${tipo}`);

  } catch (error) {
    setStatus("error", "Indisponível");

    showError(
      "Não foi possível carregar as cotações. " +
      (error.message || "")
    );

  } finally {
    refreshButton?.classList.remove("rotating");
  }
}


// ======================================
// TAXAS
// ======================================

function getRates() {
  if (!state.data || !state.data.quote) {
    return null;
  }

  const brlToBob = Number(
    state.data.quote.brl_to_bob
  );

  const bobToBrl = Number(
    state.data.quote.bob_to_brl
  );

  if (
    !Number.isFinite(brlToBob) ||
    !Number.isFinite(bobToBrl)
  ) {
    return null;
  }

  const isCambista =
    String(state.data.tipo || "cliente") === "cambista";

  return {
    brlToBob,
    bobToBrl,
    isCambista,

    lowBrlToBob: Number(
      state.data.quote.cliente_menor_brl_to_bob ?? brlToBob
    ),

    lowBobToBrl: Number(
      state.data.quote.cliente_menor_bob_to_brl ?? bobToBrl
    ),

    highBrlToBob: Number(
      state.data.quote.cliente_maior_brl_to_bob ?? brlToBob
    ),

    highBobToBrl: Number(
      state.data.quote.cliente_maior_bob_to_brl ?? bobToBrl
    )
  };
}


// ======================================
// MOSTRAR COTAÇÕES
// ======================================

function renderQuotes() {
  const rates = getRates();

  if (!rates) return;

  if ($("crossBuy")) {
    $("crossBuy").textContent =
      `1 REAL = ${rates.brlToBob.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3
      })} Bs`;
  }

  if ($("crossSell")) {
    $("crossSell").textContent =
      `${rates.bobToBrl.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3
      })} Bs = 1 REAL`;
  }

  const updated = state.data.updatedAt
    ? new Date(state.data.updatedAt)
    : null;

  if (
    updated &&
    !Number.isNaN(updated.getTime()) &&
    $("updatedAt")
  ) {
    $("updatedAt").textContent =
      "Última atualização: " +
      updated.toLocaleString("pt-BR");
  }

  if ($("methodology")) {
    $("methodology").textContent =
      state.data.methodology ||
      "Cotação manual • Cortez & Sarmento Câmbios";
  }

  convertCurrency();
}


// ======================================
// AVISO DE VOLUME
// ======================================

function setVolumeMessage(html) {
  const box =
    $("volumeMessage") ||
    $("volumeRateNotice") ||
    $("volumeBenefit");

  if (box) {
    box.innerHTML = html;
  }
}


// ======================================
// CONVERSOR
// ======================================

function convertCurrency() {
  const rates = getRates();

  if (!rates) return null;

  const amount = Number($("amount")?.value);

  const fromCurrency = $("fromCurrency")?.value;
  const toCurrency = $("toCurrency")?.value;

  if (!Number.isFinite(amount) || amount < 0) {
    if ($("conversionResult")) {
      $("conversionResult").textContent = "—";
    }

    return null;
  }

  let activeBrlToBob = rates.brlToBob;
  let activeBobToBrl = rates.bobToBrl;

  let brlEquivalent = amount;

  if (!rates.isCambista) {
    if (fromCurrency === "BOB") {
      brlEquivalent =
        amount / rates.lowBobToBrl;
    }

    const betterTier =
      brlEquivalent >= 1000;

    activeBrlToBob = betterTier
      ? rates.highBrlToBob
      : rates.lowBrlToBob;

    activeBobToBrl = betterTier
      ? rates.highBobToBrl
      : rates.lowBobToBrl;

    if (betterTier) {
      setVolumeMessage(
        "⭐ <strong>Melhor cotação por volume aplicada!</strong><br>Operações a partir de R$ 1.000 recebem uma condição especial."
      );
    } else {
      const missing =
        Math.max(0, 1000 - brlEquivalent);

      setVolumeMessage(
        `💰 Quanto maior o valor, melhor sua cotação.<br><strong>Faltam ${formatCurrency(
          missing,
          "BRL"
        )} para liberar a melhor taxa.</strong>`
      );
    }

  } else {
    setVolumeMessage(
      "⭐ <strong>Taxa especial de cambista aplicada.</strong>"
    );
  }

  let result = null;
  let rateText = "";

  if (
    fromCurrency === "BRL" &&
    toCurrency === "BOB"
  ) {
    result = {
      value: amount * activeBrlToBob,
      rate: activeBrlToBob
    };

    rateText =
      `1 BRL = ${activeBrlToBob.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3
      })} BOB`;

  } else if (
    fromCurrency === "BOB" &&
    toCurrency === "BRL"
  ) {
    result = {
      value: amount / activeBobToBrl,
      rate: activeBobToBrl
    };

    rateText =
      `${activeBobToBrl.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3
      })} BOB = 1 BRL`;

  } else {
    result = {
      value: amount,
      rate: 1
    };

    rateText = "1 = 1";
  }

  if ($("conversionResult")) {
    $("conversionResult").textContent =
      formatCurrency(
        result.value,
        toCurrency
      );
  }

  if ($("conversionRate")) {
    $("conversionRate").textContent =
      rateText;
  }

  return result;
}


// ======================================
// TROCAR MOEDAS
// ======================================

function swapCurrencies() {
  const from = $("fromCurrency");
  const to = $("toCurrency");

  if (!from || !to) return;

  const oldFrom = from.value;

  from.value = to.value;
  to.value = oldFrom;

  convertCurrency();
}


// ======================================
// WHATSAPP
// ======================================

function openWhatsApp() {
  const amount = Number($("amount")?.value);

  const fromCurrency = $("fromCurrency")?.value;

  const result = convertCurrency();

  if (!result || !Number.isFinite(amount)) {
    alert("Digite um valor válido.");
    return;
  }

  let valorReal;
  let valorBoliviano;

  if (fromCurrency === "BRL") {
    valorReal = amount;
    valorBoliviano = result.value;
  } else {
    valorBoliviano = amount;
    valorReal = result.value;
  }

  const valorRealFormatado =
    valorReal.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  const valorBolivianoFormatado =
    valorBoliviano.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " Bs";

  const operacao =
    fromCurrency === "BRL"
      ? "REAL → BOLIVIANO"
      : "BOLIVIANO → REAL";

  const dataHora =
    new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

  const mensagem =
`⚔️ CORTEZ & SARMENTO CÂMBIOS

📅 Data e horário:
${dataHora}

🔄 Operação:
${operacao}

💱 Cotação:
${$("conversionRate")?.textContent || ""}

🇧🇷 Valor em Real:
${valorRealFormatado}

🇧🇴 Valor em Bolivianos:
${valorBolivianoFormatado}

⏱ Validade da cotação:
10 minutos`;

  const whatsappUrl =
    "https://wa.me/?text=" +
    encodeURIComponent(mensagem);

  window.open(whatsappUrl, "_blank");
}


// ======================================
// COPIAR COTAÇÃO
// ======================================

async function copyQuote() {
  const amount = Number($("amount")?.value);

  const fromCurrency = $("fromCurrency")?.value;

  const result = convertCurrency();

  if (
    !result ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    alert(
      "Digite um valor válido para copiar a cotação."
    );
    return;
  }

  let valorReal;
  let valorBoliviano;

  if (fromCurrency === "BRL") {
    valorReal = amount;
    valorBoliviano = result.value;
  } else {
    valorBoliviano = amount;
    valorReal = result.value;
  }

  const valorRealFormatado =
    valorReal.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  const valorBolivianoFormatado =
    valorBoliviano.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " Bs";

  const operacao =
    fromCurrency === "BRL"
      ? "REAL → BOLIVIANO"
      : "BOLIVIANO → REAL";

  const dataHora =
    new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

  const mensagem =
`⚔️ CORTEZ & SARMENTO CÂMBIOS

📅 Data e horário:
${dataHora}

🔄 Operação:
${operacao}

💱 Cotação:
${$("conversionRate")?.textContent || ""}

🇧🇷 Valor em Real:
${valorRealFormatado}

🇧🇴 Valor em Bolivianos:
${valorBolivianoFormatado}

⏱ Validade da cotação:
10 minutos`;

  try {
    await navigator.clipboard.writeText(mensagem);

    const button = $("copyQuoteButton");

    if (!button) return;

    const original = button.innerHTML;

    button.innerHTML =
      "✓ COTAÇÃO COPIADA";

    setTimeout(() => {
      button.innerHTML = original;
    }, 2000);

  } catch (error) {
    alert(
      "Não foi possível copiar a cotação."
    );
  }
}


// ======================================
// EVENTOS
// ======================================

$("loginUserButton")?.addEventListener(
  "click",
  loginUser
);

$("signupUserButton")?.addEventListener(
  "click",
  signupUser
);

$("authPassword")?.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Enter") {
      loginUser();
    }
  }
);

$("refreshButton")?.addEventListener(
  "click",
  loadQuotes
);

$("amount")?.addEventListener(
  "input",
  convertCurrency
);

$("fromCurrency")?.addEventListener(
  "change",
  convertCurrency
);

$("toCurrency")?.addEventListener(
  "change",
  convertCurrency
);

$("swapButton")?.addEventListener(
  "click",
  swapCurrencies
);

$("whatsappButton")?.addEventListener(
  "click",
  openWhatsApp
);

$("copyQuoteButton")?.addEventListener(
  "click",
  copyQuote
);


// ======================================
// INICIAR
// ======================================
// ======================================
// ATUALIZAR PERFIL E COTAÇÃO AUTOMATICAMENTE
// ======================================

// Quando o usuário volta para esta aba
window.addEventListener("focus", () => {
  if (getUserToken()) {
    loadQuotes();
  }
});

// Quando volta para a página depois de deixá-la em segundo plano
document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState === "visible" &&
    getUserToken()
  ) {
    loadQuotes();
  }
});

// Confere o tipo do usuário automaticamente
// a cada 15 segundos
setInterval(() => {
  if (
    getUserToken() &&
    !$("app")?.classList.contains("hidden")
  ) {
    loadQuotes();
  }
}, 15000);
restoreSession();
