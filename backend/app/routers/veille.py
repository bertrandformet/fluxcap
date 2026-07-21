from datetime import datetime

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Contexte, Domaine, Note, Priorite, SourceNote, StatutVeille, Tache, VeilleItem
from app.schemas import VeilleAction, VeilleItemCreate, VeilleItemOut
from app.services.domaines_utils import resoudre_domaines

router = APIRouter(prefix="/veille", tags=["veille"])


@router.get("", response_model=list[VeilleItemOut])
def lister_veille(
    contexte: Optional[Literal["pro", "perso"]] = None,
    statut: Optional[StatutVeille] = None,
    domaine_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(VeilleItem)
    if contexte:
        query = query.join(VeilleItem.domaines).filter(Domaine.contexte.in_([contexte, Contexte.les_deux]))
    if statut:
        query = query.filter(VeilleItem.statut == statut)
    if domaine_id:
        query = query.filter(VeilleItem.domaines.any(Domaine.id == domaine_id))
    return query.distinct().order_by(VeilleItem.date_ingestion.desc()).all()


@router.post("", response_model=VeilleItemOut, status_code=201)
def creer_item_veille(item: VeilleItemCreate, db: Session = Depends(get_db)):
    if not item.domaine_ids:
        raise HTTPException(status_code=400, detail="Au moins un domaine est requis")
    try:
        domaines = resoudre_domaines(db, item.domaine_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    obj = VeilleItem(**item.model_dump(exclude={"domaine_ids"}))
    obj.domaines = domaines
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
        note = Note(titre=item.titre, url=item.url, source=SourceNote.veille)
        note.domaines = list(item.domaines)
        db.add(note)
        db.flush()
        item.statut = StatutVeille.garde_lecture
        item.note_generee_id = note.id

    elif action.action == "transformer_tache":
        domaines_taches = [d for d in item.domaines if d.utilise_pour_taches]
        if not domaines_taches:
            raise HTTPException(
                status_code=400, detail="Aucun des domaines de cet item n'est utilisable pour une tâche"
            )
        description = f"{item.apercu}\n\n{item.url}" if item.apercu else item.url
        tache = Tache(
            titre=item.titre,
            priorite=Priorite.un_jour,
            description=description,
            derniere_interaction=datetime.now(),
        )
        tache.domaines = domaines_taches
        db.add(tache)
        db.flush()
        item.statut = StatutVeille.transforme_tache
        item.tache_generee_id = tache.id

    else:
        raise HTTPException(status_code=400, detail="Action inconnue")

    db.commit()
    db.refresh(item)
    return item
