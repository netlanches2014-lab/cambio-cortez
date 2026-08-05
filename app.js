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

  $("crossBuy").textContent =
    data.cross.brlToBobBuy.toLocaleString("pt-BR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }) + " BOB";

  $("crossSell").textContent =
    data.cross.brlToBobSell.toLocaleString("pt-BR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }) + " BOB";

  const updatedDate = new Date(data.updatedAt);

  $("updatedAt").textContent =
    "Última atualização: " +
    updatedDate.toLocaleString("pt-BR");

  $("methodology").textContent =
    `${data.source} • ${data.methodology}`;

  convert();
}

function currencyToUSDT(currency) {
  if (currency === "USDT") {
    return 1;
  }

  const quote = state.data?.quotes?.[currency];

  if (!quote) {
    return null;
  }

  const averagePrice =
    (Number(quote.buy) + Number(quote.sell)) / 2;

  return 1 / averagePrice;
}

function convert() {
  if (!state.data?.quotes) {
    return;
  }

  const amount = Number($("amount").value || 0);
  const fromCurrency = $("fromCurrency").value;
  const toCurrency = $("toCurrency").value;

  const fromRate = currencyToUSDT(fromCurrency);
  const toRate = currencyToUSDT(toCurrency);

  if (!fromRate || !toRate) {
    $("conversionResult").textContent = "—";
    return;
  }

  const convertedValue =
    (amount * fromRate) / toRate;

  $("conversionResult").textContent =
    formatCurrency(convertedValue, toCurrency);

  const unitValue = fromRate / toRate;

  $("conversionRate").textContent =
    `1 ${fromCurrency} ≈ ` +
    formatCurrency(unitValue, toCurrency);
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
