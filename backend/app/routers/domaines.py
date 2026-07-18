from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Contexte, Domaine, Note, Tache, VeilleItem
from app.schemas import DomaineCreate, DomaineOut, DomaineUpdate

router = APIRouter(prefix="/domaines", tags=["domaines"])


@router.get("", response_model=list[DomaineOut])
def lister_domaines(
    contexte: Optional[Contexte] = None,
    usage: Optional[Literal["taches", "veille"]] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Domaine)
    if contexte:
        query = query.filter(Domaine.contexte == contexte)
    if usage == "taches":
        query = query.filter(Domaine.utilise_pour_taches.is_(True))
    elif usage == "veille":
        query = query.filter(Domaine.utilise_pour_veille.is_(True))
    return query.order_by(Domaine.nom).all()


@router.post("", response_model=DomaineOut, status_code=201)
def creer_domaine(domaine: DomaineCreate, db: Session = Depends(get_db)):
    if db.query(Domaine).filter(Domaine.nom == domaine.nom).first():
        raise HTTPException(status_code=409, detail="Un domaine avec ce nom existe déjà")
    obj = Domaine(**domaine.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{domaine_id}", response_model=DomaineOut)
def modifier_domaine(domaine_id: int, domaine: DomaineUpdate, db: Session = Depends(get_db)):
    obj = db.get(Domaine, domaine_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Domaine introuvable")
    if domaine.nom and domaine.nom != obj.nom:
        if db.query(Domaine).filter(Domaine.nom == domaine.nom).first():
            raise HTTPException(status_code=409, detail="Un domaine avec ce nom existe déjà")
    for champ, valeur in domaine.model_dump(exclude_unset=True).items():
        setattr(obj, champ, valeur)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{domaine_id}", status_code=204)
def supprimer_domaine(domaine_id: int, db: Session = Depends(get_db)):
    obj = db.get(Domaine, domaine_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Domaine introuvable")

    utilise = (
        db.query(Tache).filter(Tache.domaines.any(Domaine.id == domaine_id)).first()
        or db.query(VeilleItem).filter(VeilleItem.domaines.any(Domaine.id == domaine_id)).first()
        or db.query(Note).filter(Note.domaines.any(Domaine.id == domaine_id)).first()
    )
    if utilise:
        raise HTTPException(
            status_code=409,
            detail="Ce domaine est encore utilisé par au moins une tâche, un item de veille ou une note",
        )

    db.delete(obj)
    db.commit()
