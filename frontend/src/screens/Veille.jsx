import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { DomainBadges } from "../components/DomainBadge.jsx";
import Switch from "../components/Switch.jsx";
import { IconArrowRight, IconBookmark, IconIgnore, IconLoop, IconTrash } from "../components/Icons.jsx";
import { domainHue } from "../utils/domainHue.js";
import { formatDate } from "../utils/formatDate.js";

// Un item de veille vient d'un flux RSS tiers, pas d'une saisie de l'utilisateur — un
// flux compromis pourrait fournir un lien "javascript:" au lieu d'une URL, que React
// insère tel quel dans href (seul un avertissement console, pas de blocage).
function urlHttpSure(url) {
  return /^https?:\/\//i.test(url || "") ? url : null;
}

function prochaineEcheance() {
  const maintenant = new Date();
  const echeances = [7, 20].map((heure) => {
    const d = new Date(maintenant);
    d.setHours(heure, 0, 0, 0);
    if (d <= maintenant) d.setDate(d.getDate() + 1);
    return d;
  });
  return echeances.sort((a, b) => a - b)[0];
}

export default function Veille({ contexte }) {
  const [items, setItems] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [collecteEnCours, setCollecteEnCours] = useState(false);

  const [domaines, setDomaines] = useState([]);
  const [domainesFiltre, setDomainesFiltre] = useState(new Set());

  const [panneauSourcesOuvert, setPanneauSourcesOuvert] = useState(false);
  const [sources, setSources] = useState(null);
  const [tousDomaines, setTousDomaines] = useState([]);
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouvelleUrl, setNouvelleUrl] = useState("");
  const [nouveauContexte, setNouveauContexte] = useState(contexte);
  const [nouveauDomaine, setNouveauDomaine] = useState("");

  useEffect(() => {
    setDomainesFiltre(new Set());
    setItems(null); // change de contexte : on ne veut pas montrer un instant les items de l'autre contexte
    charger();
    api.getDomaines(contexte, "veille").then(setDomaines).catch((e) => setErreur(e.message));
  }, [contexte]);

  // Rafraîchit l'affichage à 7h et 20h (tant que l'écran reste ouvert) pour faire
  // apparaître les nouveaux items ingérés côté serveur par le workflow planifié.
  useEffect(() => {
    let minuteur;
    function planifier() {
      const delai = prochaineEcheance() - new Date();
      minuteur = setTimeout(() => {
        charger();
        planifier();
      }, delai);
    }
    planifier();
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contexte]);

  // Filet de sécurité : sur mobile/PWA, un setTimeout programmé des heures à l'avance
  // est throttlé ou suspendu quand l'onglet est en arrière-plan et peut rater son
  // échéance. Un retour au premier plan redéclenche donc aussi le chargement.
  useEffect(() => {
    function surVisible() {
      if (document.visibilityState === "visible") charger();
    }
    document.addEventListener("visibilitychange", surVisible);
    return () => document.removeEventListener("visibilitychange", surVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contexte]);

  useEffect(() => {
    setNouveauContexte(contexte);
    if (panneauSourcesOuvert) {
      chargerSources();
      api.getDomaines(undefined, "veille").then(setTousDomaines).catch((e) => setErreur(e.message));
    }
  }, [contexte, panneauSourcesOuvert]);

  // items reste tel quel pendant le fetch (pas de setItems(null) ici) : un rechargement
  // en arrière-plan (minuteur, retour au premier plan, action, bouton) ne doit pas faire
  // disparaître la liste affichée le temps de la requête. Seul le premier chargement d'un
  // contexte passe par l'état initial `null` (cf. useState ci-dessus) et affiche "Chargement…".
  function charger() {
    api
      .getVeille({ contexte, statut: "nouveau" })
      .then(setItems)
      .catch((e) => setErreur(e.message));
  }

  async function forcerCollecte() {
    if (collecteEnCours) return;
    setCollecteEnCours(true);
    try {
      await api.rafraichirVeille(contexte);
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setCollecteEnCours(false);
    }
  }

  function chargerSources() {
    api.getSourcesVeille(contexte).then(setSources).catch((e) => setErreur(e.message));
  }

  async function agir(item, action) {
    try {
      await api.agirVeille(item.id, action);
      // Retrait local plutôt que charger() : l'item quitte de toute façon la liste
      // (filtrée sur statut "nouveau"), pas besoin d'un aller-retour serveur pour ça.
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      setErreur(err.message);
    }
  }

  function basculerFiltreDomaine(domaineId) {
    setDomainesFiltre((s) => {
      const nouveau = new Set(s);
      if (nouveau.has(domaineId)) nouveau.delete(domaineId);
      else nouveau.add(domaineId);
      return nouveau;
    });
  }

  async function ajouterSource(e) {
    e.preventDefault();
    if (!nouveauNom.trim() || !nouvelleUrl.trim()) return;
    try {
      await api.creerSourceVeille({
        nom: nouveauNom.trim(),
        url: nouvelleUrl.trim(),
        contexte: nouveauContexte,
        domaine_id: nouveauDomaine ? Number(nouveauDomaine) : null,
      });
      setNouveauNom("");
      setNouvelleUrl("");
      setNouveauDomaine("");
      chargerSources();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function basculerActif(source) {
    try {
      await api.modifierSourceVeille(source.id, { actif: !source.actif });
      chargerSources();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function changerDomaineSource(source, domaineId) {
    try {
      await api.modifierSourceVeille(source.id, { domaine_id: domaineId ? Number(domaineId) : null });
      chargerSources();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimerSource(source) {
    if (!window.confirm(`Supprimer la source « ${source.nom} » ?`)) return;
    try {
      await api.supprimerSourceVeille(source.id);
      chargerSources();
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (erreur) return <p className="tnv-error">{erreur}</p>;
  if (!items) return <p className="tnv-empty">Chargement…</p>;

  const itemsFiltres =
    domainesFiltre.size === 0 ? items : items.filter((item) => item.domaines.some((d) => domainesFiltre.has(d.id)));

  // Un item peut porter plusieurs domaines : il apparaît dans chacun des groupes correspondants.
  const parDomaine = itemsFiltres.reduce((acc, item) => {
    for (const d of item.domaines) {
      acc[d.nom] = acc[d.nom] || [];
      acc[d.nom].push(item);
    }
    return acc;
  }, {});

  return (
    <div className="tnv-screen">
      <div className="tnv-screen-head">
        <div>
          <p className="tnv-eyebrow">{contexte === "pro" ? "Espace professionnel" : "Espace personnel"}</p>
          <h1 className="tnv-h1">Veille</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="tnv-icon-btn"
            onClick={forcerCollecte}
            disabled={collecteEnCours}
            title="Lancer une collecte immédiate"
            aria-label="Lancer une collecte immédiate"
          >
            <span className={collecteEnCours ? "tnv-spin" : undefined}>
              <IconLoop size={18} />
            </span>
          </button>
          <button className="tnv-btn tnv-btn--secondary" onClick={() => setPanneauSourcesOuvert(true)}>
            ⚙ Sources
          </button>
        </div>
      </div>

      {domaines.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {domaines.map((d) => (
            <button
              key={d.id}
              className={domainesFiltre.has(d.id) ? "tnv-chip tnv-chip--active" : "tnv-chip"}
              onClick={() => basculerFiltreDomaine(d.id)}
            >
              {d.nom}
            </button>
          ))}
          {domainesFiltre.size > 0 && (
            <button className="tnv-chip" onClick={() => setDomainesFiltre(new Set())}>
              ✕ Filtre
            </button>
          )}
        </div>
      )}

      {Object.keys(parDomaine).length === 0 && <p className="tnv-empty">Aucun item de veille à traiter.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {Object.entries(parDomaine).map(([domaine, itemsDomaine]) => (
          <div key={domaine}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span className="tnv-dot" style={{ "--domain-hue": domainHue(domaine) }} />
              <span className="tnv-section-label">{domaine}</span>
            </div>
            <div className="tnv-stack" style={{ marginBottom: 0 }}>
              {itemsDomaine.map((item) => (
                <article key={item.id} className="tnv-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {urlHttpSure(item.url) ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="tnv-task-card__title"
                      style={{ color: "var(--tnv-text)" }}
                    >
                      {item.titre}
                    </a>
                  ) : (
                    <span className="tnv-task-card__title">{item.titre}</span>
                  )}
                  {item.domaines.length > 1 && (
                    <div className="tnv-task-card__meta">
                      <DomainBadges domaines={item.domaines} />
                    </div>
                  )}
                  {item.apercu && <p className="tnv-meta-text">{item.apercu}</p>}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      {urlHttpSure(item.url) ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="tnv-meta-text tnv-meta-text--url">
                          {item.source || item.url}
                        </a>
                      ) : (
                        <span className="tnv-meta-text tnv-meta-text--url">{item.source || item.url}</span>
                      )}
                      <span className="tnv-meta-text">{formatDate(item.date_publication || item.date_ingestion)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 2 }}>
                      <button className="tnv-icon-btn" onClick={() => agir(item, "ignorer")} title="Ignorer" aria-label="Ignorer">
                        <IconIgnore size={18} />
                      </button>
                      <button
                        className="tnv-icon-btn tnv-icon-btn--active"
                        onClick={() => agir(item, "garder_lecture")}
                        title="Garder pour lecture"
                        aria-label="Garder pour lecture"
                      >
                        <IconBookmark size={18} />
                      </button>
                      <button
                        className="tnv-icon-btn"
                        style={{ color: "var(--tnv-success)" }}
                        onClick={() => agir(item, "transformer_tache")}
                        title="Transformer en tâche"
                        aria-label="Transformer en tâche"
                      >
                        <IconArrowRight size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>

      {panneauSourcesOuvert && (
        <div className="tnv-overlay tnv-modal-center" onClick={() => setPanneauSourcesOuvert(false)}>
          <div className="tnv-sheet__panel tnv-sheet__panel--floating" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "80%", overflow: "auto" }}>
            <div className="tnv-sheet__header-sticky">
              <span className="tnv-sheet__title">Sources de veille</span>
              <button
                className="tnv-icon-btn"
                onClick={() => setPanneauSourcesOuvert(false)}
                title="Fermer"
                aria-label="Fermer"
              >
                <IconIgnore size={16} />
              </button>
            </div>
            <p className="tnv-sheet__subtitle">
              Flux RSS/Atom interrogés automatiquement pour alimenter la veille de ce contexte. Une source doit
              avoir un domaine assigné pour être collectée.
            </p>

            <form className="tnv-form" onSubmit={ajouterSource} style={{ margin: 0 }}>
              <input
                className="tnv-input"
                type="text"
                placeholder="Nom de la source"
                value={nouveauNom}
                onChange={(e) => setNouveauNom(e.target.value)}
              />
              <input
                className="tnv-input"
                type="url"
                placeholder="URL du flux RSS/Atom"
                value={nouvelleUrl}
                onChange={(e) => setNouvelleUrl(e.target.value)}
              />
              <select className="tnv-select" value={nouveauContexte} onChange={(e) => setNouveauContexte(e.target.value)}>
                <option value="pro">Pro</option>
                <option value="perso">Perso</option>
              </select>
              <select className="tnv-select" value={nouveauDomaine} onChange={(e) => setNouveauDomaine(e.target.value)}>
                <option value="">Sans domaine (ne sera pas collectée)</option>
                {tousDomaines
                  .filter((d) => d.contexte === nouveauContexte || d.contexte === "les_deux")
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nom}
                    </option>
                  ))}
              </select>
              <button type="submit" className="tnv-btn tnv-btn--primary">
                + Source
              </button>
            </form>

            {!sources && <p className="tnv-empty">Chargement…</p>}
            {sources && sources.length === 0 && <p className="tnv-empty">Aucune source pour ce contexte.</p>}
            {sources && sources.length > 0 && (
              <div className="tnv-stack" style={{ marginBottom: 0 }}>
                {sources.map((s) => (
                  <div
                    key={s.id}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--tnv-hairline)", flexWrap: "wrap" }}
                  >
                    <div style={{ flex: 1, minWidth: 140, opacity: s.actif ? 1 : 0.5 }}>
                      <div className="tnv-task-card__title" style={{ fontSize: "var(--tnv-size-body)" }}>{s.nom}</div>
                      <a href={s.url} target="_blank" rel="noreferrer" className="tnv-meta-text tnv-meta-text--url">
                        {s.url}
                      </a>
                    </div>
                    <select
                      className="tnv-select"
                      style={{ width: "auto", minHeight: 36, padding: "6px 10px" }}
                      value={s.domaine_id || ""}
                      onChange={(e) => changerDomaineSource(s, e.target.value)}
                    >
                      <option value="">Sans domaine</option>
                      {tousDomaines
                        .filter((d) => d.contexte === s.contexte || d.contexte === "les_deux")
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nom}
                          </option>
                        ))}
                    </select>
                    <Switch checked={s.actif} onChange={() => basculerActif(s)} label={s.actif ? "Désactiver" : "Activer"} />
                    <button className="tnv-icon-btn" onClick={() => supprimerSource(s)} title="Supprimer" aria-label="Supprimer">
                      <IconTrash size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button className="tnv-btn tnv-btn--ghost" onClick={() => setPanneauSourcesOuvert(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
