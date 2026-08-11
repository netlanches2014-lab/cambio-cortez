let token =
  sessionStorage.getItem("adminToken") || "";

const loginBox =
  document.getElementById("loginBox");

const adminBox =
  document.getElementById("adminBox");

const loginMsg =
  document.getElementById("loginMsg");

const adminMsg =
  document.getElementById("adminMsg");

const usersList =
  document.getElementById("usersList");


// ======================================
// LOGIN ADMIN
// ======================================

async function login() {

  loginMsg.textContent =
    "Entrando...";

  try {

    const password =
      document
        .getElementById("password")
        .value;

    const response =
      await fetch(
        "/api/admin/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
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

    token =
      data.token;

    sessionStorage.setItem(
      "adminToken",
      token
    );

    await loadPanel();

  } catch (error) {

    loginMsg.textContent =
      error.message ||
      "Erro ao entrar.";
  }
}


// ======================================
// CARREGAR PAINEL
// ======================================

async function loadPanel() {

  await loadQuotes();

  await loadUsers();
}


// ======================================
// CARREGAR COTAÇÕES
// ======================================

async function loadQuotes() {

  try {

    const response =
      await fetch(
        "/api/admin/quotes",
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
        data.error ||
        "Sessão inválida."
      );
    }

    const quote =
      data.data || {};


    document
      .getElementById(
        "clienteBrlToBob"
      )
      .value =
        quote.cliente_brl_to_bob ??
        quote.brl_to_bob ??
        "";


    document
      .getElementById(
        "clienteBobToBrl"
      )
      .value =
        quote.cliente_bob_to_brl ??
        quote.bob_to_brl ??
        "";


    document
      .getElementById(
        "cambistaBrlToBob"
      )
      .value =
        quote.cambista_brl_to_bob ??
        quote.brl_to_bob ??
        "";


    document
      .getElementById(
        "cambistaBobToBrl"
      )
      .value =
        quote.cambista_bob_to_brl ??
        quote.bob_to_brl ??
        "";


    loginBox.classList.add(
      "hidden"
    );

    adminBox.classList.remove(
      "hidden"
    );

    loginMsg.textContent = "";

    adminMsg.textContent = "";

  } catch (error) {

    sessionStorage.removeItem(
      "adminToken"
    );

    token = "";

    loginBox.classList.remove(
      "hidden"
    );

    adminBox.classList.add(
      "hidden"
    );

    loginMsg.textContent =
      error.message ||
      "Erro ao carregar painel.";
  }
}


// ======================================
// SALVAR COTAÇÕES
// ======================================

async function saveQuotes() {

  adminMsg.textContent =
    "Salvando...";

  try {

    const clienteBrlToBob =
      Number(
        document
          .getElementById(
            "clienteBrlToBob"
          )
          .value
      );


    const clienteBobToBrl =
      Number(
        document
          .getElementById(
            "clienteBobToBrl"
          )
          .value
      );


    const cambistaBrlToBob =
      Number(
        document
          .getElementById(
            "cambistaBrlToBob"
          )
          .value
      );


    const cambistaBobToBrl =
      Number(
        document
          .getElementById(
            "cambistaBobToBrl"
          )
          .value
      );


    if (
      !Number.isFinite(
        clienteBrlToBob
      ) ||
      clienteBrlToBob <= 0
    ) {

      throw new Error(
        "Digite uma taxa válida de CLIENTE para REAL → BOLIVIANO."
      );
    }


    if (
      !Number.isFinite(
        clienteBobToBrl
      ) ||
      clienteBobToBrl <= 0
    ) {

      throw new Error(
        "Digite uma taxa válida de CLIENTE para BOLIVIANO → REAL."
      );
    }


    if (
      !Number.isFinite(
        cambistaBrlToBob
      ) ||
      cambistaBrlToBob <= 0
    ) {

      throw new Error(
        "Digite uma taxa válida de CAMBISTA para REAL → BOLIVIANO."
      );
    }


    if (
      !Number.isFinite(
        cambistaBobToBrl
      ) ||
      cambistaBobToBrl <= 0
    ) {

      throw new Error(
        "Digite uma taxa válida de CAMBISTA para BOLIVIANO → REAL."
      );
    }


    const response =
      await fetch(
        "/api/admin/quotes",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              "Bearer " + token
          },

          body:
            JSON.stringify({
              clienteBrlToBob,
              clienteBobToBrl,
              cambistaBrlToBob,
              cambistaBobToBrl
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


// ======================================
// CARREGAR USUÁRIOS
// ======================================

async function loadUsers() {

  if (!usersList) {
    return;
  }

  usersList.innerHTML =
    '<div class="status">Carregando usuários...</div>';

  try {

    const response =
      await fetch(
        "/api/admin/users",
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
        data.error ||
        "Não foi possível carregar os usuários."
      );
    }


    const users =
      Array.isArray(data.users)
        ? data.users
        : [];


    if (
      users.length === 0
    ) {

      usersList.innerHTML =
        '<div class="users-empty">Nenhum usuário cadastrado.</div>';

      return;
    }


    usersList.innerHTML = "";


    users.forEach(
      (user) => {

        const card =
          document.createElement(
            "div"
          );

        card.className =
          "user-card";


        const nome =
          user.nome ||
          "Usuário sem nome";


        const tipo =
          user.tipo ===
          "cambista"
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
            ${tipo}
          </div>

          <button
            class="user-action ${
              tipo === "cambista"
                ? "cambista"
                : "client"
            }"
            data-user-id="${escapeAttribute(
              user.id
            )}"
            data-user-type="${tipo}"
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


        button.addEventListener(
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


        usersList.appendChild(
          card
        );
      }
    );

  } catch (error) {

    usersList.innerHTML =
      `<div class="users-empty">
        ${
          escapeHtml(
            error.message ||
            "Erro ao carregar usuários."
          )
        }
      </div>`;
  }
}


// ======================================
// ALTERAR CLIENTE / CAMBISTA
// ======================================

async function changeUserType(
  userId,
  newType,
  button
) {

  const originalText =
    button.textContent;

  button.disabled = true;

  button.textContent =
    "Salvando...";


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
              "Bearer " + token
          },

          body:
            JSON.stringify({
              tipo: newType
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
        "Não foi possível alterar o usuário."
      );
    }


    adminMsg.textContent =
      newType === "cambista"
        ? "✅ Usuário transformado em CAMBISTA."
        : "✅ Usuário transformado em CLIENTE.";


    await loadUsers();

  } catch (error) {

    adminMsg.textContent =
      error.message ||
      "Erro ao alterar usuário.";

    button.disabled = false;

    button.textContent =
      originalText;
  }
}


// ======================================
// PROTEÇÃO PARA TEXTO HTML
// ======================================

function escapeHtml(value) {

  return String(value)
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


function escapeAttribute(value) {

  return escapeHtml(
    String(value)
  );
}


// ======================================
// LOGOUT
// ======================================

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


// ======================================
// BOTÕES
// ======================================

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


// ======================================
// ENTER NA SENHA
// ======================================

document
  .getElementById("password")
  .addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Enter"
      ) {

        login();
      }
    }
  );


// ======================================
// ABRIR PAINEL SE JÁ ESTIVER LOGADO
// ======================================

if (token) {

  loadPanel();
}
