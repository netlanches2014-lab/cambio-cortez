// ======================================
// CORTEZ E SARMENTOS CÂMBIOS
// PAINEL ADMINISTRATIVO
// ======================================

let adminToken =
  sessionStorage.getItem("adminToken") || "";


// ======================================
// ELEMENTOS
// ======================================

const loginBox =
  document.getElementById("loginBox");

const adminBox =
  document.getElementById("adminBox");

const passwordInput =
  document.getElementById("password");

const loginBtn =
  document.getElementById("loginBtn");

const loginMsg =
  document.getElementById("loginMsg");

const saveBtn =
  document.getElementById("saveBtn");

const adminMsg =
  document.getElementById("adminMsg");

const usersList =
  document.getElementById("usersList");

const logoutBtn =
  document.getElementById("logoutBtn");


// ======================================
// MENSAGENS
// ======================================

function showLoginMessage(message, success = false) {
  if (!loginMsg) return;

  loginMsg.textContent = message;

  loginMsg.style.color =
    success
      ? "#67d99a"
      : "#f5c451";
}


function showAdminMessage(message, success = false) {
  if (!adminMsg) return;

  adminMsg.textContent = message;

  adminMsg.style.color =
    success
      ? "#67d99a"
      : "#f5c451";
}


// ======================================
// MOSTRAR LOGIN
// ======================================

function showLogin() {
  if (loginBox) {
    loginBox.classList.remove("hidden");
  }

  if (adminBox) {
    adminBox.classList.add("hidden");
  }
}


// ======================================
// MOSTRAR PAINEL
// ======================================

function showAdmin() {
  if (loginBox) {
    loginBox.classList.add("hidden");
  }

  if (adminBox) {
    adminBox.classList.remove("hidden");
  }
}


// ======================================
// LOGIN
// ======================================

async function loginAdmin() {

  const password =
    String(passwordInput?.value || "");

  if (!password) {
    showLoginMessage(
      "Digite a senha do administrador."
    );
    return;
  }


  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.textContent = "ENTRANDO...";
  }


  showLoginMessage("Conectando...");


  try {

    const response =
      await fetch("/api/admin/login", {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          password
        })
      });


    const data =
      await response.json();


    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "Não foi possível entrar."
      );
    }


    if (!data.token) {
      throw new Error(
        "Token administrativo não recebido."
      );
    }


    adminToken = data.token;


    sessionStorage.setItem(
      "adminToken",
      adminToken
    );


    showLoginMessage(
      "Login realizado.",
      true
    );


    await loadPanel();


  } catch (error) {

    console.error(
      "Erro no login admin:",
      error
    );


    showLoginMessage(
      error.message ||
      "Erro ao entrar no painel."
    );


  } finally {

    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = "ENTRAR";
    }
  }
}


// ======================================
// CARREGAR PAINEL
// ======================================

async function loadPanel() {

  if (!adminToken) {
    showLogin();
    return;
  }


  try {

    await loadQuotes();

    showAdmin();

    await loadUsers();


  } catch (error) {

    console.error(
      "Erro ao carregar painel:",
      error
    );


    sessionStorage.removeItem(
      "adminToken"
    );


    adminToken = "";


    showLogin();


    showLoginMessage(
      error.message ||
      "Sua sessão expirou."
    );
  }
}


// ======================================
// CARREGAR COTAÇÕES
// ======================================

async function loadQuotes() {

  const response =
    await fetch(
      "/api/admin/quotes",
      {
        cache: "no-store",

        headers: {
          Authorization:
            "Bearer " + adminToken
        }
      }
    );


  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Resposta inválida do servidor."
    );
  }


  if (!response.ok || !data.ok) {

    throw new Error(
      data.error ||
      "Não foi possível carregar as cotações."
    );
  }


  const quote =
    data.data || {};


  setInputValue(
    "clienteMenorBrlToBob",
    quote.cliente_menor_brl_to_bob
  );


  setInputValue(
    "clienteMenorBobToBrl",
    quote.cliente_menor_bob_to_brl
  );


  setInputValue(
    "clienteMaiorBrlToBob",
    quote.cliente_maior_brl_to_bob
  );


  setInputValue(
    "clienteMaiorBobToBrl",
    quote.cliente_maior_bob_to_brl
  );


  setInputValue(
    "cambistaBrlToBob",
    quote.cambista_brl_to_bob
  );


  setInputValue(
    "cambistaBobToBrl",
    quote.cambista_bob_to_brl
  );


  showAdminMessage("");
}


// ======================================
// DEFINIR VALOR DO INPUT
// ======================================

function setInputValue(id, value) {

  const element =
    document.getElementById(id);

  if (!element) return;


  if (
    value !== undefined &&
    value !== null &&
    Number.isFinite(Number(value))
  ) {
    element.value = Number(value);
  }
}


// ======================================
// LER TAXA
// ======================================

function getRateValue(id) {

  const element =
    document.getElementById(id);


  if (!element) {
    return null;
  }


  const value =
    Number(
      String(element.value)
        .replace(",", ".")
    );


  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }


  return value;
}


// ======================================
// SALVAR COTAÇÕES
// ======================================

async function saveQuotes() {

  const clienteMenorBrlToBob =
    getRateValue(
      "clienteMenorBrlToBob"
    );


  const clienteMenorBobToBrl =
    getRateValue(
      "clienteMenorBobToBrl"
    );


  const clienteMaiorBrlToBob =
    getRateValue(
      "clienteMaiorBrlToBob"
    );


  const clienteMaiorBobToBrl =
    getRateValue(
      "clienteMaiorBobToBrl"
    );


  const cambistaBrlToBob =
    getRateValue(
      "cambistaBrlToBob"
    );


  const cambistaBobToBrl =
    getRateValue(
      "cambistaBobToBrl"
    );


  if (
    clienteMenorBrlToBob === null ||
    clienteMenorBobToBrl === null
  ) {
    showAdminMessage(
      "Confira as taxas de cliente abaixo de R$ 1.000."
    );
    return;
  }


  if (
    clienteMaiorBrlToBob === null ||
    clienteMaiorBobToBrl === null
  ) {
    showAdminMessage(
      "Confira as taxas de cliente a partir de R$ 1.000."
    );
    return;
  }


  if (
    cambistaBrlToBob === null ||
    cambistaBobToBrl === null
  ) {
    showAdminMessage(
      "Confira as taxas de cambista."
    );
    return;
  }


  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "SALVANDO...";
  }


  showAdminMessage(
    "Salvando cotações..."
  );


  try {

    const response =
      await fetch(
        "/api/admin/quotes",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              "Bearer " + adminToken
          },

          body: JSON.stringify({

            clienteMenorBrlToBob,
            clienteMenorBobToBrl,

            clienteMaiorBrlToBob,
            clienteMaiorBobToBrl,

            cambistaBrlToBob,
            cambistaBobToBrl
          })
        }
      );


    const data =
      await response.json();


    if (!response.ok || !data.ok) {

      throw new Error(
        data.error ||
        "Não foi possível salvar."
      );
    }


    showAdminMessage(
      "✅ Todas as cotações foram atualizadas com sucesso.",
      true
    );


    await loadQuotes();


  } catch (error) {

    console.error(
      "Erro ao salvar:",
      error
    );


    showAdminMessage(
      error.message ||
      "Erro ao salvar as cotações."
    );


  } finally {

    if (saveBtn) {
      saveBtn.disabled = false;

      saveBtn.textContent =
        "SALVAR TODAS AS COTAÇÕES";
    }
  }
}


// ======================================
// CARREGAR USUÁRIOS
// ======================================

async function loadUsers() {

  if (!usersList) return;


  usersList.innerHTML =
    '<div class="status">Carregando usuários...</div>';


  try {

    const response =
      await fetch(
        "/api/admin/users",
        {
          cache: "no-store",

          headers: {
            Authorization:
              "Bearer " + adminToken
          }
        }
      );


    const data =
      await response.json();


    if (!response.ok || !data.ok) {

      throw new Error(
        data.error ||
        "Não foi possível carregar os usuários."
      );
    }


    const users =
      Array.isArray(data.users)
        ? data.users
        : [];


    renderUsers(users);


  } catch (error) {

    console.error(
      "Erro ao carregar usuários:",
      error
    );


    usersList.innerHTML =
      `<div class="users-empty">
        ${escapeHtml(
          error.message ||
          "Erro ao carregar usuários."
        )}
      </div>`;
  }
}


// ======================================
// MOSTRAR USUÁRIOS
// ======================================

function renderUsers(users) {

  if (!usersList) return;


  if (!users.length) {

    usersList.innerHTML =
      '<div class="users-empty">Nenhum usuário cadastrado.</div>';

    return;
  }


  usersList.innerHTML = "";


  users.forEach((user) => {

    const card =
      document.createElement("div");


    card.className =
      "user-card";


    const nome =
      user.nome ||
      "Usuário";


    const tipo =
      user.tipo === "cambista"
        ? "cambista"
        : "cliente";


    card.innerHTML = `

      <div class="user-name">
        ${escapeHtml(nome)}
      </div>

      <div class="user-info">
        Tipo atual:
      </div>

      <div class="user-type">
        ${escapeHtml(tipo)}
      </div>

      <button
        class="user-action ${
          tipo === "cambista"
            ? "cambista"
            : "client"
        }"
        type="button"
      >

        ${
          tipo === "cambista"
            ? "Tornar cliente"
            : "Tornar cambista"
        }

      </button>

    `;


    const button =
      card.querySelector(
        ".user-action"
      );


    button?.addEventListener(
      "click",
      async () => {

        const newType =
          tipo === "cambista"
            ? "cliente"
            : "cambista";


        await changeUserType(
          user.id,
          newType,
          button
        );
      }
    );


    usersList.appendChild(card);
  });
}


// ======================================
// ALTERAR CLIENTE / CAMBISTA
// ======================================

async function changeUserType(
  userId,
  newType,
  button
) {

  if (!userId) return;


  const originalText =
    button?.textContent || "";


  if (button) {
    button.disabled = true;
    button.textContent = "SALVANDO...";
  }


  try {

    const response =
      await fetch(
        "/api/admin/users/" +
        encodeURIComponent(userId) +
        "/type",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              "Bearer " + adminToken
          },

          body: JSON.stringify({
            tipo: newType
          })
        }
      );


    const data =
      await response.json();


    if (!response.ok || !data.ok) {

      throw new Error(
        data.error ||
        "Não foi possível alterar o usuário."
      );
    }


    if (newType === "cambista") {

      showAdminMessage(
        "✅ Usuário alterado para CAMBISTA.",
        true
      );

    } else {

      showAdminMessage(
        "✅ Usuário alterado para CLIENTE.",
        true
      );
    }


    await loadUsers();


  } catch (error) {

    console.error(
      "Erro ao alterar usuário:",
      error
    );


    showAdminMessage(
      error.message ||
      "Erro ao alterar o usuário."
    );


    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}


// ======================================
// LOGOUT
// ======================================

async function logoutAdmin() {

  try {

    if (adminToken) {

      await fetch(
        "/api/admin/logout",
        {
          method: "POST",

          headers: {
            Authorization:
              "Bearer " + adminToken
          }
        }
      );
    }

  } catch (error) {

    console.error(
      "Erro no logout:",
      error
    );

  } finally {

    sessionStorage.removeItem(
      "adminToken"
    );


    adminToken = "";


    if (passwordInput) {
      passwordInput.value = "";
    }


    showLogin();


    showLoginMessage("");
    showAdminMessage("");
  }
}


// ======================================
// PROTEGER TEXTO
// ======================================

function escapeHtml(value) {

  return String(value ?? "")

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );
}


// ======================================
// EVENTOS
// ======================================

if (loginBtn) {

  loginBtn.addEventListener(
    "click",
    loginAdmin
  );
}


if (passwordInput) {

  passwordInput.addEventListener(
    "keydown",
    (event) => {

      if (event.key === "Enter") {
        loginAdmin();
      }
    }
  );
}


if (saveBtn) {

  saveBtn.addEventListener(
    "click",
    saveQuotes
  );
}


if (logoutBtn) {

  logoutBtn.addEventListener(
    "click",
    logoutAdmin
  );
}


// ======================================
// INICIAR
// ======================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    if (adminToken) {
      loadPanel();
    } else {
      showLogin();
    }

  }
);
