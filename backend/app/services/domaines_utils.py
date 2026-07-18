from sqlalchemy.orm import Session

from app.models import Domaine


def resoudre_domaines(db: Session, domaine_ids: list[int]) -> list[Domaine]:
    """Charge les domaines correspondant aux ids fournis et vérifie qu'ils partagent
    tous le même contexte (Pro ou Perso) — un item ne peut pas mélanger les deux,
    son contexte effectif étant entièrement déterminé par ses domaines."""
    if not domaine_ids:
        return []
    domaines = db.query(Domaine).filter(Domaine.id.in_(domaine_ids)).all()
    if len(domaines) != len(set(domaine_ids)):
        raise ValueError("Un ou plusieurs domaines sont introuvables")
    contextes = {d.contexte for d in domaines}
    if len(contextes) > 1:
        raise ValueError("Les domaines d'un même item doivent tous être du même contexte (Pro ou Perso)")
    return domaines
