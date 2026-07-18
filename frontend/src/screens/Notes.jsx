import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import MarkdownToolbar from "../components/MarkdownToolbar.jsx";
import DomainBadge from "../components/DomainBadge.jsx";
import { IconDownload, IconEdit, IconPaperclip, IconTrash } from "../components/Icons.jsx";
import { rendreMarkdown } from "../utils/markdown.js";

function formatTaille(octets) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

// L'endpoint est protégé par authentification (Authorization header), donc on ne peut
// pas passer son URL directement en <img src> : on récupère le blob et on en fait une
// URL locale.
function ApercuPieceJointe({ id, alt, className }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let urlActuelle = null;
    let annule = false;
    api.urlObjetPieceJointe(id).then((u) => {
      if (annule) {
        URL.revokeObjectURL(u);
        return;
      }
      urlActuelle = u;
      setUrl(u);
    });
    return () => {
      annule = true;
      if (urlActuelle) URL.revokeObjectURL(urlActuelle);
    };
  }, [id]);

  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
}

export default function Notes({ contexte }) {
  const [notes, setNotes] = useState(null);
  const [domaines, setDomaines] = useState([]);
  const [filtreDomaine, setFiltreDomaine] = useState("");
  const [erreur, setErreur] = useState(null);
  const [info, setInfo] = useState(null);

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
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
  const [tagSheetOuvert, setTagSheetOuvert] = useState(false);

  useEffect(() => {
    api.getDomaines(contexte).then(setDomaines).catch((e) => setErreur(e.message));
  }, [contexte]);

  useEffect(() => {
    charger();
  }, [filtreDomaine, contexte]);

  function charger() {
    setNotes(null);
    api.getNotes(filtreDomaine || undefined, contexte).then(setNotes).catch((e) => setErreur(e.message));
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
      setFormulaireOuvert(false);
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

  async function appliquerTagEnMasse(domaineId) {
    if (selection.size === 0) return;
    try {
      await Promise.all([...selection].map((id) => api.modifierNote(id, { domaine_id: domaineId })));
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

  const filtres = [
    { value: "", label: "Toutes" },
    { value: "sans_tag", label: "Sans tag" },
    ...domaines.map((d) => ({ value: String(d.id), label: d.nom })),
  ];

  return (
    <div className="tnv-screen">
      <div className="tnv-screen-head">
        <div>
          <p className="tnv-eyebrow">{contexte === "pro" ? "Espace professionnel" : "Espace personnel"}</p>
          <h1 className="tnv-h1">Notes</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="tnv-btn tnv-btn--secondary" onClick={basculerModeSelection}>
            {modeSelection ? "Annuler" : "Sélectionner"}
          </button>
          <button className="tnv-fab" onClick={() => setFormulaireOuvert((o) => !o)} title="Nouvelle note" aria-label="Nouvelle note">
            +
          </button>
        </div>
      </div>

      {erreur && <p className="tnv-error">{erreur}</p>}
      {info && <p className="tnv-info">{info}</p>}

      {formulaireOuvert && (
        <form className="tnv-form" onSubmit={ajouterNote}>
          <input
            className="tnv-input"
            type="url"
            placeholder="Coller un lien (optionnel)"
            value={lien}
            onChange={(e) => setLien(e.target.value)}
            onBlur={recupererApercu}
          />
          <input className="tnv-input" type="text" placeholder="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
          <textarea
            className="tnv-textarea"
            placeholder="Aperçu (court résumé)"
            value={apercu}
            onChange={(e) => setApercu(e.target.value)}
          />
          <MarkdownToolbar value={contenu} onChange={setContenu} placeholder="Écrire une note de texte…" />
          <select className="tnv-select" value={domaineImport} onChange={(e) => setDomaineImport(e.target.value)}>
            <option value="">Sans tag de domaine</option>
            {domaines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
          <label className="champ-fichier">
            <IconPaperclip size={16} /> Joindre
            <input type="file" multiple onChange={(e) => setFichiersAJoindre([...e.target.files])} />
          </label>
          <button type="submit" className="tnv-btn tnv-btn--primary">
            Ajouter la note
          </button>
        </form>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {filtres.map((f) => (
          <button
            key={f.value}
            className={filtreDomaine === f.value ? "tnv-chip tnv-chip--active" : "tnv-chip"}
            onClick={() => setFiltreDomaine(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {modeSelection && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span className="tnv-meta-text">{selection.size} sélectionnée(s)</span>
          <button className="tnv-btn tnv-btn--ghost" onClick={toutSelectionner}>
            Tout sélectionner
          </button>
        </div>
      )}

      {!notes && <p className="tnv-empty">Chargement…</p>}
      {notes && notes.length === 0 && <p className="tnv-empty">Aucune note.</p>}

      <div className="tnv-stack" style={{ marginBottom: modeSelection && selection.size > 0 ? 90 : 24 }}>
        {notes &&
          notes.map((n) => (
            <div
              key={n.id}
              className={selection.has(n.id) ? "tnv-card tnv-note-card tnv-note-card--selected" : "tnv-card tnv-note-card"}
            >
              {enEdition === n.id ? (
                <>
                  <input className="tnv-input" value={editionTitre} onChange={(e) => setEditionTitre(e.target.value)} placeholder="Titre" />
                  <input className="tnv-input" value={editionUrl} onChange={(e) => setEditionUrl(e.target.value)} placeholder="Lien" />
                  <textarea className="tnv-textarea" value={editionApercu} onChange={(e) => setEditionApercu(e.target.value)} placeholder="Aperçu" />
                  <MarkdownToolbar value={editionContenu} onChange={setEditionContenu} placeholder="Contenu…" />
                  <select className="tnv-select" value={editionDomaine} onChange={(e) => setEditionDomaine(e.target.value)}>
                    <option value="">Sans tag de domaine</option>
                    {domaines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nom}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="tnv-btn tnv-btn--primary" onClick={() => enregistrerEdition(n)}>
                      Enregistrer
                    </button>
                    <button className="tnv-btn tnv-btn--ghost" onClick={() => setEnEdition(null)}>
                      Annuler
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="tnv-note-card__head">
                    {modeSelection && (
                      <button
                        type="button"
                        className={selection.has(n.id) ? "tnv-select-dot tnv-select-dot--checked" : "tnv-select-dot"}
                        onClick={() => basculerSelection(n.id)}
                        aria-label="Sélectionner"
                        style={{ marginTop: 3 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="tnv-task-card__title">{n.titre}</span>
                      <div className="tnv-task-card__meta" style={{ marginTop: 4 }}>
                        {n.domaine ? <DomainBadge domaine={n.domaine} /> : <span className="tnv-badge tnv-badge--warning">⚠ Sans tag</span>}
                      </div>
                    </div>
                  </div>

                  {n.url && (
                    <a href={n.url} target="_blank" rel="noreferrer" style={{ fontSize: "var(--tnv-size-caption)" }}>
                      {n.url}
                    </a>
                  )}
                  {n.apercu && <p className="tnv-meta-text">{n.apercu}</p>}
                  {n.contenu && <div className="markdown-apercu" dangerouslySetInnerHTML={{ __html: rendreMarkdown(n.contenu) }} />}

                  {n.pieces_jointes.length > 0 && (
                    <div className="tnv-stack" style={{ gap: 6, marginBottom: 0 }}>
                      {n.pieces_jointes.map((p) => (
                        <div key={p.id} className="tnv-note-card__attachment">
                          {p.type_mime && p.type_mime.startsWith("image/") ? (
                            <ApercuPieceJointe id={p.id} alt={p.nom_original} className="tnv-note-card__attachment-image" />
                          ) : null}
                          <span className="tnv-meta-text" style={{ flex: 1 }}>
                            {p.nom_original} ({formatTaille(p.taille_octets)})
                          </span>
                          <button
                            className="tnv-icon-btn"
                            onClick={() => api.telechargerPieceJointe(p.id, p.nom_original)}
                            title="Télécharger"
                            aria-label="Télécharger"
                          >
                            <IconDownload size={16} />
                          </button>
                          <button className="tnv-icon-btn" onClick={() => supprimerPieceJointe(p)} title="Supprimer" aria-label="Supprimer">
                            <IconTrash size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="note-actions-ligne">
                    <span className="groupe-actions">
                      <label className="champ-fichier">
                        <IconPaperclip size={16} /> Joindre
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
                      <button className="tnv-icon-btn" onClick={() => commencerEdition(n)} title="Modifier" aria-label="Modifier">
                        <IconEdit size={16} />
                      </button>
                      <button className="tnv-icon-btn" onClick={() => supprimer(n)} title="Supprimer" aria-label="Supprimer">
                        <IconTrash size={16} />
                      </button>
                      <button
                        className="tnv-btn tnv-btn--outline"
                        onClick={() => transformerEnTache(n)}
                        disabled={transformees.includes(n.id)}
                        title={!n.domaine_id ? "Ajoutez un tag de domaine pour transformer cette note en tâche" : undefined}
                      >
                        {transformees.includes(n.id) ? "Tâche créée ✓" : "Transformer en tâche"}
                      </button>
                    </span>

                    <span className="groupe-actions">
                      <button className="tnv-btn tnv-btn--ghost" onClick={() => exporter(n, "txt")}>
                        .txt
                      </button>
                      <button className="tnv-btn tnv-btn--ghost" onClick={() => exporter(n, "md")}>
                        .md
                      </button>
                      <button className="tnv-btn tnv-btn--ghost" onClick={() => exporter(n, "docx")}>
                        .docx
                      </button>
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
      </div>

      {modeSelection && selection.size > 0 && (
        <div className="tnv-bulk-bar">
          <button className="tnv-btn tnv-btn--ghost" onClick={() => setTagSheetOuvert(true)}>
            Tag
          </button>
          <button className="tnv-btn tnv-btn--ghost" onClick={partagerSelection}>
            Partager
          </button>
          <button className="tnv-btn tnv-btn--danger-ghost" onClick={supprimerSelection}>
            Supprimer
          </button>
        </div>
      )}

      {tagSheetOuvert && (
        <div className="tnv-overlay tnv-sheet" onClick={() => setTagSheetOuvert(false)}>
          <div className="tnv-sheet__panel" onClick={(e) => e.stopPropagation()}>
            <div className="tnv-sheet__grabber" />
            <span className="tnv-sheet__title">Ajouter un tag à {selection.size} note(s)</span>
            {domaines.map((d) => (
              <button
                key={d.id}
                className="tnv-decision-option tnv-decision-option--secondary"
                onClick={() => {
                  appliquerTagEnMasse(d.id);
                  setTagSheetOuvert(false);
                }}
              >
                {d.nom}
              </button>
            ))}
            <button className="tnv-btn tnv-btn--ghost" onClick={() => setTagSheetOuvert(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
