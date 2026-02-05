import os
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


class Config:
    # Ambiente (opcional) - use para rotular logs/UX
    APP_ENV = (
        os.getenv("APP_ENV")
        or os.getenv("FLASK_ENV")
        or os.getenv("ENV")
        or "development"
    ).lower()
    IS_PRODUCTION = APP_ENV in {"prod", "production"} or os.getenv("RENDER") == "true" or bool(os.getenv("RENDER_EXTERNAL_URL"))

    # Branding (produto vs empresa)
    # - APP_NAME: nome do sistema exibido na UI (ex.: "Controle Financeiro")
    # - APP_TAGLINE: subtítulo opcional (pode ficar vazio)
    # - APP_COMPANY: nome da empresa/gestora (exibido no © do rodapé)
    APP_NAME = (os.getenv("APP_NAME", "Controle Financeiro") or "").strip() or "Controle Financeiro"
    APP_TAGLINE = (os.getenv("APP_TAGLINE", "") or "").strip()
    APP_COMPANY = (os.getenv("APP_COMPANY", os.getenv("APP_LEGAL_NAME", "LinkGestor")) or "").strip() or "LinkGestor"

    def _is_weak_secret(value: str) -> bool:
        if not value:
            return True
        if value == "dev-secret-change-me":
            return True
        if len(value) < 32:
            return True
        return False

    # Essencial para sessão/login/flash
    SECRET_KEY = os.getenv("SECRET_KEY", "")
    if not SECRET_KEY:
        SECRET_KEY = "dev-secret-change-me"
    if IS_PRODUCTION and _is_weak_secret(SECRET_KEY):
        raise RuntimeError("SECRET_KEY ausente ou fraco em produção.")

    # Banco:
    # - Local: sqlite
    # - Produção: DATABASE_URL do Render/Neon (Postgres)
    DATABASE_URL = os.getenv("DATABASE_URL")

    if DATABASE_URL:
        # Alguns provedores usam "postgres://", SQLAlchemy prefere "postgresql://"
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

        # Força psycopg (v3) para compatibilidade com Python 3.13 no Render
        # Se vier apontando para psycopg2, converte para psycopg
        if DATABASE_URL.startswith("postgresql+psycopg2://"):
            DATABASE_URL = DATABASE_URL.replace(
                "postgresql+psycopg2://", "postgresql+psycopg://", 1
            )

        # Se vier sem driver explícito (postgresql://), força psycopg (v3)
        if DATABASE_URL.startswith("postgresql://"):
            DATABASE_URL = DATABASE_URL.replace(
                "postgresql://", "postgresql+psycopg://", 1
            )

        # Garante SSL quando necessário (Neon geralmente exige)
        if "sslmode=" not in DATABASE_URL:
            sep = "&" if "?" in DATABASE_URL else "?"
            DATABASE_URL = f"{DATABASE_URL}{sep}sslmode=require"

        SQLALCHEMY_DATABASE_URI = DATABASE_URL
    else:
        SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(BASE_DIR, "database.db")

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Evita conexoes reutilizadas mortas (Neon/SSL/Pooler)
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "280")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
    }

    # connect_args só faz sentido quando é Postgres
    if DATABASE_URL:
        SQLALCHEMY_ENGINE_OPTIONS["connect_args"] = {
            "sslmode": "require",
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        }
    else:
        SQLALCHEMY_ENGINE_OPTIONS["connect_args"] = {
            "check_same_thread": False,
            "timeout": int(os.getenv("SQLITE_TIMEOUT", "30")),
        }

    DEBUG = _env_bool("DEBUG", default=not IS_PRODUCTION)
    if IS_PRODUCTION:
        DEBUG = False
    TESTING = _env_bool("TESTING", default=False)

    # Sessão / cookies
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = IS_PRODUCTION
    REMEMBER_COOKIE_SECURE = IS_PRODUCTION
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = os.getenv("REMEMBER_COOKIE_SAMESITE", "Lax")
    PERMANENT_SESSION_LIFETIME = timedelta(days=int(os.getenv("SESSION_LIFETIME_DAYS", "7")))
    PREFERRED_URL_SCHEME = "https" if IS_PRODUCTION else "http"

    # URL pública do app (Render). Ex: https://seuapp.onrender.com
    _app_base_url = os.getenv("APP_BASE_URL")
    if not _app_base_url:
        if IS_PRODUCTION:
            raise RuntimeError("APP_BASE_URL deve estar configurado em produção.")
        _app_base_url = "http://127.0.0.1:5000"
    APP_BASE_URL = _app_base_url.rstrip("/")

    # URL do site de marketing (estático). Ex: https://controledeorcamento.onrender.com
    MARKETING_BASE_URL = os.getenv("MARKETING_BASE_URL", "https://controledeorcamento.onrender.com").rstrip("/")

    # Branding / identidade (padrão: LinkGestor — Controle Financeiro)
    APP_BRAND = os.getenv("APP_BRAND", "LinkGestor").strip() or "LinkGestor"
    APP_TAGLINE = os.getenv("APP_TAGLINE", "Controle Financeiro").strip() or "Controle Financeiro"
    # Nome legal exibido em copyright/rodapé (pode ser diferente da marca)
    APP_LEGAL_NAME = os.getenv("APP_LEGAL_NAME", APP_BRAND).strip() or APP_BRAND

    # Resend (envio de e-mail)
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
    EMAIL_FROM = os.getenv("EMAIL_FROM", "Acme <onboarding@resend.dev>")
    EMAIL_VERIFICATION_DEV_MODE = _env_bool("EMAIL_VERIFICATION_DEV_MODE", default=not IS_PRODUCTION)
    EMAIL_SEND_ENABLED = _env_bool("EMAIL_SEND_ENABLED", default=True)

    # Tempo máximo (em segundos) para validação do token de verificação
    VERIFY_TOKEN_MAX_AGE = int(os.getenv("VERIFY_TOKEN_MAX_AGE", "86400"))

    # AbacatePay
    ABACATEPAY_API_KEY = os.getenv("ABACATEPAY_API_KEY", "")
    # Secret configurado no webhook (header ou query param, conforme provedor)
    ABACATEPAY_WEBHOOK_SECRET = os.getenv("ABACATEPAY_WEBHOOK_SECRET", "")
    if IS_PRODUCTION and not ABACATEPAY_WEBHOOK_SECRET:
        raise RuntimeError("ABACATEPAY_WEBHOOK_SECRET deve estar configurado em produção.")
    # Habilita cartao (beta) no checkout.
    ABACATEPAY_CARD_ENABLED = os.getenv("ABACATEPAY_CARD_ENABLED", "").lower() in {
        "1",
        "true",
        "yes",
    }
    SUBSCRIPTION_CYCLE_DAYS = int(os.getenv("SUBSCRIPTION_CYCLE_DAYS", "30"))

    ABACATEPAY_DEV_MODE = _env_bool("ABACATEPAY_DEV_MODE", default=not IS_PRODUCTION)

    # HSTS (aplicar somente quando HTTPS for garantido)
    HSTS_ENABLED = _env_bool("HSTS_ENABLED", default=False)
    HSTS_INCLUDE_SUBDOMAINS = _env_bool("HSTS_INCLUDE_SUBDOMAINS", default=True)
    HSTS_PRELOAD = _env_bool("HSTS_PRELOAD", default=False)

    # Rate limiting (em memória - produção multi-instância exige Redis)
    RATE_LIMIT_LOGIN = int(os.getenv("RATE_LIMIT_LOGIN", "10"))
    RATE_LIMIT_LOGIN_WINDOW = int(os.getenv("RATE_LIMIT_LOGIN_WINDOW", "900"))
    RATE_LIMIT_REGISTER = int(os.getenv("RATE_LIMIT_REGISTER", "5"))
    RATE_LIMIT_REGISTER_WINDOW = int(os.getenv("RATE_LIMIT_REGISTER_WINDOW", "3600"))
    RATE_LIMIT_RESEND_VERIFICATION = int(os.getenv("RATE_LIMIT_RESEND_VERIFICATION", "3"))
    RATE_LIMIT_RESEND_VERIFICATION_WINDOW = int(os.getenv("RATE_LIMIT_RESEND_VERIFICATION_WINDOW", "900"))
