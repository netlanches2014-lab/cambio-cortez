let token = sessionStorage.getItem("adminToken") || "";

const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");
const loginMsg = document.getElementById("loginMsg");
const adminMsg = document.getElementById("adminMsg");

// ===============================
// LOGIN DO ADMINISTRADOR
// ===============================

async function login() {
  loginMsg.textContent = "Entrando...";

  try {
    const password = document.getElementById("password").value;

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Não foi possível entrar."
      );
    }

    token = data.token;

    sessionStorage.setItem(
      "adminToken",
      token
    );

    await loadQuotes();

  } catch (error) {
    loginMsg.textContent =
      error.message || "Erro ao entrar.";
  }
}


// ===============================
// CARREGAR COTAÇÕES
// ===============================

async function loadQuotes() {
  try {
    const response = await fetch(
      "/api/admin/quotes",
      {
        headers: {
          Authorization: "Bearer " + token
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Sessão inválida."
      );
    }

    const quote = data.data || {};

    // TAXAS CLIENTE
    document.getElementById(
      "clienteBrlToBob"
    ).value =
      quote.cliente_brl_to_bob ??
      quote.brl_to_bob ??
      "";

    document.getElementById(
      "clienteBobToBrl"
    ).value =
      quote.cliente_bob_to_brl ??
      quote.bob_to_brl ??
      "";

    // TAXAS CAMBISTA
    document.getElementById(
      "cambistaBrlToBob"
    ).value =
      quote.cambista_brl_to_bob ??
      quote.brl_to_bob ??
      "";

    document.getElementById(
      "cambistaBobToBrl"
    ).value =
      quote.cambista_bob_to_brl ??
      quote.bob_to_brl ??
      "";

    loginBox.classList.add("hidden");
    adminBox.classList.remove("hidden");

    loginMsg.textContent = "";
    adminMsg.textContent = "";

  } catch (error) {

    sessionStorage.removeItem(
      "adminToken"
    );

    token = "";

    loginBox.classList.remove("hidden");
    adminBox.classList.add("hidden");

    loginMsg.textContent =
      error.message ||
      "Erro ao carregar painel.";
  }
}


// ===============================
// SALVAR AS 4 COTAÇÕES
// ===============================

async function saveQuotes() {

  adminMsg.textContent = "Salvando...";

  try {

    const clienteBrlToBob = Number(
      document.getElementById(
        "clienteBrlToBob"
      ).value
    );

    const clienteBobToBrl = Number(
      document.getElementById(
        "clienteBobToBrl"
      ).value
    );

    const cambistaBrlToBob = Number(
      document.getElementById(
        "cambistaBrlToBob"
      ).value
    );

    const cambistaBobToBrl = Number(
      document.getElementById(
        "cambistaBobToBrl"
      ).value
    );


    // CLIENTE - REAL PARA BOLIVIANO

    if (
      !Number.isFinite(clienteBrlToBob) ||
      clienteBrlToBob <= 0
    ) {
      throw new Error(
        "Digite uma taxa válida de CLIENTE para REAL → BOLIVIANO."
      );
    }


    // CLIENTE - BOLIVIANO PARA REAL

    if (
      !Number.isFinite(clienteBobToBrl) ||
      clienteBobToBrl <= 0
    ) {
      throw new Error(
        "Digite uma taxa válida de CLIENTE para BOLIVIANO → REAL."
      );
    }


    // CAMBISTA - REAL PARA BOLIVIANO

    if (
      !Number.isFinite(cambistaBrlToBob) ||
      cambistaBrlToBob <= 0
    ) {
      throw new Error(
        "Digite uma taxa válida de CAMBISTA para REAL → BOLIVIANO."
      );
    }


    // CAMBISTA - BOLIVIANO PARA REAL

    if (
      !Number.isFinite(cambistaBobToBrl) ||
      cambistaBobToBrl <= 0
    ) {
      throw new Error(
        "Digite uma taxa válida de CAMBISTA para BOLIVIANO → REAL."
      );
    }


    const response = await fetch(
      "/api/admin/quotes",
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },

        body: JSON.stringify({
          clienteBrlToBob,
          clienteBobToBrl,
          cambistaBrlToBob,
          cambistaBobToBrl
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "Não foi possível salvar."
      );
    }

    adminMsg.textContent =
      "✅ Cotações atualizadas com sucesso.";

  } catch (error) {

    adminMsg.textContent =
      error.message ||
      "Erro ao salvar.";
  }
}


// ===============================
// SAIR DO PAINEL
// ===============================

async function logout() {

  try {

    await fetch(
      "/api/admin/logout",
      {
        method: "POST",
        headers: {
          Authorization:
            "Bearer " + token
        }
      }
    );

  } catch (error) {

    console.error(error);

  }

  sessionStorage.removeItem(
    "adminToken"
  );

  token = "";

  location.reload();
}


// ===============================
// BOTÕES
// ===============================

document
  .getElementById("loginBtn")
  .addEventListener(
    "click",
    login
  );


document
  .getElementById("saveBtn")
  .addEventListener(
    "click",
    saveQuotes
  );


document
  .getElementById("logoutBtn")
  .addEventListener(
    "click",
    logout
  );


// ENTER NA SENHA

document
  .getElementById("password")
  .addEventListener(
    "keydown",
    (event) => {

      if (event.key === "Enter") {
        login();
      }

    }
  );


// ===============================
// ABRIR PAINEL SE JÁ ESTIVER LOGADO
// ===============================

if (token) {
  loadQuotes();
}
