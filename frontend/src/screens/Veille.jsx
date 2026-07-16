import { useEffect, useState } from "react";
import { api } from "../api/client.js";

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

  const [domaines, setDomaines] = useState([]);
  const [domainesFiltre, setDomainesFiltre] = useState(new Set());

  const [panneauSourcesOuvert, setPanneauSourcesOuvert] = useState(false);
  const [sources, setSources] = useState(null);
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouvelleUrl, setNouvelleUrl] = useState("");
  const [nouveauContexte, setNouveauContexte] = useState(contexte);

  useEffect(() => {
    setDomainesFiltre(new Set());
    charger();
    api.getDomaines(contexte).then(setDomaines).catch((e) => setErreur(e.message));
  }, [contexte]);

  // Actualisation automatique à 7h et 20h, tant que l'écran reste ouvert dans le navigateur.
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

  useEffect(() => {
    setNouveauContexte(contexte);
    if (panneauSourcesOuvert) chargerSources();
  }, [contexte, panneauSourcesOuvert]);

  function charger() {
    setItems(null);
    api
      .getVeille({ contexte, statut: "nouveau" })
      .then(setItems)
      .catch((e) => setErreur(e.message));
  }

  function chargerSources() {
    api.getSourcesVeille(contexte).then(setSources).catch((e) => setErreur(e.message));
  }

  async function agir(item, action) {
    await api.agirVeille(item.id, action);
    charger();
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
      await api.creerSourceVeille({ nom: nouveauNom.trim(), url: nouvelleUrl.trim(), contexte: nouveauContexte });
      setNouveauNom("");
      setNouvelleUrl("");
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

  async function supprimerSource(source) {
    if (!window.confirm(`Supprimer la source « ${source.nom} » ?`)) return;
    try {
      await api.supprimerSourceVeille(source.id);
      chargerSources();
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (erreur) return <p className="erreur">{erreur}</p>;
  if (!items) return <p>Chargement…</p>;

  const itemsFiltres =
    domainesFiltre.size === 0 ? items : items.filter((item) => domainesFiltre.has(item.domaine.id));

  const parDomaine = itemsFiltres.reduce((acc, item) => {
    const nom = item.domaine.nom;
    acc[nom] = acc[nom] || [];
    acc[nom].push(item);
    return acc;
  }, {});

  return (
    <section>
      <div className="entete-ecran">
        <h2>Veille</h2>
        <button onClick={() => setPanneauSourcesOuvert((o) => !o)}>{panneauSourcesOuvert ? "✕" : "⚙️ Sources"}</button>
      </div>

      {domaines.length > 0 && (
        <div className="filtre-domaines">
          <span>Filtrer :</span>
          {domaines.map((d) => (
            <label key={d.id} className="filtre-domaine-item">
              <input
                type="checkbox"
                checked={domainesFiltre.has(d.id)}
                onChange={() => basculerFiltreDomaine(d.id)}
              />
              {d.nom}
            </label>
          ))}
          {domainesFiltre.size > 0 && <button onClick={() => setDomainesFiltre(new Set())}>✕ Filtre</button>}
        </div>
      )}

      {panneauSourcesOuvert && (
        <div className="panneau-sources">
          <p className="explication">
            Sources interrogées pour alimenter la veille de ce contexte. La configuration est gérée ici ; la
            collecte automatisée elle-même (RSS, API, scraping) n'est pas exécutée dans ce POC.
          </p>

          <form className="import-lien" onSubmit={ajouterSource}>
            <input type="text" placeholder="Nom de la source" value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} />
            <input type="url" placeholder="URL" value={nouvelleUrl} onChange={(e) => setNouvelleUrl(e.target.value)} />
            <select value={nouveauContexte} onChange={(e) => setNouveauContexte(e.target.value)}>
              <option value="pro">Pro</option>
              <option value="perso">Perso</option>
            </select>
            <button type="submit">+ Source</button>
          </form>

          {!sources && <p>Chargement…</p>}
          {sources && sources.length === 0 && <p>Aucune source pour ce contexte.</p>}
          {sources && sources.length > 0 && (
            <ul className="domaine-list">
              {sources.map((s) => (
                <li key={s.id} className="domaine-item">
                  <span className={s.actif ? "" : "source-inactive"}>
                    {s.nom} — <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a>
                  </span>
                  <button className="bouton-icone" onClick={() => basculerActif(s)} title={s.actif ? "Désactiver" : "Activer"} aria-label={s.actif ? "Désactiver" : "Activer"}>
                    {s.actif ? "⏸" : "▶"}
                  </button>
                  <button className="bouton-icone" onClick={() => supprimerSource(s)} title="Supprimer" aria-label="Supprimer">
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {Object.keys(parDomaine).length === 0 && <p>Aucun item de veille à traiter.</p>}

      {Object.entries(parDomaine).map(([domaine, itemsDomaine]) => (
        <div key={domaine} className="veille-domaine">
          <h3>{domaine}</h3>
          <div className="task-list">
            {itemsDomaine.map((item) => (
              <article key={item.id} className="task-card">
                <div className="task-card-header">
                  <h3>{item.titre}</h3>
                </div>
                <p className="task-meta">
                  {item.domaine.nom}
                  {item.source && ` · ${item.source}`}
                </p>
                {item.apercu && <p className="task-description">{item.apercu}</p>}
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.url}
                </a>

                <div className="veille-actions">
                  <button className="bouton-icone" onClick={() => agir(item, "ignorer")} title="Ignorer" aria-label="Ignorer">
                    🗑
                  </button>
                  <button
                    className="bouton-icone"
                    onClick={() => agir(item, "garder_lecture")}
                    title="Garder pour lecture"
                    aria-label="Garder pour lecture"
                  >
                    📖
                  </button>
                  <button
                    className="bouton-icone"
                    onClick={() => agir(item, "transformer_tache")}
                    title="Transformer en tâche"
                    aria-label="Transformer en tâche"
                  >
                    →✅
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
