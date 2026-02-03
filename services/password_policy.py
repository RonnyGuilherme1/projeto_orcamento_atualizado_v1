import re


class PasswordValidationError(ValueError):
    pass


def validate_password(password: str) -> None:
    """Valida politica minima de senha.

    Regras:
    - minimo 8 caracteres
    - ao menos 1 letra
    - ao menos 1 numero
    """
    if not password or len(password) < 8:
        raise PasswordValidationError("A senha deve ter ao menos 8 caracteres.")

    if not re.search(r"[A-Za-z]", password):
        raise PasswordValidationError("A senha deve conter ao menos 1 letra.")

    if not re.search(r"\d", password):
        raise PasswordValidationError("A senha deve conter ao menos 1 numero.")
