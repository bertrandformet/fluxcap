import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Tables d'association many-to-many : une tâche/note/item de veille peut porter plusieurs
# domaines (contrainte : tous du même contexte Pro/Perso, imposée côté routers, pas en base).
tache_domaines = Table(
    "tache_domaines",
    Base.metadata,
    Column("tache_id", ForeignKey("taches.id", ondelete="CASCADE"), primary_key=True),
    Column("domaine_id", ForeignKey("domaines.id", ondelete="CASCADE"), primary_key=True),
)

note_domaines = Table(
    "note_domaines",
    Base.metadata,
    Column("note_id", ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True),
    Column("domaine_id", ForeignKey("domaines.id", ondelete="CASCADE"), primary_key=True),
)

veille_item_domaines = Table(
    "veille_item_domaines",
    Base.metadata,
    Column("veille_item_id", ForeignKey("veille_items.id", ondelete="CASCADE"), primary_key=True),
    Column("domaine_id", ForeignKey("domaines.id", ondelete="CASCADE"), primary_key=True),
)


class Contexte(str, enum.Enum):
    pro = "pro"
    perso = "perso"
    # Réservé à Domaine.contexte (un domaine partagé entre les deux espaces) — jamais
    # une valeur valide pour un item concret (tâche/note/veille/source), qui reste
    # toujours résolu à pro OU perso. Voir domaines_utils.resoudre_domaines.
    les_deux = "les_deux"


class Priorite(str, enum.Enum):
    un_jour = "un_jour"
    cette_semaine = "cette_semaine"
    aujourd_hui = "aujourd_hui"


class StatutTache(str, enum.Enum):
    a_realiser = "a_realiser"
    realise = "realise"
    abandonne = "abandonne"


class RaisonSelection(str, enum.Enum):
    score = "score"
    epingle = "epingle"
    report_remonte = "report_remonte"
    anti_oubli = "anti_oubli"
    remontee_auto = "remontee_auto"
    recurrente = "recurrente"


class StatutJour(str, enum.Enum):
    en_attente = "en_attente"
    realise = "realise"
    reporte = "reporte"
    abandonne = "abandonne"


class StatutVeille(str, enum.Enum):
    nouveau = "nouveau"
    ignore = "ignore"
    garde_lecture = "garde_lecture"
    transforme_tache = "transforme_tache"


class SourceNote(str, enum.Enum):
    manuel = "manuel"
    veille = "veille"


class Domaine(Base):
    __tablename__ = "domaines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nom: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    contexte: Mapped[Contexte] = mapped_column(Enum(Contexte), nullable=False)

    # Un domaine n'a pas forcément de sens partout (ex. un sujet de veille large
    # n'est pas une catégorie de tâche actionnable) — ces flags filtrent les
    # sélecteurs de domaine côté tâches/veille sans dupliquer la liste.
    utilise_pour_taches: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    utilise_pour_veille: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    taches: Mapped[list["Tache"]] = relationship(secondary=tache_domaines, back_populates="domaines")
    veille_items: Mapped[list["VeilleItem"]] = relationship(secondary=veille_item_domaines, back_populates="domaines")
    notes: Mapped[list["Note"]] = relationship(secondary=note_domaines, back_populates="domaines")


class Tache(Base):
    __tablename__ = "taches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    titre: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="standard")
    priorite: Mapped[Priorite] = mapped_column(Enum(Priorite), nullable=False, default=Priorite.un_jour)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    date_fin: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    date_evenement: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    delai_preparation_jours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    statut: Mapped[StatutTache] = mapped_column(Enum(StatutTache), nullable=False, default=StatutTache.a_realiser)
    epinglee: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recurrente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # En heure locale (pas UTC) : comparé à `date.today()` dans le calcul de la sélection
    # du jour (seuil anti-oubli), qui raisonne lui aussi en date locale.
    derniere_interaction: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    cree_le: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    domaines: Mapped[list["Domaine"]] = relationship(secondary=tache_domaines, back_populates="taches")
    sous_taches: Mapped[list["SousTache"]] = relationship(back_populates="tache", cascade="all, delete-orphan")
    jalons: Mapped[list["Jalon"]] = relationship(back_populates="tache", cascade="all, delete-orphan")
    historique_reports: Mapped[list["HistoriqueReport"]] = relationship(
        back_populates="tache", cascade="all, delete-orphan"
    )


class SousTache(Base):
    __tablename__ = "sous_taches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tache_id: Mapped[int] = mapped_column(ForeignKey("taches.id"), nullable=False)
    titre: Mapped[str] = mapped_column(String(255), nullable=False)
    fait: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ordre: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    tache: Mapped["Tache"] = relationship(back_populates="sous_taches")


class Jalon(Base):
    __tablename__ = "jalons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tache_id: Mapped[int] = mapped_column(ForeignKey("taches.id"), nullable=False)
    titre: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    fait: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    tache: Mapped["Tache"] = relationship(back_populates="jalons")


class HistoriqueReport(Base):
    __tablename__ = "historique_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tache_id: Mapped[int] = mapped_column(ForeignKey("taches.id"), nullable=False)
    date_evenement: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    ancienne_echeance: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    nouvelle_echeance: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    raison: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    tache: Mapped["Tache"] = relationship(back_populates="historique_reports")


class SelectionJour(Base):
    __tablename__ = "selection_jour"
    __table_args__ = (UniqueConstraint("date", "contexte", "tache_id", name="uq_selection_jour_date_contexte_tache"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    contexte: Mapped[Contexte] = mapped_column(Enum(Contexte), nullable=False)
    tache_id: Mapped[int] = mapped_column(ForeignKey("taches.id"), nullable=False)
    raison_selection: Mapped[RaisonSelection] = mapped_column(Enum(RaisonSelection), nullable=False)
    statut_jour: Mapped[StatutJour] = mapped_column(Enum(StatutJour), nullable=False, default=StatutJour.en_attente)

    tache: Mapped["Tache"] = relationship()


class VeilleItem(Base):
    __tablename__ = "veille_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    titre: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    apercu: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    date_ingestion: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    # Date de publication d'origine fournie par le flux RSS/Atom (nullable : certains flux
    # ne l'exposent pas). Affichée en priorité sur date_ingestion, qui reste le seul horodatage
    # fiable à 100% (date de collecte par notre serveur) mais n'a pas de sens éditorial.
    date_publication: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    statut: Mapped[StatutVeille] = mapped_column(Enum(StatutVeille), nullable=False, default=StatutVeille.nouveau)
    tache_generee_id: Mapped[Optional[int]] = mapped_column(ForeignKey("taches.id"), nullable=True)
    note_generee_id: Mapped[Optional[int]] = mapped_column(ForeignKey("notes.id"), nullable=True)

    domaines: Mapped[list["Domaine"]] = relationship(secondary=veille_item_domaines, back_populates="veille_items")


class SourceVeille(Base):
    """Source à interroger pour l'ingestion de veille (flux RSS/Atom uniquement).

    domaine_id : nullable pour ne pas casser les sources existantes déjà créées avant
    l'ajout de ce champ, mais requis en pratique pour que l'ingestion sache où ranger
    les items — une source sans domaine est ignorée par l'ingestion (voir
    app/services/ingestion_veille.py).
    """

    __tablename__ = "sources_veille"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nom: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    contexte: Mapped[Contexte] = mapped_column(Enum(Contexte), nullable=False)
    domaine_id: Mapped[Optional[int]] = mapped_column(ForeignKey("domaines.id"), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    cree_le: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    domaine: Mapped[Optional["Domaine"]] = relationship()


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    titre: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    apercu: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contenu: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[SourceNote] = mapped_column(Enum(SourceNote), nullable=False, default=SourceNote.manuel)
    cree_le: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    domaines: Mapped[list["Domaine"]] = relationship(secondary=note_domaines, back_populates="notes")
    pieces_jointes: Mapped[list["PieceJointe"]] = relationship(back_populates="note", cascade="all, delete-orphan")


class PieceJointe(Base):
    __tablename__ = "pieces_jointes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes.id"), nullable=False)
    nom_original: Mapped[str] = mapped_column(String(255), nullable=False)
    nom_stocke: Mapped[str] = mapped_column(String(255), nullable=False)
    type_mime: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    taille_octets: Mapped[int] = mapped_column(Integer, nullable=False)
    cree_le: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    note: Mapped["Note"] = relationship(back_populates="pieces_jointes")


class Parametres(Base):
    """Ligne unique de réglages globaux de l'application (id=1)."""

    __tablename__ = "parametres"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conges_actif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Utilisateur(Base):
    """Ligne unique représentant le propriétaire de l'app (id=1) — pas de multi-utilisateur,
    juste une porte d'entrée protégée par mot de passe et/ou WebAuthn."""

    __tablename__ = "utilisateurs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mot_de_passe_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cree_le: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    # Anti-bruteforce sur /auth/login (voir app/routers/auth.py)
    tentatives_echouees: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    verrouille_jusqu_a: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Code de récupération à usage unique (regénéré à chaque utilisation), affiché en
    # clair une seule fois au client — seul son hash est conservé.
    code_recuperation_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Incrémenté pour invalider tous les jetons JWT émis jusque-là (déconnexion partout) —
    # chaque jeton embarque la version en cours au moment de son émission, comparée à
    # celle-ci à chaque requête authentifiée.
    session_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Clé API longue durée (raccourcis externes, scripts...) — indépendante des sessions
    # JWT, n'expire jamais, révocable en la régénérant. Voir app/routers/auth.py.
    cle_api_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    identifiants_webauthn: Mapped[list["IdentifiantWebauthn"]] = relationship(
        back_populates="utilisateur", cascade="all, delete-orphan"
    )


class IdentifiantWebauthn(Base):
    """Une clé d'accès enregistrée (Face ID, Touch ID, clé de sécurité...) — un utilisateur
    peut en enregistrer plusieurs (un par appareil)."""

    __tablename__ = "identifiants_webauthn"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    utilisateur_id: Mapped[int] = mapped_column(ForeignKey("utilisateurs.id"), nullable=False)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    credential_id: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    cle_publique: Mapped[str] = mapped_column(Text, nullable=False)
    compteur_signature: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cree_le: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    utilisateur: Mapped["Utilisateur"] = relationship(back_populates="identifiants_webauthn")


class DefiWebauthn(Base):
    """Challenge temporaire à usage unique émis pendant une cérémonie WebAuthn
    (inscription ou authentification), consommé puis supprimé à la vérification."""

    __tablename__ = "defis_webauthn"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    defi: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # "inscription" | "authentification"
    cree_le: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
