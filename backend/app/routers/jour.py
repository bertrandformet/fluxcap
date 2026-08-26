from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Contexte, Domaine, SelectionJour, StatutVeille, VeilleItem
from app.schemas import DecisionAction, JourOut, SelectionJourOut
from app.services.selection_jour import appliquer_decision, obtenir_ou_construire_selection

router = APIRouter(prefix="/jour", tags=["jour"])


@router.get("/{contexte}", response_model=JourOut)
def obtenir_jour(contexte: Literal["pro", "perso"], db: Session = Depends(get_db)):
    aujourdhui = date.today()
    selection = obtenir_ou_construire_selection(db, contexte, aujourdhui)
    veille = (
        db.query(VeilleItem)
        .join(VeilleItem.domaines)
        .filter(Domaine.contexte.in_([contexte, Contexte.les_deux]), VeilleItem.statut == StatutVeille.nouveau)
        .distinct()
        .order_by(VeilleItem.date_ingestion.desc())
        .options(selectinload(VeilleItem.domaines))
        .all()
    )
    return JourOut(
        date=aujourdhui,
        contexte=contexte,
        selection=selection,
        veille_a_traiter=veille,
    )


@router.post("/{contexte}/cloture/{selection_id}", response_model=SelectionJourOut)
def cloturer_tache(contexte: Literal["pro", "perso"], selection_id: int, decision: DecisionAction, db: Session = Depends(get_db)):
    selection = db.get(SelectionJour, selection_id)
    if not selection or selection.contexte != contexte:
        raise HTTPException(status_code=404, detail="Sélection introuvable")
    try:
        appliquer_decision(db, selection, decision, date.today())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.refresh(selection)
    return selection
