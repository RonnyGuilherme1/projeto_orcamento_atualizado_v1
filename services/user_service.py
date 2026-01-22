from werkzeug.security import generate_password_hash, check_password_hash
from models import db
from models.user_model import User


def registrar_usuario(username: str, email: str, senha: str) -> int:
    username = (username or "").strip()
    email = (email or "").strip().lower()
    if not username or not email or not senha:
        raise ValueError("Usuário, e-mail e senha são obrigatórios.")

    if User.query.filter_by(username=username).first():
        raise ValueError("Este usuário já existe.")
    if User.query.filter_by(email=email).first():
        raise ValueError("Este e-mail já está em uso.")

    user = User(username=username, email=email, is_verified=False)
    user.password_hash = generate_password_hash(senha)

    db.session.add(user)
    db.session.commit()
    return user.id


def autenticar_usuario(login_id: str, senha: str):
    login_id = (login_id or "").strip()
    if not login_id or not senha:
        return None

    user = User.query.filter((User.username == login_id) | (User.email == login_id)).first()
    if not user:
        return None
    if not check_password_hash(user.password_hash, senha):
        return None
    return user
