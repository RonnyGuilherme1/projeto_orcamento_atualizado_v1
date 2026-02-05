import logging

import requests
from flask import current_app, session, has_request_context

from models.user_model import User

logger = logging.getLogger(__name__)


def _store_dev_verify_link(user: User, verify_link: str) -> None:
    if not current_app.config.get("EMAIL_VERIFICATION_DEV_MODE"):
        return
    if not has_request_context():
        return
    try:
        session["last_verify_link"] = verify_link
        if user and user.id is not None:
            session["last_verify_user_id"] = int(user.id)
    except Exception:
        logger.warning("Nao foi possivel salvar o link de verificação na sessão.", exc_info=True)


def send_verification_email(user: User) -> bool:
    """Envia e-mail de verificação via Resend.

    - Em DEV, guarda o último link na sessão para exibição.
    - Sem RESEND_API_KEY ou com envio desabilitado, não falha: apenas loga o link.
    - Retorna True quando o fluxo pode continuar (envio feito ou link gerado).
    """

    app_base_url = (current_app.config.get("APP_BASE_URL") or "").rstrip("/")
    token = user.generate_verify_token()
    verify_link = f"{app_base_url}/verify/{token}"
    # Mantém o plano escolhido no fluxo marketing → cadastro → verificação
    try:
        from flask import session
        plan = (session.get("selected_plan") or "").strip().lower()
        if plan in {"plus", "pro"}:
            verify_link = f"{verify_link}?plan={plan}"
    except Exception:
        pass
    _store_dev_verify_link(user, verify_link)

    api_key = (current_app.config.get("RESEND_API_KEY") or "").strip()
    email_from = (current_app.config.get("EMAIL_FROM") or "").strip()
    send_enabled = bool(current_app.config.get("EMAIL_SEND_ENABLED", True))

    if not send_enabled or not api_key or not email_from:
        logger.warning(
            "Envio de e-mail desabilitado ou não configurado. Link de verificação: %s",
            verify_link,
        )
        return True

    payload = {
        "from": email_from,
        "to": [user.email],
        "subject": "Confirme seu e-mail",
        "html": (
            "<p>Olá!</p>"
            "<p>Para confirmar seu e-mail, clique no link abaixo:</p>"
            f"<p><a href=\"{verify_link}\">Confirmar e-mail</a></p>"
            "<p>Se você não solicitou isso, pode ignorar esta mensagem.</p>"
        ),
    }

    try:
        r = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=20,
        )

        if r.status_code >= 400:
            logger.warning("Falha ao enviar e-mail (Resend): %s %s", r.status_code, r.text)
            logger.warning("Link de verificação: %s", verify_link)
            return bool(current_app.config.get("EMAIL_VERIFICATION_DEV_MODE"))

        return True

    except requests.RequestException as exc:
        logger.warning("Falha ao enviar e-mail (Resend): %s", exc, exc_info=True)
        logger.warning("Link de verificação: %s", verify_link)
        return bool(current_app.config.get("EMAIL_VERIFICATION_DEV_MODE"))
