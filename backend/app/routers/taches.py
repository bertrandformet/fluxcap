from datetime import datetime

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Contexte, Domaine, Jalon, SousTache, StatutTache, Tache
from app.schemas import (
    JalonCreate,
    JalonOut,
    SousTacheCreate,
    SousTacheOut,
    TacheCreate,
    TacheOut,
    TacheUpdate,
)

router = APIRouter(prefix="/taches", tags=["taches"])


@router.get("", response_model=list[TacheOut])
def lister_taches(
    contexte: Optional[Contexte] = None,
    statut: Optional[StatutTache] = None,
    domaine_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Tache).join(Domaine)
    if contexte:
        query = query.filter(Domaine.contexte == contexte)
    if statut:
        query = query.filter(Tache.statut == statut)
    if domaine_id:
        query = query.filter(Tache.domaine_id == domaine_id)
    return query.order_by(Tache.cree_le.desc()).all()


@router.get("/{tache_id}", response_model=TacheOut)
def obtenir_tache(tache_id: int, db: Session = Depends(get_db)):
    obj = db.get(Tache, tache_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    return obj


@router.post("", response_model=TacheOut, status_code=201)
def creer_tache(tache: TacheCreate, db: Session = Depends(get_db)):
    if not db.get(Domaine, tache.domaine_id):
        raise HTTPException(status_code=400, detail="Domaine inconnu")
    obj = Tache(**tache.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{tache_id}", response_model=TacheOut)
def modifier_tache(tache_id: int, tache: TacheUpdate, db: Session = Depends(get_db)):
    obj = db.get(Tache, tache_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    for champ, valeur in tache.model_dump(exclude_unset=True).items():
        setattr(obj, champ, valeur)
    obj.derniere_interaction = datetime.now()
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{tache_id}", status_code=204)
def supprimer_tache(tache_id: int, db: Session = Depends(get_db)):
    obj = db.get(Tache, tache_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    db.delete(obj)
    db.commit()


@router.post("/{tache_id}/sous-taches", response_model=SousTacheOut, status_code=201)
def ajouter_sous_tache(tache_id: int, sous_tache: SousTacheCreate, db: Session = Depends(get_db)):
    if not db.get(Tache, tache_id):
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    obj = SousTache(tache_id=tache_id, **sous_tache.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/sous-taches/{sous_tache_id}", response_model=SousTacheOut)
def basculer_sous_tache(sous_tache_id: int, fait: bool, db: Session = Depends(get_db)):
    obj = db.get(SousTache, sous_tache_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Sous-tâche introuvable")
    obj.fait = fait
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/sous-taches/{sous_tache_id}", status_code=204)
def supprimer_sous_tache(sous_tache_id: int, db: Session = Depends(get_db)):
    obj = db.get(SousTache, sous_tache_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Sous-tâche introuvable")
    db.delete(obj)
    db.commit()


@router.post("/{tache_id}/jalons", response_model=JalonOut, status_code=201)
def ajouter_jalon(tache_id: int, jalon: JalonCreate, db: Session = Depends(get_db)):
    if not db.get(Tache, tache_id):
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    obj = Jalon(tache_id=tache_id, **jalon.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/jalons/{jalon_id}", response_model=JalonOut)
def basculer_jalon(jalon_id: int, fait: bool, db: Session = Depends(get_db)):
    obj = db.get(Jalon, jalon_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Jalon introuvable")
    obj.fait = fait
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/jalons/{jalon_id}", status_code=204)
def supprimer_jalon(jalon_id: int, db: Session = Depends(get_db)):
    obj = db.get(Jalon, jalon_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Jalon introuvable")
    db.delete(obj)
    db.commit()
