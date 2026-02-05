# LinkGestor — Controle Financeiro

Aplicação web (Flask) para **controle financeiro pessoal** com autenticação, planos por recursos (Basic/Plus/Pro) e relatórios premium (PDF/Excel).

## Principais recursos

- **Autenticação completa**: cadastro, login, logout e sessão segura
- **Verificação de e-mail** (com modo DEV para testes)
- **Entradas** (receitas/despesas): criar, editar, listar por mês, status (pago/não pago), categorias e método (quando liberado no plano)
- **Regras & Automação** (Plus/Pro): motor de regras com condições + ações, aplicação automática ao criar/editar entradas e logs de execução
- **Análises**:
  - **Gráficos** (Plus/Pro)
  - **Insights/Variações** (Plus/Pro)
  - **Projeção** (Pro)
- **Relatórios** (Pro):
  - PDF com visual “premium”
  - Excel (XLSX) para exportação e auditoria
- **Notificações** no topo (ex.: vencimento, avisos do plano, verificação pendente)
- **Checkout/Upgrade de plano** via AbacatePay (cartão opcional via flag)

---

## Como rodar localmente

### 1) Criar ambiente e instalar dependências
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2) Configurar variáveis de ambiente
Copie o arquivo de exemplo e ajuste:
```bash
cp .env.example .env
```

Variáveis mais importantes:

- `APP_ENV=development`
- `APP_BASE_URL=http://127.0.0.1:5000`
- `SECRET_KEY=...`
- `DATABASE_URL=` (opcional; se vazio usa SQLite `database.db`)
- `MARKETING_BASE_URL=...` (site estático/marketing)
- Branding:
  - `APP_BRAND=LinkGestor`
  - `APP_TAGLINE=Controle Financeiro`
  - `APP_LEGAL_NAME=LinkGestor` (opcional, para o © do rodapé)

### 3) Rodar o servidor
```bash
python app.py
```
Abra: `http://127.0.0.1:5000`

---

## Estrutura do projeto

### Pastas principais
- `app.py` — **entrypoint** Flask, registros de blueprints, context processor, headers de segurança, rotas auxiliares (conta, etc.)
- `config.py` — configurações por ambiente (cookies, banco, chaves, AbacatePay, rate limits, branding)
- `models/` — modelos SQLAlchemy + extensões do banco
- `routes/` — blueprints (auth, entradas, analytics, regras, notificações)
- `services/` — regras, relatórios (PDF/Excel), verificação de e-mail, etc.
- `templates/` — páginas HTML (SSR) e parciais
- `static/` — CSS/JS por página (evita “global bagunçado”)

---

## Branding consistente (evita divergência entre páginas)

A marca é centralizada via config e injetada nos templates:

- `APP_BRAND` → **LinkGestor**
- `APP_TAGLINE` → **Controle Financeiro**
- `APP_LEGAL_NAME` → usado no rodapé (©)

O `<title>` das páginas é montado automaticamente como:

`{Página} — LinkGestor — Controle Financeiro`

E o rodapé público usa:

`© 2026 LinkGestor — Controle Financeiro`

---

## Planos e bloqueio por recurso (feature gating)

A liberação de recursos é feita em **duas camadas**:

1) **Backend (obrigatório)**: decorators que bloqueiam rotas/ações por plano  
2) **Frontend**: templates escondem/mostram botões e componentes, usando `has_feature(...)`

Isso impede “burlar” via DevTools.

### Onde mexer
- Definição de planos/recursos: onde o `PLANS` é definido (injetado em templates via context processor)
- Checagem: `user_has_feature(...)` + decorators em `services/permissions.py` / `routes/*`

---

## Fluxos importantes

### 1) Cadastro e verificação de e-mail
- Usuário registra → recebe token/link
- Ao confirmar, `is_verified` fica `true`
- Rotas do sistema (`/app/...`) podem exigir `is_verified`

### 2) Entradas (CRUD + automação)
- Ao criar/editar entradas:
  - salva no banco
  - chama motor de regras (se habilitado no plano)
  - registra logs de execução

### 3) Upgrade e checkout
- Página de upgrade guia o usuário conforme o plano atual
- Checkout AbacatePay retorna status e redireciona com **proteção contra open redirect**

### 4) Relatórios (Pro)
- PDF: `services/reports_pdf.py`
- Excel: `services/reports_excel.py`
- Rotas em `routes/analytics_routes.py`

---

## Segurança (o essencial)

- **CSRF obrigatório** em POST/PUT/DELETE
- Cookies com `HttpOnly` e `SameSite`
- Validação de plano e verificação em rotas sensíveis
- Sanitização de `redirect` (anti open-redirect)
- Rate limit para login/registro e reenvio de verificação (memória; produção multi-instância pede Redis)

Ver checklist: `SECURITY_CHECKLIST.md`

---

## Dicas de manutenção rápida

- “Quero mudar textos/nomes do sistema”: ajuste `APP_BRAND` e `APP_TAGLINE`
- “Quero adicionar um recurso e bloquear por plano”: crie feature + aplique decorator no backend + `has_feature()` no template
- “PDF está feio”: mexa no `services/reports_pdf.py` e no template `templates/reports_print.html`
- “Notificações não aparecem”: ver `routes/notifications_routes.py` + `static/js/shell.js`

---

## Licença
Uso interno / projeto em evolução.
