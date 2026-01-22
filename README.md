# Orçamento Pessoal (Flask + Neon/Postgres + Render)

Aplicação web para controle de orçamento pessoal com:

* Cadastro de **receitas** e **despesas**
* Listagem separada de receitas e despesas
* Cards por mês com totais (receita, despesa e saldo)
* Autenticação (login/registro) com **verificação de e-mail**
* Banco de dados:

  * **Produção**: Postgres (ex.: Neon) via `DATABASE_URL`
  * **Local**: SQLite (`database.db`) por padrão
* Endpoint novo de **Resumo de Ciclo** com **saldo carregado** usando `paid_at`

---

## Sumário

* [Stack](#stack)
* [Funcionalidades](#funcionalidades)
* [Como rodar localmente](#como-rodar-localmente)
* [Variáveis de ambiente](#variáveis-de-ambiente)
* [Banco de dados e “migração leve”](#banco-de-dados-e-migração-leve)
* [Resumo de ciclo](#resumo-de-ciclo)
* [Deploy no Render com Neon](#deploy-no-render-com-neon)
* [Rotas principais](#rotas-principais)
* [Estrutura do projeto](#estrutura-do-projeto)
* [Troubleshooting](#troubleshooting)

---

## Stack

* Python 3.x
* Flask
* Flask-Login
* Flask-SQLAlchemy
* Postgres (Neon) em produção
* Render (deploy)
* Resend (envio de e-mail de verificação, opcional)

---

## Funcionalidades

### 1) Lançamentos

* **Receita**: entrada no caixa na data informada.
* **Despesa**: possui vencimento/data planejada (`data`) e status:

  * `em_andamento`
  * `nao_pago`
  * `pago`

### 2) Verificação de e-mail

* Ao registrar, o usuário recebe um link de verificação.
* Usuários **não verificados** não acessam a tela principal (são redirecionados para a tela de “pendente”).

### 3) Saldo carregado com `paid_at` (pagamento real)

* Quando uma despesa é marcada como **paga**, o sistema grava `paid_at` (data do pagamento).
* Isso permite o cenário:

  * Recebe em um dia
  * Paga contas em outro dia
  * Sobra saldo
  * Esse saldo aparece corretamente no próximo ciclo de recebimento

---

## Como rodar localmente

### 1) Clonar / entrar na pasta do projeto

```bash
cd site_de_orcamento
```

### 2) Criar e ativar venv (recomendado)

Linux:

```bash
python3 -m venv venv
source venv/bin/activate
```

Windows (PowerShell):

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3) Instalar dependências

```bash
pip install -r requirements.txt
```

### 3.1) Build do Front-end (Vite + Tailwind)

O projeto continua com Flask SSR, mas agora os assets (CSS/JS) são buildados via Vite.

Entre na pasta do front-end:

```bash
cd frontend
```

Instale as dependências:

```bash
npm install
```

Gere o build (saída em `static/dist/`):

```bash
npm run build
```

Volte para a raiz do projeto e rode o Flask normalmente.

---

## Organização de templates (Front-end SSR)

Para reduzir repetição e padronizar UI, os templates foram organizados em:

- `templates/layouts/base.html`: documento HTML base (head/body + bundles do Vite)
- `templates/base_public.html`: casca das páginas públicas (header/footer + flash)
- `templates/base_app.html`: casca do sistema (sidebar/topbar + flash)
- `templates/partials/`: pedaços reutilizáveis (header, sidebar, topbar, flash)
- `templates/components/ui.html`: macros de componentes (botão, inputs, etc.)

Exemplo de uso de macros:

```jinja2
{% from 'components/ui.html' import btn, input_text %}
{{ input_text('email', 'email', 'E-mail', type='email', required=true) }}
{{ btn('Salvar', 'primary', type='submit') }}
```

### 4) Configurar variáveis de ambiente (opcional)

Você pode criar um arquivo `.env` na raiz do projeto (mesma pasta do `app.py`).

Exemplo mínimo para dev:

```env
SECRET_KEY=dev-secret-change-me
APP_BASE_URL=http://127.0.0.1:5000
```

Se quiser enviar e-mail real:

```env
RESEND_API_KEY=coloque_sua_chave
EMAIL_FROM=Orcamento <seu-email@seudominio.com>
```

### 5) Rodar a aplicação

```bash
python app.py
```

Acesse:

* [http://127.0.0.1:5000](http://127.0.0.1:5000)

Healthcheck:

* [http://127.0.0.1:5000/healthz](http://127.0.0.1:5000/healthz)

---

## Variáveis de ambiente

| Variável               | Obrigatória | Exemplo                       | Para que serve               |
| ---------------------- | ----------: | ----------------------------- | ---------------------------- |
| `SECRET_KEY`           | Recomendado | `uma-chave-forte`             | Sessões, login e tokens      |
| `DATABASE_URL`         | Em produção | `postgresql://...`            | Conexão com Postgres (Neon)  |
| `APP_BASE_URL`         | Recomendado | `https://seuapp.onrender.com` | Montar link de verificação   |
| `RESEND_API_KEY`       |    Opcional | `re_...`                      | Envio de e-mail (Resend)     |
| `EMAIL_FROM`           |    Opcional | `Orcamento <...>`             | Remetente do e-mail          |
| `VERIFY_TOKEN_MAX_AGE` |    Opcional | `86400`                       | Validade do token (segundos) |

Observação: se `RESEND_API_KEY` ou `EMAIL_FROM` não estiverem configurados, o sistema **não quebra**. Ele apenas registra no log um aviso e não envia e-mail (o link de verificação aparece no log do servidor).

---

## Banco de dados e “migração leve”

Este projeto **não usa Alembic**, mas possui uma migração leve automática ao subir a aplicação:

* Ao iniciar, o `init_db(app)` roda:

  * `db.create_all()`
  * Migração leve para garantir colunas necessárias, sem derrubar o banco.

### Colunas relevantes para o saldo carregado

* `status` (despesa)
* `paid_at` (despesa): data real em que foi paga
* `updated_at`: atualizado automaticamente quando a linha é alterada

### Compatibilidade

* Local: SQLite (`database.db`)
* Produção: Postgres (Neon) via `DATABASE_URL`

---

## Resumo de ciclo

### Objetivo

Gerar um resumo que não olha apenas “o dia”, mas sim:

* Carrega saldo anterior (histórico)
* Soma receitas do dia selecionado
* Lista e soma despesas pendentes no período
* Projeta o saldo final do período

### Endpoint

`GET /resumo-ciclo?data=YYYY-MM-DD`

Comportamento padrão:

* `data`: data selecionada (ex.: dia do recebimento)
* `ate`: opcional. Se não vier, calcula automaticamente o **último dia do mês** de `data`.

Exemplo (até fim do mês automaticamente):

```bash
GET /resumo-ciclo?data=2026-01-15
```

Exemplo (até uma data específica):

```bash
GET /resumo-ciclo?data=2026-01-15&ate=2026-01-30
```

### Regra de cálculo (implementada)

* `saldo_anterior` = receitas com `data <= (D-1)` − despesas pagas com `paid_at <= (D-1)`
* `receitas_no_dia` = receitas com `data == D`
* `despesas_pendentes` = despesas com vencimento (`data`) entre `D` e `ATE` **que não estejam pagas**
* `saldo_projetado` = `saldo_anterior + receitas_no_dia − total_despesas_pendentes`

---

## Deploy no Render com Neon

### Render (Web Service)

**Start command**:

```bash
gunicorn app:app
```

**Environment Variables no Render (mínimo recomendado)**:

* `SECRET_KEY` = uma chave forte
* `DATABASE_URL` = URL do Neon (Postgres)
* `APP_BASE_URL` = URL pública do Render (ex.: `https://seuapp.onrender.com`)

**Opcional para e-mail de verificação**:

* `RESEND_API_KEY`
* `EMAIL_FROM`

### Neon (Postgres)

* Crie o banco/projeto no Neon.
* Copie a connection string e coloque em `DATABASE_URL`.

Observação: o código já converte `postgres://` para `postgresql://` e adiciona `sslmode=require` quando necessário.

---

## Rotas principais

### Páginas (HTML)

* `GET /` (requer login e e-mail verificado)
* `GET /login`
* `POST /login`
* `GET /register`
* `POST /register`
* `GET /verify-pending`
* `POST /resend-verification`
* `GET /verify/<token>`
* `GET /logout`

### API (JSON)

* `GET /dados` (lista entradas do usuário autenticado/verificado)
* `POST /add` (cria entrada)
* `PUT /edit/<id>` (edita entrada; se despesa virar `pago`, grava `paid_at`)
* `DELETE /delete/<id>` (remove entrada)
* `GET /resumo-ciclo` (resumo com saldo carregado)

### Healthcheck

* `GET /healthz`

---

## Estrutura do projeto

```
site_de_orcamento/
  app.py
  config.py
  requirements.txt
  database.db                (dev/local)
  models/
    extensions.py
    user_model.py
    entrada_model.py
  routes/
    auth_routes.py
    entradas_routes.py
  services/
    email_service.py
  static/
    js/
      script.js
    css/
      (removido: estilos agora são por tela)
      (removido: estilos agora são por tela)
      dashboard.css
      entries.css
      account.css
      upgrade.css
      (removido: estilos agora são por tela)
      marketing.css
  templates/
    index.html
    login.html
    register.html
    verify_pending.html
```

---

## Troubleshooting

### 1) “Conta pendente / não consigo acessar”

Você precisa verificar o e-mail:

* Em produção, configure `RESEND_API_KEY` e `EMAIL_FROM`.
* Em dev/sem Resend, observe os logs do servidor (o link de verificação é logado quando o envio falha).

### 2) Banco não atualizou com colunas novas

O projeto roda migração leve automaticamente no startup.
Se você já tinha uma base antiga em produção e subiu o patch:

* Reinicie o serviço no Render (para forçar startup e aplicar a migração leve).
* Verifique logs.

### 3) `paid_at` ficou “hoje” ao marcar como pago

Por padrão, ao mudar despesa para `pago`, o backend define `paid_at = hoje` quando o front não envia `paid_at`.
Melhoria possível (próximo passo): adicionar no modal um campo “Data do pagamento” e enviar `paid_at` no `PUT /edit/<id>`.

---

## Licença

Projeto de uso pessoal/privado, conforme sua necessidade.
