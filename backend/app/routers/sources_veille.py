from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Contexte, SourceVeille
from app.schemas import SourceVeilleCreate, SourceVeilleOut, SourceVeilleUpdate

router = APIRouter(prefix="/sources-veille", tags=["sources-veille"])


@router.get("", response_model=list[SourceVeilleOut])
def lister_sources(contexte: Optional[Contexte] = None, db: Session = Depends(get_db)):
    query = db.query(SourceVeille)
    if contexte:
        query = query.filter(SourceVeille.contexte == contexte)
    return query.order_by(SourceVeille.nom).all()


@router.post("", response_model=SourceVeilleOut, status_code=201)
def creer_source(source: SourceVeilleCreate, db: Session = Depends(get_db)):
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
    for champ, valeur in source.model_dump(exclude_unset=True).items():
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
