# Changelog

## 2026-02-04
- Hardening de produção: cookies seguros, SECRET_KEY obrigatório em produção e headers de segurança.
- Logout via POST com CSRF e página de confirmação para GET legado.
- Validação forte de inputs em entradas, regras, recorrências e lembretes.
- Webhook AbacatePay protegido por segredo (timing-safe).
- Proteção contra open redirect e formula injection em exportações.
- Rate limiting básico em login/registro/reenviar verificação.
- Smoke test de segurança (`scripts/security_smoke_test.py`).
