const state = { data: null, timer: null };

const $ = (id) => document.getElementById(id);
const money = (value, currency) => {
  if (!Number.isFinite(value)) return "—";
  if (currency === "USDT") return `${value.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:4})} USDT`;
  return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "es-BO", {
    style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4
  }).format(value);
};

function setStatus(type, text) {
  $("status").className = `status ${type}`;
  $("status").textContent = `● ${text}`;
}

async function loadQuotes() {
  $("refreshButton").classList.add("rotating");
  setStatus("loading", "Atualizando");
  try {
    const amount = Number($("amount").value || 0);
    const response = await fetch(`/api/quotes?amount=${encodeURIComponent(amount)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Falha na consulta");
    state.data = data;
    renderQuotes();
    setStatus(data.stale ? "error" : "online", data.stale ? "Dados anteriores" : "Online");
  } catch (error) {
    setStatus("error", "Indisponível");
    $("updatedAt").textContent = `Erro: ${error.message}`;
  } finally {
    $("refreshButton").classList.remove("rotating");
  }
}

function renderQuotes() {
  const q = state.data.quotes;
  $("brlBuy").textContent = money(q.BRL.buy, "BRL");
  $("brlSell").textContent = money(q.BRL.sell, "BRL");
  $("bobBuy").textContent = money(q.BOB.buy, "BOB");
  $("bobSell").textContent = money(q.BOB.sell, "BOB");
  $("crossBuy").textContent = `${state.data.cross.brlToBobBuy.toFixed(4)} BOB`;
  $("crossSell").textContent = `${state.data.cross.brlToBobSell.toFixed(4)} BOB`;
  $("updatedAt").textContent = `Atualizado: ${new Date(state.data.updatedAt).toLocaleString("pt-BR")}`;
  $("methodology").textContent = state.data.methodology;
  convert();
}

function rateToUSDT(currency) {
  const q = state.data?.quotes;
  if (!q) return null;
  if (currency === "USDT") return 1;
  // Para uma estimativa neutra no conversor, utiliza o ponto médio de compra/venda.
  return 1 / ((q[currency].buy + q[currency].sell) / 2);
}

function convert() {
  if (!state.data) return;
  const amount = Number($("amount").value || 0);
  const from = $("fromCurrency").value;
  const to = $("toCurrency").value;
  const fromRate = rateToUSDT(from);
  const toRate = rateToUSDT(to);
  const result = amount * fromRate / toRate;
  $("conversionResult").textContent = money(result, to);
  $("conversionRate").textContent = `Estimativa pelo ponto médio P2P • 1 ${from} ≈ ${money(fromRate / toRate, to)}`;
}

$("accessButton").addEventListener("click", () => {
  $("accessScreen").classList.add("hidden");
  $("app").classList.remove("hidden");
  loadQuotes();
  state.timer = setInterval(loadQuotes, 30000);
});
$("refreshButton").addEventListener("click", loadQuotes);
$("amount").addEventListener("input", convert);
$("amount").addEventListener("change", loadQuotes);
$("fromCurrency").addEventListener("change", convert);
$("toCurrency").addEventListener("change", convert);
$("swapButton").addEventListener("click", () => {
  const current = $("fromCurrency").value;
  $("fromCurrency").value = $("toCurrency").value;
  $("toCurrency").value = current;
  convert();
});
