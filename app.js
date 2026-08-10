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

  if (currency === "BRL") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  return (
    value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }) + " Bs"
  );
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
    setStatus("online", "Online");
  } catch (error) {
    setStatus("error", "Indisponível");

    showError(
      "Não foi possível carregar as cotações. " +
        error.message
    );
  } finally {
    $("refreshButton").classList.remove("rotating");
  }
}

function getRates() {
  if (!state.data) {
    return null;
  }

  const source =
    state.data.quote ||
    state.data.quotes ||
    state.data.data ||
    state.data;

  const brlToBob = Number(
    source.brl_to_bob ??
    source.brlToBob ??
    state.data.brl_to_bob ??
    state.data.brlToBob
  );

  const bobToBrl = Number(
    source.bob_to_brl ??
    source.bobToBrl ??
    state.data.bob_to_brl ??
    state.data.bobToBrl
  );

  if (
    !Number.isFinite(brlToBob) ||
    !Number.isFinite(bobToBrl)
  ) {
    return null;
  }

  return {
    brlToBob,
    bobToBrl,
  };
}

function renderQuotes() {
  const rates = getRates();

  if (!rates) {
    showError(
      "As cotações de Real e Boliviano ainda não foram definidas."
    );

    return;
  }

  $("crossBuy").textContent =
  "1 REAL = " +
  rates.brlToBob.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }) +
  " Bs";

  $("crossSell").textContent =
  rates.bobToBrl.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }) +
  " Bs = 1 REAL";

  const updatedAt =
    state.data.updatedAt ||
    state.data.updated_at ||
    state.data.quote?.updated_at ||
    state.data.quotes?.updated_at;

  if (updatedAt) {
    const date = new Date(updatedAt);

    $("updatedAt").textContent =
      "Última atualização: " +
      date.toLocaleString("pt-BR");
  } else {
    $("updatedAt").textContent =
      "Última atualização: agora";
  }

  $("methodology").textContent =
    "Cotação manual • Câmbio Cortez";

  convert();
}

function convertCurrency(
  amount,
  fromCurrency,
  toCurrency
) {
  
      const rates = getRates();

  if (!rates) {
    return null;
  }

  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return null;
  }

  if (fromCurrency === toCurrency) {
    return {
      value,
      rateText: `1 ${fromCurrency} = 1 ${toCurrency}`,
    };
  }

  if (fromCurrency === "BRL" && toCurrency === "BOB") {
    return {
      value: value * rates.brlToBob,
      rateText: `1 BRL = ${rates.brlToBob.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })} BOB`,
    };
  }

  if (fromCurrency === "BOB" && toCurrency === "BRL") {
    return {
      value: value / rates.bobToBrl,
      rateText: `${rates.bobToBrl.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })} BOB = 1 BRL`,
    };
  }

  return null;
}

function convert() {
  const amount = Number($("amount").value);
  const fromCurrency = $("fromCurrency").value;
  const toCurrency = $("toCurrency").value;

  const result = convertCurrency(
    amount,
    fromCurrency,
    toCurrency
  );

  if (!result) {
    $("conversionResult").textContent = "—";
    $("conversionRate").textContent = "Aguardando cotação";
    return;
  }

  $("conversionResult").textContent =
    formatCurrency(result.value, toCurrency);

  $("conversionRate").textContent = result.rateText;
}

$("amount").addEventListener("input", convert);

$("fromCurrency").addEventListener("change", () => {
  if ($("fromCurrency").value === "BRL") {
    $("toCurrency").value = "BOB";
  } else {
    $("toCurrency").value = "BRL";
  }

  convert();
});

$("toCurrency").addEventListener("change", convert);

$("swapButton").addEventListener("click", () => {
  const from = $("fromCurrency").value;
  const to = $("toCurrency").value;

  $("fromCurrency").value = to;
  $("toCurrency").value = from;

  convert();
});

$("refreshButton").addEventListener("click", loadQuotes);

$("accessButton").addEventListener("click", () => {
  $("accessScreen").classList.add("hidden");
  $("app").classList.remove("hidden");

  loadQuotes();
});
$("whatsappButton").addEventListener("click", () => {
  const amount = Number($("amount").value);
  const fromCurrency = $("fromCurrency").value;
  const toCurrency = $("toCurrency").value;

  const result = convertCurrency(
    amount,
    fromCurrency,
    toCurrency
  );

  if (!result || !Number.isFinite(amount) || amount <= 0) {
    alert("Digite um valor válido para fazer o câmbio.");
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

  const agora = new Date();

  const dataHora = agora.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

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

  const mensagem =
`⚔️ CÂMBIO CORTEZ

📅 Data e horário:
${dataHora}

🔄 Operação:
${operacao}

💱 Cotação:
${result.rateText}

🇧🇷 Valor em Real:
${valorRealFormatado}

🇧🇴 Valor em Bolivianos:
${valorBolivianoFormatado}
⏱️ Validade da cotação:
10 minutos
Gostaria de finalizar este câmbio.`;

  const whatsappUrl =
    "https://wa.me/?text=" +
    encodeURIComponent(mensagem);

  window.open(whatsappUrl, "_blank");
});
$("copyQuoteButton").addEventListener("click", async () => {
  const amount = Number($("amount").value);
  const fromCurrency = $("fromCurrency").value;
  const toCurrency = $("toCurrency").value;

  const result = convertCurrency(
    amount,
    fromCurrency,
    toCurrency
  );

  if (!result || !Number.isFinite(amount) || amount <= 0) {
    alert("Digite um valor válido para copiar a cotação.");
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

  const valorRealFormatado = valorReal.toLocaleString("pt-BR", {
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

  const agora = new Date();

  const dataHora = agora.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const mensagem = `⚔️ CÂMBIO CORTEZ

📅 Data e horário:
${dataHora}

🔄 Operação:
${operacao}

💱 Cotação:
${result.rateText}

🇧🇷 Valor em Real:
${valorRealFormatado}

🇧🇴 Valor em Bolivianos:
${valorBolivianoFormatado}

⏱️ Validade da cotação:
10 minutos`;

  await navigator.clipboard.writeText(mensagem);

  const botao = $("copyQuoteButton");
  const textoOriginal = botao.innerHTML;

  botao.innerHTML = "✓ COTAÇÃO COPIADA";

  setTimeout(() => {
    botao.innerHTML = textoOriginal;
  }, 2000);
});
loadQuotes();
