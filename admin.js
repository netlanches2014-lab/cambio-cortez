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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: document.getElementById("password").value
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Não foi possível entrar.");
    }

    token = data.token;
    sessionStorage.setItem("adminToken", token);

    await loadQuotes();
  } catch (error) {
    loginMsg.textContent = error.message;
  }
}

async function loadQuotes() {
  try {
    const response = await fetch("/api/admin/quotes", {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Sessão inválida.");
    }

        document.getElementById("brlBuy").value = data.data.brl_buy;
    document.getElementById("brlSell").value = data.data.brl_sell;
    document.getElementById("bobBuy").value = data.data.bob_buy;
    document.getElementById("bobSell").value = data.data.bob_sell;

    loginBox.classList.add("hidden");
    adminBox.classList.remove("hidden");
  } catch (error) {
    sessionStorage.removeItem("adminToken");
    token = "";
    loginBox.classList.remove("hidden");
    adminBox.classList.add("hidden");
  }
}

async function saveQuotes() {
  adminMsg.textContent = "Salvando...";

  try {
    const response = await fetch("/api/admin/quotes", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        brlBuy: document.getElementById("brlBuy").value,
        brlSell: document.getElementById("brlSell").value,
        bobBuy: document.getElementById("bobBuy").value,
        bobSell: document.getElementById("bobSell").value
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Não foi possível salvar.");
    }

    adminMsg.textContent = "Cotações atualizadas com sucesso.";
  } catch (error) {
    adminMsg.textContent = error.message;
  }
}

async function logout() {
  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token
      }
    });
  } catch {}

  sessionStorage.removeItem("adminToken");
  token = "";
  location.reload();
}

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("saveBtn").addEventListener("click", saveQuotes);
document.getElementById("logoutBtn").addEventListener("click", logout);

document.getElementById("password").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    login();
  }
});

if (token) {
  loadQuotes();
}
