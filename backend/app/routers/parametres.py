from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Parametres
from app.schemas import ParametresOut, ParametresUpdate

router = APIRouter(prefix="/parametres", tags=["parametres"])


def _obtenir_ou_creer(db: Session) -> Parametres:
    obj = db.get(Parametres, 1)
    if not obj:
        obj = Parametres(id=1, conges_actif=False)
        db.add(obj)
        db.commit()
        db.refresh(obj)
    return obj


@router.get("", response_model=ParametresOut)
def obtenir_parametres(db: Session = Depends(get_db)):
    return _obtenir_ou_creer(db)


@router.put("", response_model=ParametresOut)
def modifier_parametres(parametres: ParametresUpdate, db: Session = Depends(get_db)):
    obj = _obtenir_ou_creer(db)
    obj.conges_actif = parametres.conges_actif
    db.commit()
    db.refresh(obj)
    return obj
