let token = sessionStorage.getItem("adminToken") || "";

const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");
const loginMsg = document.getElementById("loginMsg");
const adminMsg = document.getElementById("adminMsg");

async function login() {
  loginMsg.textContent = "Entrando...";

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: document.getElementById("password").value,
      }),
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
    loginMsg.textContent = error.message;
  }
}

async function loadQuotes() {
  try {
    const response = await fetch(
      "/api/admin/quotes",
      {
        headers: {
          Authorization: "Bearer " + token,
        },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Sessão inválida."
      );
    }

    const quote =
      data.data ||
      data.quote ||
      data.quotes ||
      data;

    document.getElementById(
      "brlToBob"
    ).value =
      quote.brl_to_bob ??
      quote.brlToBob ??
      "";

    document.getElementById(
      "bobToBrl"
    ).value =
      quote.bob_to_brl ??
      quote.bobToBrl ??
      "";

    loginBox.classList.add("hidden");
    adminBox.classList.remove("hidden");

    adminMsg.textContent = "";
  } catch (error) {
    sessionStorage.removeItem("adminToken");

    token = "";

    loginBox.classList.remove("hidden");
    adminBox.classList.add("hidden");

    loginMsg.textContent = error.message;
  }
}

async function saveQuotes() {
  adminMsg.textContent = "Salvando...";

  try {
    const brlToBob = Number(
      document.getElementById("brlToBob").value
    );

    const bobToBrl = Number(
      document.getElementById("bobToBrl").value
    );

    if (
      !Number.isFinite(brlToBob) ||
      brlToBob <= 0
    ) {
      throw new Error(
        "Informe uma cotação válida de REAL para BOLIVIANO."
      );
    }

    if (
      !Number.isFinite(bobToBrl) ||
      bobToBrl <= 0
    ) {
      throw new Error(
        "Informe uma cotação válida de BOLIVIANO para REAL."
      );
    }

    const response = await fetch(
      "/api/admin/quotes",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          brlToBob,
          bobToBrl,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "Não foi possível salvar as cotações."
      );
    }

    adminMsg.textContent =
      "Cotações atualizadas com sucesso.";
  } catch (error) {
    adminMsg.textContent = error.message;
  }
}

async function logout() {
  try {
    await fetch(
      "/api/admin/logout",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
        },
      }
    );
  } catch {}

  sessionStorage.removeItem("adminToken");

  token = "";

  location.reload();
}

document
  .getElementById("loginBtn")
  .addEventListener("click", login);

document
  .getElementById("saveBtn")
  .addEventListener("click", saveQuotes);

document
