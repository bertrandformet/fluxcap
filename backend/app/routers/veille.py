from datetime import datetime

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Contexte, Domaine, Note, Priorite, SourceNote, StatutVeille, Tache, VeilleItem
from app.schemas import VeilleAction, VeilleItemCreate, VeilleItemOut

router = APIRouter(prefix="/veille", tags=["veille"])


@router.get("", response_model=list[VeilleItemOut])
def lister_veille(
    contexte: Optional[Contexte] = None,
    statut: Optional[StatutVeille] = None,
    domaine_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(VeilleItem).join(Domaine)
    if contexte:
        query = query.filter(Domaine.contexte == contexte)
    if statut:
        query = query.filter(VeilleItem.statut == statut)
    if domaine_id:
        query = query.filter(VeilleItem.domaine_id == domaine_id)
    return query.order_by(VeilleItem.date_ingestion.desc()).all()


@router.post("", response_model=VeilleItemOut, status_code=201)
def creer_item_veille(item: VeilleItemCreate, db: Session = Depends(get_db)):
    if not db.get(Domaine, item.domaine_id):
        raise HTTPException(status_code=400, detail="Domaine inconnu")
    obj = VeilleItem(**item.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{item_id}/action", response_model=VeilleItemOut)
def agir_sur_item(item_id: int, action: VeilleAction, db: Session = Depends(get_db)):
    item = db.get(VeilleItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item de veille introuvable")
    if item.statut != StatutVeille.nouveau:
        raise HTTPException(status_code=400, detail="Cet item a déjà été traité")

    if action.action == "ignorer":
        item.statut = StatutVeille.ignore

    elif action.action == "garder_lecture":
        note = Note(titre=item.titre, url=item.url, domaine_id=item.domaine_id, source=SourceNote.veille)
        db.add(note)
        db.flush()
        item.statut = StatutVeille.garde_lecture
        item.note_generee_id = note.id

    elif action.action == "transformer_tache":
        tache = Tache(
            titre=item.titre,
            domaine_id=item.domaine_id,
            priorite=Priorite.un_jour,
            derniere_interaction=datetime.utcnow(),
        )
        db.add(tache)
        db.flush()
        item.statut = StatutVeille.transforme_tache
        item.tache_generee_id = tache.id

    else:
        raise HTTPException(status_code=400, detail="Action inconnue")

    db.commit()
    db.refresh(item)
    return item
