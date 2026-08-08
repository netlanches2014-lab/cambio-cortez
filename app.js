const state = {
  data: null,
  timer: null,
};

const $ = (id) => document.getElementById(id);

function setStatus(type, text) {
  const status = $("status");

  status.className = `status ${type}`;
  status.textContent = `● ${text}`;
}

function formatCurrency(value, currency) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (currency === "USDT") {
    return (
      value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }) + " USDT"
    );
  }

  const locale = currency === "BRL" ? "pt-BR" : "es-BO";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function showError(message) {
  const errorBox = $("errorMessage");

  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  $("errorMessage").classList.add("hidden");
}

async function loadQuotes() {
  $("refreshButton").classList.add("rotating");
  setStatus("loading", "Atualizando");
  hideError();

  try {
    const response = await fetch("/api/quotes", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Não foi possível carregar as cotações."
      );
    }

    state.data = data;

    renderQuotes();

    if (data.stale) {
      setStatus("error", "Última cotação");

      showError(
        "A fonte está temporariamente indisponível. " +
          "O painel está mostrando a última cotação salva."
      );
    } else {
      setStatus("online", "Online");
    }
  } catch (error) {
    setStatus("error", "Indisponível");

    showError(
      "Não foi possível consultar o mercado P2P. " +
        error.message
    );
  } finally {
    $("refreshButton").classList.remove("rotating");
  }
}

function renderQuotes() {
  const data = state.data;

  if (!data?.quotes) {
    return;
  }

  const brl = data.quotes.BRL;
  const bob = data.quotes.BOB;

  $("brlBuy").textContent = formatCurrency(
    brl.buy,
    "BRL"
  );

  $("brlSell").textContent = formatCurrency(
    brl.sell,
    "BRL"
  );

  $("bobBuy").textContent = formatCurrency(
    bob.buy,
    "BOB"
  );

  $("bobSell").textContent = formatCurrency(
    bob.sell,
    "BOB"
  );

  /*
    CRUZAMENTO BRL / BOB

    BRL -> BOB:
    BRL compra USDT pela taxa BRL sell.
    Depois USDT é vendido por BOB pela taxa BOB sell.

    BOB -> BRL:
    BOB compra USDT pela taxa BOB buy.
    Depois USDT é vendido por BRL pela taxa BRL buy.
  */

  const crossBrlToBob =
    Number(bob.sell) / Number(brl.sell);

  const crossBobToBrl =
    Number(brl.buy) / Number(bob.buy);

  $("crossBuy").textContent =
    crossBrlToBob.toLocaleString("pt-BR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }) + " BOB";

  $("crossSell").textContent =
    crossBobToBrl.toLocaleString("pt-BR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }) + " BRL";

  const updatedDate = new Date(data.updatedAt);

  $("updatedAt").textContent =
    "Última atualização: " +
    updatedDate.toLocaleString("pt-BR");

  $("methodology").textContent =
    `${data.source} • ${data.methodology}`;

  convert();
}

function convertCurrency(amount, fromCurrency, toCurrency) {
  if (!state.data?.quotes) {
    return null;
  }

  if (fromCurrency === toCurrency) {
    return amount;
  }

  const brl = state.data.quotes.BRL;
  const bob = state.data.quotes.BOB;

  /*
    REGRAS DA OPERAÇÃO

    USDT -> BRL
    1 USDT = BRL buy

    BRL -> USDT
    BRL sell = 1 USDT

    USDT -> BOB
    1 USDT = BOB sell

    BOB -> USDT
    BOB buy = 1 USDT
  */

  if (
    fromCurrency === "USDT" &&
    toCurrency === "BRL"
  ) {
    return amount * Number(brl.buy);
  }

  if (
    fromCurrency === "BRL" &&
    toCurrency === "USDT"
  ) {
    return amount / Number(brl.sell);
  }

  if (
    fromCurrency === "USDT" &&
    toCurrency === "BOB"
  ) {
    return amount * Number(bob.sell);
  }

  if (
    fromCurrency === "BOB" &&
    toCurrency === "USDT"
  ) {
    return amount / Number(bob.buy);
  }

  /*
    BRL -> BOB
    Primeiro BRL -> USDT.
    Depois USDT -> BOB.
  */

  if (
    fromCurrency === "BRL" &&
    toCurrency === "BOB"
  ) {
    const usdt =
      amount / Number(brl.sell);

    return usdt * Number(bob.sell);
  }

  /*
    BOB -> BRL
    Primeiro BOB -> USDT.
    Depois USDT -> BRL.
  */

  if (
    fromCurrency === "BOB" &&
    toCurrency === "BRL"
  ) {
    const usdt =
      amount / Number(bob.buy);

    return usdt * Number(brl.buy);
  }

  return null;
}

function convert() {
  if (!state.data?.quotes) {
    return;
  }

  const amount =
    Number($("amount").value || 0);

  const fromCurrency =
    $("fromCurrency").value;

  const toCurrency =
    $("toCurrency").value;

  const convertedValue =
    convertCurrency(
      amount,
      fromCurrency,
      toCurrency
    );

  if (!Number.isFinite(convertedValue)) {
    $("conversionResult").textContent = "—";
    $("conversionRate").textContent = "—";
    return;
  }

  $("conversionResult").textContent =
    formatCurrency(
      convertedValue,
      toCurrency
    );

  const unitValue =
    convertCurrency(
      1,
      fromCurrency,
      toCurrency
    );

  $("conversionRate").textContent =
    `1 ${fromCurrency} = ${formatCurrency(
      unitValue,
      toCurrency
    )}`;
}

function swapCurrencies() {
  const from = $("fromCurrency").value;
  const to = $("toCurrency").value;

  $("fromCurrency").value = to;
  $("toCurrency").value = from;

  convert();
}

function openApp() {
  $("accessScreen").classList.add("hidden");
  $("app").classList.remove("hidden");

  loadQuotes();

  if (state.timer) {
    clearInterval(state.timer);
  }

  state.timer = setInterval(
    loadQuotes,
    30000
  );
}

$("accessButton").addEventListener(
  "click",
  openApp
);

$("refreshButton").addEventListener(
  "click",
  loadQuotes
);

$("swapButton").addEventListener(
  "click",
  swapCurrencies
);

$("amount").addEventListener(
  "input",
  convert
);

$("fromCurrency").addEventListener(
  "change",
  convert
);

$("toCurrency").addEventListener(
  "change",
  convert
);
