import logging

import requests
from flask import current_app

from models.user_model import User

logger = logging.getLogger(__name__)


def send_verification_email(user: User) -> bool:
    """Envia e-mail de verificação via Resend.

    - Em DEV/sem RESEND_API_KEY, não falha: apenas loga o link.
    - Retorna True se uma requisição de envio foi executada com sucesso.
    """

    app_base_url = (current_app.config.get("APP_BASE_URL") or "").rstrip("/")
    token = user.get_verification_token()
    verify_link = f"{app_base_url}/verify/{token}"

    api_key = (current_app.config.get("RESEND_API_KEY") or "").strip()
    email_from = (current_app.config.get("EMAIL_FROM") or "").strip()

    if not api_key or not email_from:
        logger.warning(
            "RESEND_API_KEY/EMAIL_FROM não configurado. Link de verificação: %s",
            verify_link,
        )
        return False

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
            return False

        return True

    except Exception as exc:  # noqa: BLE001
        logger.warning("Falha ao enviar e-mail (Resend): %s", exc)
        logger.warning("Link de verificação: %s", verify_link)
        return False
