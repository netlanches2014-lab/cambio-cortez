const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Arquivos estáticos na raiz do projeto
app.use(express.static(__dirname));

// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Câmbio Cortez rodando na porta ${PORT}`);
});
