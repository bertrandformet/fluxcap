from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import Base, engine
from app.routers import domaines, jour, notes, parametres, sources_veille, taches, veille

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Tâches, Notes & Veille — API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(domaines.router)
app.include_router(taches.router)
app.include_router(veille.router)
app.include_router(notes.router)
app.include_router(jour.router)
app.include_router(parametres.router)
app.include_router(sources_veille.router)


@app.get("/health")
def health():
    return {"status": "ok"}
