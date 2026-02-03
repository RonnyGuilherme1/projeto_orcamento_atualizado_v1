from __future__ import annotations

from datetime import datetime

from sqlalchemy import text

from models.extensions import db


class Entrada(db.Model):
    __tablename__ = "entradas"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # Para receita: data = data do recebimento
    # Para despesa: data = data de vencimento (ou data planejada)
    data = db.Column(db.Date, nullable=False)
    tipo = db.Column(db.String(20), nullable=False)  # receita | despesa
    descricao = db.Column(db.String(255), nullable=False)
    categoria = db.Column(db.String(32), nullable=False, default="outros")
    valor = db.Column(db.Float, nullable=False)
    metodo = db.Column(db.String(24), nullable=True)
    tags = db.Column(db.String(255), nullable=True)
    priority = db.Column(db.String(10), nullable=False, default='media')  # alta | media | baixa
    recurrence_id = db.Column(db.Integer, db.ForeignKey("recurrences.id"), nullable=True)

    # Status financeiro (despesa/receita)
    status = db.Column(db.String(30), nullable=True)  # em_andamento | pago | nao_pago | recebido

    # Data em que a despesa foi efetivamente paga (quando status vira "pago")
    paid_at = db.Column(db.Date, nullable=True)
    # Data em que a receita foi confirmada (quando status vira "recebido")
    received_at = db.Column(db.Date, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


def _column_exists(conn, table: str, column: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).mappings().all()
    return any(r.get("name") == column for r in rows)


def _migrate_sqlite_schema(conn) -> None:
    """Migração leve para SQLite sem Alembic.

    Objetivo: manter compatibilidade com o database.db existente no Render.
    """
    # paid_at
    if not _column_exists(conn, "entradas", "paid_at"):
        conn.execute(text("ALTER TABLE entradas ADD COLUMN paid_at DATE"))

    # updated_at
    if not _column_exists(conn, "entradas", "updated_at"):
        conn.execute(text("ALTER TABLE entradas ADD COLUMN updated_at DATETIME"))

    # categoria
    if not _column_exists(conn, "entradas", "categoria"):
        conn.execute(text("ALTER TABLE entradas ADD COLUMN categoria VARCHAR(32)"))
        conn.execute(text("UPDATE entradas SET categoria = COALESCE(categoria, 'outros')"))

    # metodo
    if not _column_exists(conn, "entradas", "metodo"):
        conn.execute(text("ALTER TABLE entradas ADD COLUMN metodo VARCHAR(24)"))

    # tags
    if not _column_exists(conn, "entradas", "tags"):
        conn.execute(text("ALTER TABLE entradas ADD COLUMN tags VARCHAR(255)"))

    # recurrence_id
    if not _column_exists(conn, "entradas", "recurrence_id"):
        conn.execute(text("ALTER TABLE entradas ADD COLUMN recurrence_id INTEGER"))

    # Backfill: updated_at
    conn.execute(text("UPDATE entradas SET updated_at = COALESCE(updated_at, created_at)"))

    # Backfill: paid_at para dados antigos marcados como pago
    # (assume que a data de pagamento era a própria data/vencimento registrada)
    conn.execute(
        text(
            """
            UPDATE entradas
               SET paid_at = COALESCE(paid_at, data)
             WHERE tipo = 'despesa'
               AND status = 'pago'
            """
        )
    )

    # received_at
    if not _column_exists(conn, "entradas", "received_at"):
        conn.execute(text("ALTER TABLE entradas ADD COLUMN received_at DATE"))
    conn.execute(
        text(
            """
            UPDATE entradas
               SET received_at = COALESCE(received_at, data)
             WHERE status = 'recebido'
            """
        )
    )

    
    # priority (PRO)
    if not _column_exists(conn, "entradas", "priority"):
        conn.execute(text("ALTER TABLE entradas ADD COLUMN priority VARCHAR(10)"))
        conn.execute(text("UPDATE entradas SET priority = COALESCE(priority, 'media')"))

# ---------------- users (planos) ----------------
    if not _column_exists(conn, "users", "plan"):
        conn.execute(text("ALTER TABLE users ADD COLUMN plan VARCHAR(20)"))
        conn.execute(text("UPDATE users SET plan = COALESCE(plan, 'basic')"))

    if not _column_exists(conn, "users", "plan_updated_at"):
        conn.execute(text("ALTER TABLE users ADD COLUMN plan_updated_at DATETIME"))

    if not _column_exists(conn, "users", "plan_expires_at"):
        conn.execute(text("ALTER TABLE users ADD COLUMN plan_expires_at DATETIME"))

    if not _column_exists(conn, "users", "plan_last_paid_at"):
        conn.execute(text("ALTER TABLE users ADD COLUMN plan_last_paid_at DATETIME"))

    if not _column_exists(conn, "users", "notify_due_alert"):
        conn.execute(text("ALTER TABLE users ADD COLUMN notify_due_alert BOOLEAN"))
        conn.execute(
            text("UPDATE users SET notify_due_alert = 1 WHERE notify_due_alert IS NULL")
        )

    # ---------------- users (dados pessoais / checkout) ----------------
    if not _column_exists(conn, "users", "full_name"):
        conn.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR(255)"))

    if not _column_exists(conn, "users", "tax_id"):
        conn.execute(text("ALTER TABLE users ADD COLUMN tax_id VARCHAR(32)"))

    if not _column_exists(conn, "users", "cellphone"):
        conn.execute(text("ALTER TABLE users ADD COLUMN cellphone VARCHAR(32)"))

    if not _column_exists(conn, "users", "abacatepay_customer_id"):
        conn.execute(text("ALTER TABLE users ADD COLUMN abacatepay_customer_id VARCHAR(64)"))

    # ---------------- users (unicidade de username) ----------------
    duplicates = conn.execute(
        text(
            """
            SELECT username, COUNT(*) as qty
              FROM users
             GROUP BY username
            HAVING COUNT(*) > 1
            """
        )
    ).fetchall()
    if duplicates:
        sample = ", ".join(str(row[0]) for row in duplicates[:5])
        raise RuntimeError(
            "Nao foi possivel aplicar unicidade de username. Existem duplicados: "
            f"{sample}"
        )

    conn.execute(
        text("CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)")
    )


def init_db(app):
    db.init_app(app)
    with app.app_context():
        # IMPORTANTE: garante que a tabela user_profiles entra no metadata
        from models.user_profile_model import UserProfile  # noqa: F401
        from models.automation_rule_model import AutomationRule, RuleExecution  # noqa: F401
        from models.recurrence_model import Recurrence, RecurrenceExecution  # noqa: F401
        from models.reminder_model import Reminder  # noqa: F401
        from models.projection_scenario_model import ProjectionScenario  # noqa: F401


        db.create_all()

        # Migração leve (SQLite/Postgres) sem Alembic
        engine_name = db.engine.name
        with db.engine.begin() as conn:
            if engine_name == "sqlite":
                conn.execute(text("PRAGMA journal_mode=WAL"))
                conn.execute(text("PRAGMA synchronous=NORMAL"))
                conn.execute(text("PRAGMA busy_timeout=5000"))
                _migrate_sqlite_schema(conn)
            elif engine_name in {"postgresql", "postgres"}:
                _migrate_postgres_schema(conn)


def _column_exists_postgres(conn, table: str, column: str) -> bool:
    rows = conn.execute(
        text(
            """
            SELECT 1
              FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = :table
               AND column_name = :column
             LIMIT 1
            """
        ),
        {"table": table, "column": column},
    ).fetchall()
    return len(rows) > 0


def _migrate_postgres_schema(conn) -> None:
    """Migração leve para Postgres (Neon) sem Alembic.

    Objetivo: adicionar colunas novas sem quebrar o banco existente.
    """
    # paid_at
    if not _column_exists_postgres(conn, "entradas", "paid_at"):
        conn.execute(text("ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS paid_at DATE"))

    # updated_at
    if not _column_exists_postgres(conn, "entradas", "updated_at"):
        conn.execute(
            text("ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP")
        )

    # categoria
    if not _column_exists_postgres(conn, "entradas", "categoria"):
        conn.execute(
            text("ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS categoria VARCHAR(32)")
        )
        conn.execute(
            text("UPDATE public.entradas SET categoria = COALESCE(categoria, 'outros')")
        )

    # metodo
    if not _column_exists_postgres(conn, "entradas", "metodo"):
        conn.execute(
            text("ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS metodo VARCHAR(24)")
        )

    # tags
    if not _column_exists_postgres(conn, "entradas", "tags"):
        conn.execute(text("ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS tags VARCHAR(255)"))

    # priority (PRO)
    if not _column_exists_postgres(conn, "entradas", "priority"):
        conn.execute(text("ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS priority VARCHAR(10)"))

    # recurrence_id
    if not _column_exists_postgres(conn, "entradas", "recurrence_id"):
        conn.execute(
            text("ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS recurrence_id INTEGER")
        )

    # Backfill: updated_at
    conn.execute(text("UPDATE public.entradas SET updated_at = COALESCE(updated_at, created_at)"))

    # Backfill: paid_at para dados antigos marcados como pago
    # (assume que a data de pagamento era a própria data/vencimento registrada)
    conn.execute(
        text(
            """
            UPDATE public.entradas
               SET paid_at = COALESCE(paid_at, data)
             WHERE tipo = 'despesa'
               AND status = 'pago'
            """
        )
    )

    # received_at
    if not _column_exists_postgres(conn, "entradas", "received_at"):
        conn.execute(
            text("ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS received_at DATE")
        )
    conn.execute(
        text(
            """
            UPDATE public.entradas
               SET received_at = COALESCE(received_at, data)
             WHERE status = 'recebido'
            """
        )
    )

    # ---------------- users (planos) ----------------
    if not _column_exists_postgres(conn, "users", "plan"):
        conn.execute(text("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan VARCHAR(20)"))
        conn.execute(text("UPDATE public.users SET plan = COALESCE(plan, 'basic')"))

    if not _column_exists_postgres(conn, "users", "plan_updated_at"):
        conn.execute(
            text("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMP")
        )

    if not _column_exists_postgres(conn, "users", "plan_expires_at"):
        conn.execute(
            text("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP")
        )

    if not _column_exists_postgres(conn, "users", "plan_last_paid_at"):
        conn.execute(
            text(
                "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_last_paid_at TIMESTAMP"
            )
        )

    if not _column_exists_postgres(conn, "users", "notify_due_alert"):
        conn.execute(
            text(
                "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notify_due_alert BOOLEAN"
            )
        )
        conn.execute(
            text(
                "UPDATE public.users SET notify_due_alert = TRUE WHERE notify_due_alert IS NULL"
            )
        )

    # ---------------- users (dados pessoais / checkout) ----------------
    if not _column_exists_postgres(conn, "users", "full_name"):
        conn.execute(
            text("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)")
        )

    if not _column_exists_postgres(conn, "users", "tax_id"):
        conn.execute(text("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tax_id VARCHAR(32)"))

    if not _column_exists_postgres(conn, "users", "cellphone"):
        conn.execute(
            text("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cellphone VARCHAR(32)")
        )

    if not _column_exists_postgres(conn, "users", "abacatepay_customer_id"):
        conn.execute(
            text(
                "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS abacatepay_customer_id VARCHAR(64)"
            )
        )

    # ---------------- users (unicidade de username) ----------------
    duplicates = conn.execute(
        text(
            """
            SELECT username, COUNT(*) as qty
              FROM public.users
             GROUP BY username
            HAVING COUNT(*) > 1
            """
        )
    ).fetchall()
    if duplicates:
        sample = ", ".join(str(row[0]) for row in duplicates[:5])
        raise RuntimeError(
            "Nao foi possivel aplicar unicidade de username. Existem duplicados: "
            f"{sample}"
        )

    conn.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON public.users (username)"
        )
    )
    
