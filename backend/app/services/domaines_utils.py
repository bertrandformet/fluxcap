from sqlalchemy.orm import Session

from app.models import Contexte, Domaine


def resoudre_domaines(db: Session, domaine_ids: list[int]) -> list[Domaine]:
    """Charge les domaines correspondant aux ids fournis et vérifie qu'ils sont
    compatibles entre eux : un domaine "les_deux" se combine librement avec
    n'importe quoi, mais on ne peut toujours pas mélanger un domaine pro-only
    avec un domaine perso-only sur le même item."""
    if not domaine_ids:
        return []
    domaines = db.query(Domaine).filter(Domaine.id.in_(domaine_ids)).all()
    if len(domaines) != len(set(domaine_ids)):
        raise ValueError("Un ou plusieurs domaines sont introuvables")
    contextes_stricts = {d.contexte for d in domaines if d.contexte != Contexte.les_deux}
    if len(contextes_stricts) > 1:
        raise ValueError("Les domaines d'un même item doivent tous être du même contexte (Pro ou Perso)")
    return domaines
