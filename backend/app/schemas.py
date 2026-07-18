from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models import (
    Contexte,
    Priorite,
    RaisonSelection,
    SourceNote,
    StatutJour,
    StatutTache,
    StatutVeille,
)


# --- Domaines ---


class DomaineBase(BaseModel):
    nom: str
    contexte: Contexte
    utilise_pour_taches: bool = True
    utilise_pour_veille: bool = True


class DomaineCreate(DomaineBase):
    pass


class DomaineUpdate(BaseModel):
    nom: Optional[str] = None
    contexte: Optional[Contexte] = None
    utilise_pour_taches: Optional[bool] = None
    utilise_pour_veille: Optional[bool] = None


class DomaineOut(DomaineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# --- Sous-tâches ---


class SousTacheBase(BaseModel):
    titre: str
    fait: bool = False
    ordre: int = 0


class SousTacheCreate(SousTacheBase):
    pass


class SousTacheOut(SousTacheBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# --- Jalons ---


class JalonBase(BaseModel):
    titre: str
    date: date
    fait: bool = False


class JalonCreate(JalonBase):
    pass


class JalonOut(JalonBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# --- Historique de report ---


class HistoriqueReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    date_evenement: datetime
    ancienne_echeance: Optional[date]
    nouvelle_echeance: Optional[date]
    raison: Optional[str]


# --- Tâches ---


class TacheBase(BaseModel):
    titre: str
    domaine_id: int
    type: str = "standard"
    priorite: Priorite = Priorite.un_jour
    description: Optional[str] = None
    date_fin: Optional[date] = None
    date_evenement: Optional[date] = None
    delai_preparation_jours: Optional[int] = None
    epinglee: bool = False
    recurrente: bool = False


class TacheCreate(TacheBase):
    pass


class TacheUpdate(BaseModel):
    titre: Optional[str] = None
    domaine_id: Optional[int] = None
    type: Optional[str] = None
    priorite: Optional[Priorite] = None
    description: Optional[str] = None
    date_fin: Optional[date] = None
    date_evenement: Optional[date] = None
    delai_preparation_jours: Optional[int] = None
    statut: Optional[StatutTache] = None
    epinglee: Optional[bool] = None
    recurrente: Optional[bool] = None


class TacheOut(TacheBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    statut: StatutTache
    derniere_interaction: datetime
    cree_le: datetime
    domaine: DomaineOut
    sous_taches: list[SousTacheOut] = []
    jalons: list[JalonOut] = []
    historique_reports: list[HistoriqueReportOut] = []


# --- Sélection du jour / clôture ---


class SelectionJourOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    date: date
    contexte: Contexte
    raison_selection: RaisonSelection
    statut_jour: StatutJour
    tache: TacheOut


class DecisionAction(BaseModel):
    action: str  # "realiser" | "reporter_demain" | "reporter_date" | "abandonner" | "garder" | "reprioriser"
    nouvelle_date: Optional[date] = None
    nouvelle_priorite: Optional[Priorite] = None


# --- Veille ---


class VeilleItemBase(BaseModel):
    titre: str
    url: str
    apercu: Optional[str] = None
    domaine_id: int
    source: Optional[str] = None


class VeilleItemCreate(VeilleItemBase):
    pass


class VeilleItemOut(VeilleItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    date_ingestion: datetime
    statut: StatutVeille
    tache_generee_id: Optional[int]
    note_generee_id: Optional[int]
    domaine: DomaineOut


class VeilleAction(BaseModel):
    action: str  # "ignorer" | "garder_lecture" | "transformer_tache"


class SourceVeilleBase(BaseModel):
    nom: str
    url: str
    contexte: Contexte
    domaine_id: Optional[int] = None
    actif: bool = True


class SourceVeilleCreate(SourceVeilleBase):
    pass


class SourceVeilleUpdate(BaseModel):
    nom: Optional[str] = None
    url: Optional[str] = None
    contexte: Optional[Contexte] = None
    domaine_id: Optional[int] = None
    actif: Optional[bool] = None


class SourceVeilleOut(SourceVeilleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cree_le: datetime


# --- Notes ---


class NoteBase(BaseModel):
    titre: str
    url: Optional[str] = None
    apercu: Optional[str] = None
    contenu: Optional[str] = None
    domaine_id: Optional[int] = None


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    titre: Optional[str] = None
    url: Optional[str] = None
    apercu: Optional[str] = None
    contenu: Optional[str] = None
    domaine_id: Optional[int] = None


class PieceJointeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nom_original: str
    type_mime: Optional[str] = None
    taille_octets: int
    cree_le: datetime


class NoteOut(NoteBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source: SourceNote
    cree_le: datetime
    domaine: Optional[DomaineOut]
    pieces_jointes: list[PieceJointeOut] = []


# --- Écran "Aujourd'hui" ---


class JourOut(BaseModel):
    date: date
    contexte: Contexte
    selection: list[SelectionJourOut]
    veille_a_traiter: list[VeilleItemOut]


# --- Paramètres globaux ---


class ParametresOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    conges_actif: bool


class ParametresUpdate(BaseModel):
    conges_actif: bool
