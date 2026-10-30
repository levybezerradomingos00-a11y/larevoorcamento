# LAREVO HOME — Montador de propostas

Proposta comercial do **Pacote Construtora**, em três páginas, preservando o visual aprovado. Edite o nome do cliente, a iniciação da parceria e a configuração por casa; os valores e o total da primeira casa são atualizados automaticamente.

## Usar

1. Preencha os três campos do topo.
2. Use valores como `3.000,00`, `3000` ou `3000,50`.
3. Clique em **Baixar PDF**. O arquivo é gerado diretamente, com o nome do cliente e três páginas A4 na horizontal.

O botão não abre a janela de impressão. A barra de edição não aparece no PDF. A geração acontece no próprio navegador, sem enviar os dados do cliente a uma API.

## Executar localmente

Requer Node.js 20 ou superior:

```sh
npm ci
npm start
```

Abra `http://127.0.0.1:4173` no navegador. Use um servidor HTTP para revisar e baixar o PDF; abrir o HTML com duplo clique não é o fluxo suportado.

## Hospedar

O site é estático e não exige servidor Node em produção, banco de dados ou processo de build. Publique estes arquivos, mantendo os caminhos relativos:

```text
index.html
styles.css
app.js
vendor/
```

As bibliotecas e suas licenças estão incluídas em `vendor/`. Não há carregamento de bibliotecas por CDN durante o uso. Em GitHub Pages, pode-se servir a raiz da branch `main`; a configuração da hospedagem fica separada do código.

## PDF

O download usa html2canvas e jsPDF locais. Cada página é capturada separadamente com o mesmo CSS de impressão e inserida em A4 horizontal, evitando cortes entre páginas. A resolução de captura é 240 dpi. O conteúdo visual é rasterizado: o texto do PDF baixado não é selecionável. O layout não depende do tamanho da tela, inclusive ao baixar pelo celular.

Entradas inválidas impedem a geração. O botão mostra o andamento, bloqueia alterações enquanto gera o arquivo e permite tentar novamente se houver falha.

## Desenvolvimento e testes

```sh
npm ci
npx playwright install chromium
npm test
```

No Windows, para testar com o Microsoft Edge já instalado:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm test
```

Os testes cobrem atualização de todos os nomes/valores, centavos, valores zerados, entradas inválidas, paginação e rodapés, download real de três páginas, celular e tratamento de falha nas bibliotecas.

- `index.html`: conteúdo da proposta e campos de edição.
- `styles.css`: visual, responsividade e regras de impressão.
- `app.js`: valores, validação e download de PDF.
- `scripts/vendor.mjs`: copia as versões fixadas das bibliotecas para `vendor/`.
- `scripts/serve.mjs`: servidor local de revisão.
- `tests/`: testes de ponta a ponta.

Referências: [html2canvas](https://html2canvas.hertzen.com/configuration), [jsPDF](https://github.com/parallax/jsPDF).
