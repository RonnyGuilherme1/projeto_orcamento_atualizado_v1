import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    # Essencial para sessão/login/flash
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

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

    # URL pública do app (Render). Ex: https://seuapp.onrender.com
    APP_BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:5000")

    # Resend (envio de e-mail)
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
    EMAIL_FROM = os.getenv("EMAIL_FROM", "Orcamento <onboarding@resend.dev>")

    # Tempo máximo (em segundos) para validação do token de verificação
    VERIFY_TOKEN_MAX_AGE = int(os.getenv("VERIFY_TOKEN_MAX_AGE", "86400"))

    # AbacatePay
    ABACATEPAY_API_KEY = os.getenv("ABACATEPAY_API_KEY", "")
    # Secret configurado na URL do webhook (query param webhookSecret)
    ABACATEPAY_WEBHOOK_SECRET = os.getenv("ABACATEPAY_WEBHOOK_SECRET", "")

    # Ambiente (opcional) - use para rotular logs/UX
    ABACATEPAY_DEV_MODE = os.getenv("ABACATEPAY_DEV_MODE", "true").lower() in {
        "1",
        "true",
        "yes",
    }
