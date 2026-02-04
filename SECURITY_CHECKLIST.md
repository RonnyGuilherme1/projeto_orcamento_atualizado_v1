# Security Checklist

## Repo Hygiene (Critical)
- `.gitignore` atualizado para cobrir `.env*`, bancos SQLite, `instance/`, `Venv/`, caches, logs e backups.
- Arquivos sensíveis **existem no repo local** (`.env`, `database.db`, `.venv/`, `__pycache__/`).
- Remoção do histórico **não executada automaticamente**. Se esses arquivos já foram versionados, remova do histórico com segurança:
  1. Faça backup fora do repo.
  2. Use `git filter-repo` (recomendado) ou BFG para purgar `.env*`, `*.db`, `instance/`, `*.log`, etc.
  3. Force push apenas quando tiver certeza.

## Sessão/Cookies (Critical)
- `SECRET_KEY` obrigatório e validado em produção (falha no startup se ausente/fraco).
- `SESSION_COOKIE_SECURE=True` em produção.
- `SESSION_COOKIE_HTTPONLY=True`.
- `SESSION_COOKIE_SAMESITE=Lax` (ajustável por env).
- `REMEMBER_COOKIE_SECURE/HTTPONLY/SAMESITE` configurados.
- `PERMANENT_SESSION_LIFETIME` configurado (7 dias por padrão).
- `DEBUG=False` em produção.

## Troca de E-mail + Verificação (Critical)
- Ao trocar e-mail: `is_verified=False`, novo e-mail de verificação enviado.
- Acesso a `/app/*` bloqueado até verificação.
- Verificação de token exige:
  - token válido e não expirado
  - `uid` válido
  - `email` do token == e-mail atual do usuário

## Logout Seguro (Important)
- `/logout` agora é **POST** com CSRF.
- `GET /logout` exibe confirmação (não faz logout direto).
- Templates e links atualizados para POST.

## Webhook AbacatePay (Critical)
- `ABACATEPAY_WEBHOOK_SECRET` obrigatório em produção (startup falha se ausente).
- Validação com `hmac.compare_digest`.
- Aceita segredo por header (`X-AbacatePay-Webhook-Secret`) ou query param (`webhookSecret`/`secret`).
- Sem segredo ou inválido → `401`.
- Sem config → `500`.

## Redirect Safety (Important)
- Helper `safe_redirect_path()` limita redirecionamentos a `paths` iniciando com `/app/`.
- `/app/upgrade/status` sanitiza o parâmetro `redirect` e ignora URLs externas.

## Validação de Input (Important)
- `/add`, `/edit`, `/delete` e `/api/*` com validação forte:
  - `tipo` permitido: `receita|despesa`
  - `status` coerente por tipo
  - `valor` >= 0 e com limite máximo configurável
  - `data` em formato ISO
  - `descricao` com limite de tamanho
- Recorrências e lembretes validam `tipo`, `status`, `valor` e `frequência`.

## Exportação Segura (Important)
- Proteção contra **formula injection** em CSV/XLSX:
  - valores iniciando com `=`, `+`, `-`, `@` recebem prefixo `'`.

## Headers de Segurança (Recommended)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` mínimo
- `Content-Security-Policy` com `self` e `unsafe-inline` (há scripts inline; migrar depois)
- `Strict-Transport-Security` opcional via `HSTS_ENABLED`

## Rate Limiting (Recommended)
- Implementação em memória para:
  - login
  - register
  - resend verification
- Para múltiplas instâncias, migrar para Redis/Flask-Limiter.

## Verificação Local (Tests)
Execute o smoke test:
```bash
python scripts/security_smoke_test.py
```
Valida:
- CSRF obrigatório
- open redirect bloqueado
- troca de e-mail invalida verificação
- webhook exige secret
- validação de payload

## Variáveis de Ambiente Obrigatórias (Deploy)
- `APP_ENV=production`
- `SECRET_KEY` (>= 32 chars, aleatória)
- `APP_BASE_URL` (URL pública)
- `DATABASE_URL` (Postgres/SQLite)
- `ABACATEPAY_API_KEY`
- `ABACATEPAY_WEBHOOK_SECRET`
- `RESEND_API_KEY` (se envio real de e-mail)
- `EMAIL_FROM`

## Variáveis Recomendadas/Configuração
- `MARKETING_BASE_URL`
- `SESSION_LIFETIME_DAYS`
- `SESSION_COOKIE_SAMESITE`
- `REMEMBER_COOKIE_SAMESITE`
- `HSTS_ENABLED=true` (somente se HTTPS for garantido)
- `RATE_LIMIT_*` (ajustes de limite/janela)
