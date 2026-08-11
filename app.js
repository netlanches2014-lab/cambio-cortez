const state = {
  data: null,
  timer: null,
  user: null
};

const $ = (id) =>
  document.getElementById(id);


// ======================================
// TOKEN DO USUÁRIO
// ======================================

function getUserToken() {
  return localStorage.getItem(
    "cambioCortezToken"
  ) || "";
}

function saveUserToken(token) {
  localStorage.setItem(
    "cambioCortezToken",
    token
  );
}

function removeUserToken() {
  localStorage.removeItem(
    "cambioCortezToken"
  );
}


// ======================================
// STATUS
// ======================================

function setStatus(type, text) {

  const status = $("status");

  if (!status) {
    return;
  }

  status.className =
    `status ${type}`;

  status.textContent =
    `● ${text}`;
}


// ======================================
// FORMATAR MOEDA
// ======================================

function formatCurrency(
  value,
  currency
) {

  if (!Number.isFinite(value)) {
    return "—";
  }

  if (currency === "BRL") {

    return new Intl.NumberFormat(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ).format(value);
  }

  return (
    value.toLocaleString(
      "pt-BR",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ) + " Bs"
  );
}


// ======================================
// ERROS DO APP
// ======================================

function showError(message) {

  const errorBox =
    $("errorMessage");

  if (!errorBox) {
    return;
  }

  errorBox.textContent =
    message;

  errorBox.classList.remove(
    "hidden"
  );
}

function hideError() {

  const errorBox =
    $("errorMessage");

  if (!errorBox) {
    return;
  }

  errorBox.classList.add(
    "hidden"
  );
}


// ======================================
// MENSAGEM DO LOGIN
// ======================================

function showAuthMessage(
  message,
  isError = true
) {

  const box =
    $("authMessage");

  if (!box) {
    return;
  }

  box.textContent =
    message;

  box.classList.remove(
    "hidden"
  );

  box.style.color =
    isError
      ? "#f77485"
      : "#67d99a";
}

function hideAuthMessage() {

  const box =
    $("authMessage");

  if (!box) {
    return;
  }

  box.textContent = "";

  box.classList.add(
    "hidden"
  );
}


// ======================================
// MOSTRAR APP
// ======================================

function showApp() {

  $("accessScreen")
    ?.classList
    .add("hidden");

  $("app")
    ?.classList
    .remove("hidden");
}


// ======================================
// MOSTRAR LOGIN
// ======================================

function showLogin() {

  $("app")
    ?.classList
    .add("hidden");

  $("accessScreen")
    ?.classList
    .remove("hidden");
}


// ======================================
// LOGIN
// ======================================

async function loginUser() {

  hideAuthMessage();

  const email =
    String(
      $("authEmail")?.value || ""
    )
      .trim()
      .toLowerCase();

  const password =
    String(
      $("authPassword")?.value || ""
    );

  if (!email) {
    showAuthMessage(
      "Digite seu e-mail."
    );
    return;
  }

  if (!password) {
    showAuthMessage(
      "Digite sua senha."
    );
    return;
  }

  const button =
    $("loginUserButton");

  if (button) {
    button.disabled = true;
    button.textContent =
      "ENTRANDO...";
  }

  try {

    const response =
      await fetch(
        "/api/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              email,
              password
            })
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Não foi possível entrar."
      );
    }

    if (!data.accessToken) {

      throw new Error(
        "Sessão não recebida."
      );
    }

    saveUserToken(
      data.accessToken
    );

    state.user =
      data.user || null;

    showApp();

    await loadQuotes();

  } catch (error) {

    showAuthMessage(
      error.message ||
      "Erro ao entrar."
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent =
        "ENTRAR";
    }
  }
}


// ======================================
// CADASTRO
// ======================================

async function signupUser() {

  hideAuthMessage();

  const nome =
    String(
      $("authName")?.value || ""
    ).trim();

  const email =
    String(
      $("authEmail")?.value || ""
    )
      .trim()
      .toLowerCase();

  const password =
    String(
      $("authPassword")?.value || ""
    );

  if (nome.length < 2) {

    showAuthMessage(
      "Digite seu nome."
    );

    return;
  }

  if (
    !email ||
    !email.includes("@")
  ) {

    showAuthMessage(
      "Digite um e-mail válido."
    );

    return;
  }

  if (password.length < 6) {

    showAuthMessage(
      "A senha precisa ter pelo menos 6 caracteres."
    );

    return;
  }

  const button =
    $("signupUserButton");

  if (button) {
    button.disabled = true;
    button.textContent =
      "CRIANDO...";
  }

  try {

    const response =
      await fetch(
        "/api/auth/signup",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              nome,
              email,
              password
            })
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Não foi possível criar o cadastro."
      );
    }

    /*
      Depois do cadastro,
      fazemos login automaticamente.
    */

    const loginResponse =
      await fetch(
        "/api/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              email,
              password
            })
        }
      );

    const loginData =
      await loginResponse.json();

    if (
      loginResponse.ok &&
      loginData.ok &&
      loginData.accessToken
    ) {

      saveUserToken(
        loginData.accessToken
      );

      state.user =
        loginData.user || null;

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
      error.message ||
      "Erro ao criar cadastro."
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent =
        "CRIAR CADASTRO";
    }
  }
}


// ======================================
// VERIFICAR SESSÃO SALVA
// ======================================

async function restoreSession() {

  const token =
    getUserToken();

  if (!token) {
    showLogin();
    return;
  }

  try {

    const response =
      await fetch(
        "/api/auth/me",
        {
          headers: {
            Authorization:
              "Bearer " + token
          }
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        "Sessão inválida."
      );
    }

    state.user =
      data.user || null;

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

  const refreshButton =
    $("refreshButton");

  refreshButton
    ?.classList
    .add("rotating");

  setStatus(
    "loading",
    "Atualizando"
  );

  hideError();

  try {

    const token =
      getUserToken();

    if (!token) {

      removeUserToken();

      showLogin();

      throw new Error(
        "Faça login para acessar as cotações."
      );
    }

    const response =
      await fetch(
        "/api/user/quotes",
        {
          cache: "no-store",

          headers: {
            Authorization:
              "Bearer " + token
          }
        }
      );

    const data =
      await response.json();

    if (response.status === 401) {

      removeUserToken();

      state.user = null;

      showLogin();

      throw new Error(
        "Sua sessão expirou. Entre novamente."
      );
    }

    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Não foi possível carregar as cotações."
      );
    }

    state.data =
      data;

    renderQuotes();

    const tipo =
      String(
        data.tipo || "cliente"
      )
        .toUpperCase();

    setStatus(
      "online",
      `Online • ${tipo}`
    );

  } catch (error) {

    setStatus(
      "error",
      "Indisponível"
    );

    showError(
      "Não foi possível carregar as cotações. " +
      (
        error.message || ""
      )
    );

  } finally {

    refreshButton
      ?.classList
      .remove("rotating");
  }
}


// ======================================
// OBTER TAXAS
// ======================================

function getRates() {

  if (
    !state.data ||
    !state.data.quote
  ) {
    return null;
  }

  const brlToBob =
    Number(
      state.data.quote
        .brl_to_bob
    );

  const bobToBrl =
    Number(
      state.data.quote
        .bob_to_brl
    );

  if (
    !Number.isFinite(brlToBob) ||
    !Number.isFinite(bobToBrl)
  ) {
    return null;
  }

  return {
    brlToBob,
    bobToBrl
  };
}


// ======================================
// EXIBIR COTAÇÕES
// ======================================

function renderQuotes() {

  const rates =
    getRates();

  if (!rates) {
    return;
  }

  const {
    brlToBob,
    bobToBrl
  } = rates;

  const crossBuy =
    $("crossBuy");

  const crossSell =
    $("crossSell");

  if (crossBuy) {

    crossBuy.textContent =
      `1 REAL = ${brlToBob.toLocaleString(
        "pt-BR",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 3
        }
      )} Bs`;
  }

  if (crossSell) {

    crossSell.textContent =
      `${bobToBrl.toLocaleString(
        "pt-BR",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 3
        }
      )} Bs = 1 REAL`;
  }


  const updated =
    state.data.updatedAt
      ? new Date(
          state.data.updatedAt
        )
      : null;

  if (
    updated &&
    !Number.isNaN(
      updated.getTime()
    )
  ) {

    const updatedAt =
      $("updatedAt");

    if (updatedAt) {

      updatedAt.textContent =
        "Última atualização: " +
        updated.toLocaleString(
          "pt-BR"
        );
    }
  }


  const methodology =
    $("methodology");

  if (methodology) {

    methodology.textContent =
      state.data.methodology ||
      "Cotação manual • Câmbio Cortez";
  }

  convertCurrency();
}


// ======================================
// CONVERSOR
// ======================================

function convertCurrency() {

  const rates =
    getRates();

  if (!rates) {
    return null;
  }

  const amount =
    Number(
      $("amount")?.value
    );

  const fromCurrency =
    $("fromCurrency")?.value;

  const toCurrency =
    $("toCurrency")?.value;

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {

    if ($("conversionResult")) {
      $("conversionResult")
        .textContent = "—";
    }

    return null;
  }

  let result = null;
  let rateText = "";

  if (
    fromCurrency === "BRL" &&
    toCurrency === "BOB"
  ) {

    result = {
      value:
        amount *
        rates.brlToBob,

      rate:
        rates.brlToBob
    };

    rateText =
      `1 BRL = ${rates.brlToBob.toLocaleString(
        "pt-BR",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 3
        }
      )} BOB`;

  } else if (
    fromCurrency === "BOB" &&
    toCurrency === "BRL"
  ) {

    result = {
      value:
        amount /
        rates.bobToBrl,

      rate:
        rates.bobToBrl
    };

    rateText =
      `${rates.bobToBrl.toLocaleString(
        "pt-BR",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 3
        }
      )} BOB = 1 BRL`;

  } else {

    result = {
      value: amount,
      rate: 1
    };

    rateText =
      "1 = 1";
  }


  const resultBox =
    $("conversionResult");

  if (resultBox) {

    resultBox.textContent =
      formatCurrency(
        result.value,
        toCurrency
      );
  }


  const rateBox =
    $("conversionRate");

  if (rateBox) {

    rateBox.textContent =
      rateText;
  }

  return result;
}


// ======================================
// TROCAR MOEDAS
// ======================================

function swapCurrencies() {

  const from =
    $("fromCurrency");

  const to =
    $("toCurrency");

  if (!from || !to) {
    return;
  }

  const oldFrom =
    from.value;

  from.value =
    to.value;

  to.value =
    oldFrom;

  convertCurrency();
}


// ======================================
// WHATSAPP
// ======================================

function openWhatsApp() {

  const amount =
    Number(
      $("amount")?.value
    );

  const fromCurrency =
    $("fromCurrency")?.value;

  const toCurrency =
    $("toCurrency")?.value;

  const result =
    convertCurrency();

  if (
    !result ||
    !Number.isFinite(amount)
  ) {

    alert(
      "Digite um valor válido."
    );

    return;
  }

  let valorReal;
  let valorBoliviano;

  if (
    fromCurrency === "BRL"
  ) {

    valorReal =
      amount;

    valorBoliviano =
      result.value;

  } else {

    valorBoliviano =
      amount;

    valorReal =
      result.value;
  }


  const valorRealFormatado =
    valorReal.toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL"
      }
    );


  const valorBolivianoFormatado =
    valorBoliviano.toLocaleString(
      "pt-BR",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ) + " Bs";


  const operacao =
    fromCurrency === "BRL"
      ? "REAL → BOLIVIANO"
      : "BOLIVIANO → REAL";


  const agora =
    new Date();

  const dataHora =
    agora.toLocaleString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    );


  const mensagem =
`⚔️ CÂMBIO CORTEZ

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
    encodeURIComponent(
      mensagem
    );

  window.open(
    whatsappUrl,
    "_blank"
  );
}


// ======================================
// COPIAR COTAÇÃO
// ======================================

async function copyQuote() {

  const amount =
    Number(
      $("amount")?.value
    );

  const fromCurrency =
    $("fromCurrency")?.value;

  const toCurrency =
    $("toCurrency")?.value;

  const result =
    convertCurrency();

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

  if (
    fromCurrency === "BRL"
  ) {

    valorReal =
      amount;

    valorBoliviano =
      result.value;

  } else {

    valorBoliviano =
      amount;

    valorReal =
      result.value;
  }


  const valorRealFormatado =
    valorReal.toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL"
      }
    );


  const valorBolivianoFormatado =
    valorBoliviano.toLocaleString(
      "pt-BR",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ) + " Bs";


  const operacao =
    fromCurrency === "BRL"
      ? "REAL → BOLIVIANO"
      : "BOLIVIANO → REAL";


  const agora =
    new Date();

  const dataHora =
    agora.toLocaleString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    );


  const mensagem =
`⚔️ CÂMBIO CORTEZ

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

    await navigator
      .clipboard
      .writeText(
        mensagem
      );

    const botao =
      $("copyQuoteButton");

    if (!botao) {
      return;
    }

    const textoOriginal =
      botao.innerHTML;

    botao.innerHTML =
      "✓ COTAÇÃO COPIADA";

    setTimeout(
      () => {
        botao.innerHTML =
          textoOriginal;
      },
      2000
    );

  } catch (error) {

    alert(
      "Não foi possível copiar a cotação."
    );
  }
}


// ======================================
// EVENTOS LOGIN
// ======================================

$("loginUserButton")
  ?.addEventListener(
    "click",
    loginUser
  );


$("signupUserButton")
  ?.addEventListener(
    "click",
    signupUser
  );


$("authPassword")
  ?.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Enter"
      ) {

        loginUser();
      }
    }
  );


// ======================================
// EVENTOS DO APP
// ======================================

$("refreshButton")
  ?.addEventListener(
    "click",
    loadQuotes
  );


$("amount")
  ?.addEventListener(
    "input",
    convertCurrency
  );


$("fromCurrency")
  ?.addEventListener(
    "change",
    convertCurrency
  );


$("toCurrency")
  ?.addEventListener(
    "change",
    convertCurrency
  );


$("swapButton")
  ?.addEventListener(
    "click",
    swapCurrencies
  );


$("whatsappButton")
  ?.addEventListener(
    "click",
    openWhatsApp
  );


$("copyQuoteButton")
  ?.addEventListener(
    "click",
    copyQuote
  );


// ======================================
// INICIAR
// ======================================

restoreSession();
