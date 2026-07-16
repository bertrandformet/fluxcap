import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import MarkdownToolbar from "../components/MarkdownToolbar.jsx";
import { rendreMarkdown } from "../utils/markdown.js";

function formatTaille(octets) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function Notes() {
  const [notes, setNotes] = useState(null);
  const [domaines, setDomaines] = useState([]);
  const [filtreDomaine, setFiltreDomaine] = useState("");
  const [erreur, setErreur] = useState(null);
  const [info, setInfo] = useState(null);

  const [lien, setLien] = useState("");
  const [titre, setTitre] = useState("");
  const [apercu, setApercu] = useState("");
  const [contenu, setContenu] = useState("");
  const [domaineImport, setDomaineImport] = useState("");
  const [fichiersAJoindre, setFichiersAJoindre] = useState([]);

  const [enEdition, setEnEdition] = useState(null);
  const [editionTitre, setEditionTitre] = useState("");
  const [editionUrl, setEditionUrl] = useState("");
  const [editionApercu, setEditionApercu] = useState("");
  const [editionContenu, setEditionContenu] = useState("");
  const [editionDomaine, setEditionDomaine] = useState("");

  const [transformees, setTransformees] = useState([]);

  const [modeSelection, setModeSelection] = useState(false);
  const [selection, setSelection] = useState(new Set());
  const [tagEnMasse, setTagEnMasse] = useState("");

  useEffect(() => {
    api.getDomaines().then(setDomaines).catch((e) => setErreur(e.message));
  }, []);

  useEffect(() => {
    charger();
  }, [filtreDomaine]);

  function charger() {
    setNotes(null);
    api.getNotes(filtreDomaine || undefined).then(setNotes).catch((e) => setErreur(e.message));
  }

  async function recupererApercu() {
    if (!lien) return;
    const data = await api.apercuLien(lien);
    setTitre((t) => t || data.titre);
    setApercu((a) => a || data.apercu);
  }

  async function ajouterNote(e) {
    e.preventDefault();
    if (!titre.trim() && !lien.trim()) return;
    try {
      const note = await api.creerNote({
        titre: titre || lien,
        url: lien || null,
        apercu: apercu || null,
        contenu: contenu || null,
        domaine_id: domaineImport ? Number(domaineImport) : null,
      });
      for (const fichier of fichiersAJoindre) {
        await api.ajouterPieceJointe(note.id, fichier);
      }
      setLien("");
      setTitre("");
      setApercu("");
      setContenu("");
      setDomaineImport("");
      setFichiersAJoindre([]);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  function commencerEdition(note) {
    setEnEdition(note.id);
    setEditionTitre(note.titre);
    setEditionUrl(note.url || "");
    setEditionApercu(note.apercu || "");
    setEditionContenu(note.contenu || "");
    setEditionDomaine(note.domaine_id || "");
  }

  async function enregistrerEdition(note) {
    try {
      await api.modifierNote(note.id, {
        titre: editionTitre,
        url: editionUrl || null,
        apercu: editionApercu || null,
        contenu: editionContenu || null,
        domaine_id: editionDomaine ? Number(editionDomaine) : null,
      });
      setEnEdition(null);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimer(note) {
    if (!window.confirm(`Supprimer la note « ${note.titre} » ?`)) return;
    try {
      await api.supprimerNote(note.id);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function transformerEnTache(note) {
    try {
      await api.noteVersTache(note.id);
      setTransformees((t) => [...t, note.id]);
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function exporter(note, format) {
    try {
      await api.exporterNote(note.id, format);
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function ajouterPieceJointe(note, fichierList) {
    try {
      for (const fichier of fichierList) {
        await api.ajouterPieceJointe(note.id, fichier);
      }
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimerPieceJointe(piece) {
    if (!window.confirm(`Supprimer la pièce jointe « ${piece.nom_original} » ?`)) return;
    try {
      await api.supprimerPieceJointe(piece.id);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  function basculerModeSelection() {
    setModeSelection((m) => !m);
    setSelection(new Set());
  }

  function basculerSelection(id) {
    setSelection((s) => {
      const nouveau = new Set(s);
      if (nouveau.has(id)) nouveau.delete(id);
      else nouveau.add(id);
      return nouveau;
    });
  }

  function toutSelectionner() {
    setSelection(new Set((notes || []).map((n) => n.id)));
  }

  async function supprimerSelection() {
    if (selection.size === 0) return;
    if (!window.confirm(`Supprimer les ${selection.size} note(s) sélectionnée(s) ?`)) return;
    try {
      await Promise.all([...selection].map((id) => api.supprimerNote(id)));
      setSelection(new Set());
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function appliquerTagEnMasse() {
    if (selection.size === 0 || !tagEnMasse) return;
    try {
      await Promise.all([...selection].map((id) => api.modifierNote(id, { domaine_id: Number(tagEnMasse) })));
      setTagEnMasse("");
      setSelection(new Set());
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function partagerSelection() {
    const selectionnees = (notes || []).filter((n) => selection.has(n.id));
    if (selectionnees.length === 0) return;
    const texte = selectionnees.map((n) => `${n.titre}${n.url ? ` — ${n.url}` : ""}`).join("\n");

    if (navigator.share) {
      try {
        if (selectionnees.length === 1 && selectionnees[0].url) {
          await navigator.share({
            title: selectionnees[0].titre,
            url: selectionnees[0].url,
            text: selectionnees[0].apercu || undefined,
          });
        } else {
          await navigator.share({ title: "Notes", text: texte });
        }
      } catch (err) {
        if (err.name !== "AbortError") setErreur(err.message);
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(texte);
      setInfo("Partage natif indisponible sur ce navigateur — contenu copié dans le presse-papiers.");
    } else {
      setErreur("Ni le partage natif ni le presse-papiers ne sont disponibles sur ce navigateur.");
    }
  }

  return (
    <section>
      <h2>Notes</h2>

      {erreur && <p className="erreur">{erreur}</p>}
      {info && <p className="info">{info}</p>}

      <form className="import-lien" onSubmit={ajouterNote}>
        <input
          type="url"
          placeholder="Coller un lien (optionnel)"
          value={lien}
          onChange={(e) => setLien(e.target.value)}
          onBlur={recupererApercu}
        />
        <input type="text" placeholder="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
        <textarea placeholder="Aperçu (court résumé)" value={apercu} onChange={(e) => setApercu(e.target.value)} />
        <MarkdownToolbar value={contenu} onChange={setContenu} placeholder="Écrire une note de texte…" />
        <select value={domaineImport} onChange={(e) => setDomaineImport(e.target.value)}>
          <option value="">Sans tag de domaine</option>
          {domaines.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nom}
            </option>
          ))}
        </select>
        <label className="champ-fichier">
          Pièce(s) jointe(s) :
          <input type="file" multiple onChange={(e) => setFichiersAJoindre([...e.target.files])} />
        </label>
        <button type="submit">Ajouter la note</button>
      </form>

      <div className="filtre-tag">
        <label>
          Filtrer par tag :
          <select value={filtreDomaine} onChange={(e) => setFiltreDomaine(e.target.value)}>
            <option value="">Tous</option>
            <option value="sans_tag">Sans tag</option>
            {domaines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </label>
        {modeSelection ? (
          <button className="bouton-icone" onClick={basculerModeSelection} title="Annuler la sélection" aria-label="Annuler la sélection">
            ✕
          </button>
        ) : (
          <button onClick={basculerModeSelection}>☑️ Sélectionner</button>
        )}
      </div>

      {modeSelection && (
        <div className="selection-toolbar">
          <span>{selection.size} sélectionnée(s)</span>
          <button onClick={toutSelectionner}>Tout</button>
          <button onClick={supprimerSelection} disabled={selection.size === 0}>
            Supprimer
          </button>
          <select value={tagEnMasse} onChange={(e) => setTagEnMasse(e.target.value)}>
            <option value="">Ajouter un tag…</option>
            {domaines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
          <button onClick={appliquerTagEnMasse} disabled={selection.size === 0 || !tagEnMasse}>
            Appliquer
          </button>
          <button onClick={partagerSelection} disabled={selection.size === 0}>
            Partager
          </button>
        </div>
      )}

      {!notes && <p>Chargement…</p>}
      {notes && notes.length === 0 && <p>Aucune note.</p>}

      <ul className="note-list">
        {notes &&
          notes.map((n) => (
            <li key={n.id} className="note-item">
              {modeSelection && (
                <input
                  type="checkbox"
                  checked={selection.has(n.id)}
                  onChange={() => basculerSelection(n.id)}
                  className="note-checkbox"
                />
              )}
              {enEdition === n.id ? (
                <div className="note-edit">
                  <input value={editionTitre} onChange={(e) => setEditionTitre(e.target.value)} placeholder="Titre" />
                  <input value={editionUrl} onChange={(e) => setEditionUrl(e.target.value)} placeholder="Lien" />
                  <textarea
                    value={editionApercu}
                    onChange={(e) => setEditionApercu(e.target.value)}
                    placeholder="Aperçu"
                  />
                  <MarkdownToolbar value={editionContenu} onChange={setEditionContenu} placeholder="Contenu…" />
                  <select value={editionDomaine} onChange={(e) => setEditionDomaine(e.target.value)}>
                    <option value="">Sans tag de domaine</option>
                    {domaines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nom}
                      </option>
                    ))}
                  </select>
                  <div className="note-actions">
                    <button className="bouton-icone" onClick={() => enregistrerEdition(n)} title="Enregistrer" aria-label="Enregistrer">
                      ✓
                    </button>
                    <button className="bouton-icone" onClick={() => setEnEdition(null)} title="Annuler" aria-label="Annuler">
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <strong>{n.titre}</strong>
                  {n.domaine ? (
                    <span className="badge">{n.domaine.nom}</span>
                  ) : (
                    <span className="badge badge-alerte">⚠ Sans tag</span>
                  )}
                  {n.url && (
                    <div>
                      <a href={n.url} target="_blank" rel="noreferrer">
                        {n.url}
                      </a>
                    </div>
                  )}
                  {n.apercu && <p>{n.apercu}</p>}
                  {n.contenu && (
                    <div className="markdown-apercu" dangerouslySetInnerHTML={{ __html: rendreMarkdown(n.contenu) }} />
                  )}

                  {n.pieces_jointes.length > 0 && (
                    <ul className="pieces-jointes">
                      {n.pieces_jointes.map((p) => (
                        <li key={p.id}>
                          {p.type_mime && p.type_mime.startsWith("image/") ? (
                            <img src={api.urlPieceJointe(p.id)} alt={p.nom_original} className="piece-jointe-image" />
                          ) : null}
                          <span>
                            {p.nom_original} ({formatTaille(p.taille_octets)})
                          </span>
                          <button
                            className="bouton-icone"
                            onClick={() => api.telechargerPieceJointe(p.id, p.nom_original)}
                            title="Télécharger"
                            aria-label="Télécharger"
                          >
                            ⬇️
                          </button>
                          <button className="bouton-icone" onClick={() => supprimerPieceJointe(p)} title="Supprimer" aria-label="Supprimer">
                            🗑
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="note-actions-ligne">
                    <span className="groupe-actions">
                      <label className="champ-fichier">
                        📎 Joindre
                        <input
                          type="file"
                          multiple
                          onChange={(e) => {
                            ajouterPieceJointe(n, [...e.target.files]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </span>

                    <span className="groupe-actions">
                      <button className="bouton-icone" onClick={() => commencerEdition(n)} title="Modifier" aria-label="Modifier">
                        ✏️
                      </button>
                      <button className="bouton-icone" onClick={() => supprimer(n)} title="Supprimer" aria-label="Supprimer">
                        🗑
                      </button>
                      <button
                        className="bouton-icone"
                        onClick={() => transformerEnTache(n)}
                        disabled={transformees.includes(n.id)}
                        title={
                          transformees.includes(n.id)
                            ? "Tâche créée"
                            : !n.domaine_id
                              ? "Ajoutez un tag de domaine pour transformer cette note en tâche"
                              : "Transformer en tâche"
                        }
                        aria-label="Transformer en tâche"
                      >
                        {transformees.includes(n.id) ? "✓" : "→✅"}
                      </button>
                    </span>

                    <span className="groupe-actions">
                      <button onClick={() => exporter(n, "txt")}>⬇️ txt</button>
                      <button onClick={() => exporter(n, "md")}>⬇️ md</button>
                      <button onClick={() => exporter(n, "docx")}>⬇️ docx</button>
                    </span>
                  </div>
                </>
              )}
            </li>
          ))}
      </ul>
    </section>
  );
}
