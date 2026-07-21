from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Contexte, Domaine, SourceVeille
from app.schemas import SourceVeilleCreate, SourceVeilleOut, SourceVeilleUpdate

router = APIRouter(prefix="/sources-veille", tags=["sources-veille"])


def _valider_domaine_source(db: Session, domaine_id: Optional[int], contexte: str) -> None:
    if domaine_id is None:
        return
    domaine = db.get(Domaine, domaine_id)
    if not domaine:
        raise HTTPException(status_code=400, detail="Domaine introuvable")
    if domaine.contexte not in (contexte, Contexte.les_deux):
        raise HTTPException(status_code=400, detail="Le domaine doit être du même contexte que la source")


@router.get("", response_model=list[SourceVeilleOut])
def lister_sources(contexte: Optional[Literal["pro", "perso"]] = None, db: Session = Depends(get_db)):
    query = db.query(SourceVeille)
    if contexte:
        query = query.filter(SourceVeille.contexte == contexte)
    return query.order_by(SourceVeille.nom).all()


@router.post("", response_model=SourceVeilleOut, status_code=201)
def creer_source(source: SourceVeilleCreate, db: Session = Depends(get_db)):
    _valider_domaine_source(db, source.domaine_id, source.contexte)
    obj = SourceVeille(**source.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{source_id}", response_model=SourceVeilleOut)
def modifier_source(source_id: int, source: SourceVeilleUpdate, db: Session = Depends(get_db)):
    obj = db.get(SourceVeille, source_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Source introuvable")
    champs = source.model_dump(exclude_unset=True)
    domaine_id_final = champs.get("domaine_id", obj.domaine_id)
    contexte_final = champs.get("contexte", obj.contexte)
    _valider_domaine_source(db, domaine_id_final, contexte_final)
    for champ, valeur in champs.items():
        setattr(obj, champ, valeur)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{source_id}", status_code=204)
def supprimer_source(source_id: int, db: Session = Depends(get_db)):
    obj = db.get(SourceVeille, source_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Source introuvable")
    db.delete(obj)
    db.commit()
