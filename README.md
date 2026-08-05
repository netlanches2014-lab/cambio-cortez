# Câmbio Cortez Web

Painel web leve para consultar referências de **USDT/BRL** e **USDT/BOB** no mercado P2P e calcular o cruzamento **BRL/BOB** por USDT.

## Requisitos

- Computador ou servidor com Node.js 18 ou superior
- Internet

## Rodar no computador

1. Extraia o ZIP.
2. Abra um terminal dentro da pasta.
3. Execute:

```bash
npm install
npm start
```

4. Abra no navegador:

```text
http://localhost:3000
```

Para abrir pelo celular na mesma rede Wi‑Fi, descubra o IP do computador e acesse:

```text
http://IP-DO-COMPUTADOR:3000
```

## Publicar na internet

Pode ser hospedado em serviços compatíveis com Node.js, como Render, Railway, Fly.io ou um VPS.

Comando de instalação:

```text
npm install
```

Comando inicial:

```text
npm start
```

Não é necessário configurar banco de dados.

## Como a cotação é calculada

- Consulta anúncios de USDT em BRL e BOB.
- Separa anúncios de compra e venda.
- Exige disponibilidade e taxa de conclusão mínima de 80%.
- Seleciona até 5 anúncios válidos.
- Usa a mediana para reduzir distorções causadas por um anúncio isolado.
- Atualiza automaticamente a cada 30 segundos.
- Mantém cache curto de 15 segundos para reduzir consultas repetidas.

## Atenção

A interface pública de anúncios P2P utilizada pelo site não aparece como um endpoint público estável na documentação oficial da Binance. Ela pode ser alterada, limitada ou bloqueada. O projeto mostra erro de fonte quando não consegue obter dados e mantém o último resultado em cache quando possível.

As cotações são apenas referências. Antes de negociar, confira preço, limite, disponibilidade e método de pagamento diretamente na plataforma.
