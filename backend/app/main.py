from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import Base, engine
from app.routers import auth, domaines, jour, notes, parametres, sources_veille, taches, veille
from app.services.securite import exiger_authentification

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Tâches, Notes & Veille — API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# /auth reste public (login, premier réglage). Tout le reste exige une session valide.
app.include_router(auth.router)

_protegee = [Depends(exiger_authentification)]
app.include_router(domaines.router, dependencies=_protegee)
app.include_router(taches.router, dependencies=_protegee)
app.include_router(veille.router, dependencies=_protegee)
app.include_router(notes.router, dependencies=_protegee)
app.include_router(jour.router, dependencies=_protegee)
app.include_router(parametres.router, dependencies=_protegee)
app.include_router(sources_veille.router, dependencies=_protegee)


@app.get("/health")
def health():
    return {"status": "ok"}
