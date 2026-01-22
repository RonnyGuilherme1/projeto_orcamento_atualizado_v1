# Refatoração de CSS (v8)

## O que mudou
- CSS do app foi separado por responsabilidade:
  - `static/css/(removido: estilos agora são por tela)`  -> shell (sidebar, topbar, responsividade do menu)
  - `static/css/(removido: estilos agora são por tela)`   -> componentes compartilhados (panel, field, control, botões)
  - `static/css/dashboard.css`  -> layout do Dashboard (trimestres + Resumo por Data)
  - `static/css/entries.css`    -> layout de Entradas (form + Receitas/Despesas lado a lado)
  - `static/css/upgrade.css`    -> tela de upgrade/planos dentro do app
- `static/css/style.css` foi removido porque misturava estilos antigos e causava conflitos de layout.

## Templates ajustados
- `templates/base_app.html`: agora aceita `page_css` para carregar CSS por página.
- `templates/index.html`: carrega `dashboard.css`.
- `templates/entries.html`: carrega `entries.css` e agrupa Receitas/Despesas em `.history-grid`.
- `templates/upgrade.html`: carrega `upgrade.css`.
- `templates/account.html`: carrega `account.css` apenas na conta.

## Observação
Se você tinha algum cache do navegador, faça hard refresh (Ctrl+Shift+R) após substituir os arquivos.
