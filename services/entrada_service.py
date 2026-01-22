from models import db
from models.entrada_model import Entrada


def adicionar_entrada(user_id: int, data, tipo: str, descricao: str, valor: float, status: str | None):
    e = Entrada(
        user_id=user_id,
        data=data,
        tipo=tipo,
        descricao=descricao,
        valor=float(valor),
        status=status
    )
    db.session.add(e)
    db.session.commit()
    return e


def listar_entradas(user_id: int):
    entradas = (
        Entrada.query
        .filter_by(user_id=user_id)
        .order_by(Entrada.data.desc(), Entrada.id.desc())
        .all()
    )
    return entradas


def editar_entrada(user_id: int, entrada_id: int, data, tipo: str, descricao: str, valor: float, status: str | None):
    e = Entrada.query.filter_by(id=entrada_id, user_id=user_id).first()
    if not e:
        return None

    e.data = data
    e.tipo = tipo
    e.descricao = descricao
    e.valor = float(valor)
    e.status = status
    db.session.commit()
    return e


def deletar_entrada(user_id: int, entrada_id: int) -> bool:
    e = Entrada.query.filter_by(id=entrada_id, user_id=user_id).first()
    if not e:
        return False

    db.session.delete(e)
    db.session.commit()
    return True
