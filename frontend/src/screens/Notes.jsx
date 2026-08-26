import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import MarkdownToolbar from "../components/MarkdownToolbar.jsx";
import { DomainBadges } from "../components/DomainBadge.jsx";
import {
  IconCheckmark,
  IconColonneMasquer,
  IconColonneSeule,
  IconDownload,
  IconEdit,
  IconPaperclip,
  IconTrash,
} from "../components/Icons.jsx";
import { rendreMarkdown } from "../utils/markdown.js";
import { formatDate } from "../utils/formatDate.js";
import { domainHue } from "../utils/domainHue.js";

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
  const [noteSelectionneeId, setNoteSelectionneeId] = useState(null);
  const [modeDesktop, setModeDesktop] = useState("split"); // 'split' | 'liste' | 'detail' — n'a d'effet qu'à partir de 900px

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [lien, setLien] = useState("");
  const [titre, setTitre] = useState("");
  const [apercu, setApercu] = useState("");
  const [contenu, setContenu] = useState("");
  const [domaineImportIds, setDomaineImportIds] = useState(new Set());
  const [fichiersAJoindre, setFichiersAJoindre] = useState([]);

  const [enEdition, setEnEdition] = useState(null);
  const [editionTitre, setEditionTitre] = useState("");
  const [editionUrl, setEditionUrl] = useState("");
  const [editionApercu, setEditionApercu] = useState("");
  const [editionContenu, setEditionContenu] = useState("");
  const [editionDomaineIds, setEditionDomaineIds] = useState(new Set());

  const [transformees, setTransformees] = useState([]);
  const [tagsRapidesOuverts, setTagsRapidesOuverts] = useState(false);

  const [modeSelection, setModeSelection] = useState(false);
  const [selection, setSelection] = useState(new Set());
  const [tagSheetOuvert, setTagSheetOuvert] = useState(false);
  const [fusionCible, setFusionCible] = useState(null); // null | "note" | "tache"
  const [fusionTitre, setFusionTitre] = useState("");

  useEffect(() => {
    api.getDomaines(contexte).then(setDomaines).catch((e) => setErreur(e.message));
  }, [contexte]);

  useEffect(() => {
    setNotes(null); // changement de filtre/contexte : contenu différent, on veut bien le flash "Chargement…"
    charger();
  }, [filtreDomaine, contexte]);

  // items reste affiché pendant le fetch (pas de setNotes(null) ici) : un rechargement
  // déclenché par une action (tag, suppression, édition...) ne doit pas faire disparaître
  // toute la liste le temps de la requête — même correctif que sur l'écran Veille.
  function charger() {
    api
      .getNotes(filtreDomaine || undefined, contexte)
      .then((data) => {
        setNotes(data);
        setNoteSelectionneeId((id) => (id && data.some((n) => n.id === id) ? id : null));
      })
      .catch((e) => setErreur(e.message));
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
        domaine_ids: [...domaineImportIds],
      });
      for (const fichier of fichiersAJoindre) {
        await api.ajouterPieceJointe(note.id, fichier);
      }
      setLien("");
      setTitre("");
      setApercu("");
      setContenu("");
      setDomaineImportIds(new Set());
      setFichiersAJoindre([]);
      setFormulaireOuvert(false);
      setNoteSelectionneeId(note.id);
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
    setEditionDomaineIds(new Set(note.domaines.map((d) => d.id)));
  }

  function basculerDomaineEdition(id) {
    setEditionDomaineIds((s) => {
      const nouveau = new Set(s);
      if (nouveau.has(id)) nouveau.delete(id);
      else nouveau.add(id);
      return nouveau;
    });
  }

  async function enregistrerEdition(note) {
    try {
      await api.modifierNote(note.id, {
        titre: editionTitre,
        url: editionUrl || null,
        apercu: editionApercu || null,
        contenu: editionContenu || null,
        domaine_ids: [...editionDomaineIds],
      });
      setEnEdition(null);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function basculerTagRapide(note, domaineId) {
    try {
      const actuels = note.domaines.map((d) => d.id);
      const nouveaux = actuels.includes(domaineId) ? actuels.filter((x) => x !== domaineId) : [...actuels, domaineId];
      await api.modifierNote(note.id, { domaine_ids: nouveaux });
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimer(note) {
    if (!window.confirm(`Supprimer la note « ${note.titre} » ?`)) return;
    try {
      await api.supprimerNote(note.id);
      if (noteSelectionneeId === note.id) setNoteSelectionneeId(null);
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
    setNoteSelectionneeId(null);
  }

  function selectionnerNote(id) {
    if (modeSelection) {
      basculerSelection(id);
      return;
    }
    setNoteSelectionneeId(id);
    setTagsRapidesOuverts(false);
    // Choisir une note en mode "liste seule" doit rouvrir le volet de détail, sinon rien ne s'affiche.
    setModeDesktop((m) => (m === "liste" ? "split" : m));
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
      // Ajoute le tag aux domaines déjà présents sur chaque note, plutôt que de les remplacer.
      await Promise.all(
        (notes || [])
          .filter((n) => selection.has(n.id))
          .map((n) => {
            const domaineIds = new Set(n.domaines.map((d) => d.id));
            domaineIds.add(domaineId);
            return api.modifierNote(n.id, { domaine_ids: [...domaineIds] });
          })
      );
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

  function ouvrirFusion(cible) {
    setFusionCible(cible);
    setFusionTitre("");
  }

  async function confirmerFusion() {
    if (selection.size < 2) return;
    if (
      fusionCible === "note" &&
      !window.confirm(`Fusionner ces ${selection.size} notes en une seule ? Les notes d'origine seront supprimées.`)
    ) {
      return;
    }
    try {
      const noteIds = [...selection];
      if (fusionCible === "note") {
        const nouvelle = await api.fusionnerEnNote(noteIds, fusionTitre.trim());
        setNoteSelectionneeId(nouvelle.id);
      } else {
        await api.fusionnerEnTache(noteIds, fusionTitre.trim());
      }
      setFusionCible(null);
      setSelection(new Set());
      setModeSelection(false);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  const filtres = [
    { value: "", label: "Toutes" },
    { value: "sans_tag", label: "Sans tag" },
    ...domaines.map((d) => ({ value: String(d.id), label: d.nom })),
  ];

  const noteSelectionnee = notes && noteSelectionneeId ? notes.find((n) => n.id === noteSelectionneeId) : null;

  return (
    <div className="tnv-screen">
      <div className="tnv-screen-head">
        <div>
          <p className="tnv-eyebrow">{contexte === "pro" ? "Espace professionnel" : "Espace personnel"}</p>
          <h1 className="tnv-h1">Notes</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="tnv-notes-desktop-controls">
            <button
              type="button"
              className="tnv-icon-btn"
              onClick={() => setModeDesktop((m) => (m === "detail" ? "split" : "detail"))}
              title={modeDesktop === "detail" ? "Afficher la colonne des notes" : "Masquer la colonne des notes"}
              aria-label="Masquer la colonne des notes"
            >
              <IconColonneMasquer size={16} />
            </button>
            <button
              type="button"
              className="tnv-icon-btn"
              onClick={() => setModeDesktop((m) => (m === "liste" ? "split" : "liste"))}
              title={modeDesktop === "liste" ? "Revenir à la vue partagée" : "N'afficher que la colonne des notes"}
              aria-label="N'afficher que la colonne des notes"
            >
              <IconColonneSeule size={16} />
            </button>
          </span>
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {domaines.length === 0 && <span className="tnv-meta-text">Sans tag de domaine</span>}
            {domaines.map((d) => (
              <button
                key={d.id}
                type="button"
                className={domaineImportIds.has(d.id) ? "tnv-chip tnv-chip--active" : "tnv-chip"}
                onClick={() =>
                  setDomaineImportIds((s) => {
                    const nouveau = new Set(s);
                    if (nouveau.has(d.id)) nouveau.delete(d.id);
                    else nouveau.add(d.id);
                    return nouveau;
                  })
                }
              >
                {d.nom}
              </button>
            ))}
          </div>
          <label className="champ-fichier">
            <IconPaperclip size={16} /> Joindre
            <input type="file" multiple onChange={(e) => setFichiersAJoindre([...e.target.files])} />
          </label>
          <button type="submit" className="tnv-btn tnv-btn--primary">
            Ajouter la note
          </button>
        </form>
      )}

      <div
        className={["tnv-notes-filtres", noteSelectionnee && "tnv-notes-filtres--cache-mobile"].filter(Boolean).join(" ")}
      >
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

      <div
        className={[
          "tnv-notes-layout",
          noteSelectionnee && "tnv-notes-layout--detail-actif",
          modeDesktop === "liste" && "tnv-notes-layout--liste-seule",
          modeDesktop === "detail" && "tnv-notes-layout--detail-seule",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="tnv-notes-list-pane">
          {modeSelection && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="tnv-meta-text">{selection.size} sélectionnée(s)</span>
              <button className="tnv-btn tnv-btn--ghost" onClick={toutSelectionner}>
                Tout sélectionner
              </button>
            </div>
          )}

          {!notes && <p className="tnv-empty">Chargement…</p>}
          {notes && notes.length === 0 && <p className="tnv-empty">Aucune note.</p>}

          <div className="tnv-notes-row-list" style={{ marginBottom: modeSelection && selection.size > 0 ? 90 : 0 }}>
            {notes &&
              notes.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  className={n.id === noteSelectionneeId ? "tnv-notes-row tnv-notes-row--active" : "tnv-notes-row"}
                  onClick={() => selectionnerNote(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") selectionnerNote(n.id);
                  }}
                >
                  {modeSelection && (
                    <button
                      type="button"
                      className={selection.has(n.id) ? "tnv-select-dot tnv-select-dot--checked" : "tnv-select-dot"}
                      onClick={(e) => {
                        e.stopPropagation();
                        basculerSelection(n.id);
                      }}
                      aria-label="Sélectionner"
                      style={{ marginTop: 3, flexShrink: 0 }}
                    >
                      {selection.has(n.id) && <IconCheckmark size={12} />}
                    </button>
                  )}
                  <div className="tnv-notes-row__body">
                    <div className="tnv-notes-row__meta">
                      {n.domaines.length > 0 ? (
                        <span className="tnv-dot" style={{ "--domain-hue": domainHue(n.domaines[0].nom) }} />
                      ) : (
                        <span className="tnv-badge tnv-badge--warning">⚠ Sans tag</span>
                      )}
                      <span className="tnv-notes-row__snippet">{formatDate(n.cree_le)}</span>
                    </div>
                    <div className="tnv-notes-row__title" title={n.titre}>{n.titre}</div>
                    {n.apercu && <div className="tnv-notes-row__snippet">{n.apercu}</div>}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="tnv-notes-detail-pane">
          {!noteSelectionnee && (
            <p className="tnv-empty tnv-notes-detail-empty">Sélectionnez une note pour l'afficher ici.</p>
          )}

          {noteSelectionnee && (
            <div className="tnv-card tnv-note-card">
              <button className="tnv-btn tnv-btn--ghost tnv-notes-back" onClick={() => setNoteSelectionneeId(null)}>
                ← Retour
              </button>

              {enEdition === noteSelectionnee.id ? (
                <>
                  <input
                    className="tnv-input"
                    value={editionTitre}
                    onChange={(e) => setEditionTitre(e.target.value)}
                    placeholder="Titre"
                  />
                  <input
                    className="tnv-input"
                    value={editionUrl}
                    onChange={(e) => setEditionUrl(e.target.value)}
                    placeholder="Lien"
                  />
                  <textarea
                    className="tnv-textarea"
                    value={editionApercu}
                    onChange={(e) => setEditionApercu(e.target.value)}
                    placeholder="Aperçu"
                  />
                  <MarkdownToolbar value={editionContenu} onChange={setEditionContenu} placeholder="Contenu…" />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {domaines.length === 0 && <span className="tnv-meta-text">Sans tag de domaine</span>}
                    {domaines.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={editionDomaineIds.has(d.id) ? "tnv-chip tnv-chip--active" : "tnv-chip"}
                        onClick={() => basculerDomaineEdition(d.id)}
                      >
                        {d.nom}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="tnv-btn tnv-btn--primary" onClick={() => enregistrerEdition(noteSelectionnee)}>
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="tnv-task-card__title" style={{ fontSize: 21, lineHeight: 1.3 }}>{noteSelectionnee.titre}</span>
                      <p className="tnv-meta-text" style={{ marginTop: 6 }}>Ajoutée le {formatDate(noteSelectionnee.cree_le)}</p>
                      <div className="tnv-task-card__meta" style={{ marginTop: 4 }}>
                        {noteSelectionnee.domaines.length > 0 ? (
                          <DomainBadges domaines={noteSelectionnee.domaines} />
                        ) : (
                          <span className="tnv-badge tnv-badge--warning">⚠ Sans tag</span>
                        )}
                        <button
                          type="button"
                          className="tnv-chip tnv-chip--tag-rapide"
                          onClick={() => setTagsRapidesOuverts((o) => !o)}
                          title="Ajouter/retirer un tag"
                          aria-label="Ajouter/retirer un tag"
                        >
                          + tag
                        </button>
                      </div>
                      {tagsRapidesOuverts && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          {domaines.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              className={
                                noteSelectionnee.domaines.some((nd) => nd.id === d.id) ? "tnv-chip tnv-chip--active" : "tnv-chip"
                              }
                              onClick={() => basculerTagRapide(noteSelectionnee, d.id)}
                            >
                              {d.nom}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {noteSelectionnee.url && (
                    <a
                      href={noteSelectionnee.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "var(--tnv-size-caption)", overflowWrap: "anywhere", display: "block" }}
                    >
                      {noteSelectionnee.url}
                    </a>
                  )}
                  {noteSelectionnee.apercu && <p className="tnv-meta-text">{noteSelectionnee.apercu}</p>}
                  {noteSelectionnee.contenu && (
                    <div className="markdown-apercu" dangerouslySetInnerHTML={{ __html: rendreMarkdown(noteSelectionnee.contenu) }} />
                  )}

                  {noteSelectionnee.pieces_jointes.length > 0 && (
                    <div className="tnv-stack" style={{ gap: 6, marginBottom: 0 }}>
                      {noteSelectionnee.pieces_jointes.map((p) => (
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
                            ajouterPieceJointe(noteSelectionnee, [...e.target.files]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </span>

                    <span className="groupe-actions">
                      <button className="tnv-icon-btn" onClick={() => commencerEdition(noteSelectionnee)} title="Modifier" aria-label="Modifier">
                        <IconEdit size={16} />
                      </button>
                      <button className="tnv-icon-btn" onClick={() => supprimer(noteSelectionnee)} title="Supprimer" aria-label="Supprimer">
                        <IconTrash size={16} />
                      </button>
                      <button
                        className="tnv-btn tnv-btn--outline"
                        onClick={() => transformerEnTache(noteSelectionnee)}
                        disabled={transformees.includes(noteSelectionnee.id)}
                        title={noteSelectionnee.domaines.length === 0 ? "Ajoutez un tag de domaine pour transformer cette note en tâche" : undefined}
                      >
                        {transformees.includes(noteSelectionnee.id) ? "Tâche créée ✓" : "Transformer en tâche"}
                      </button>
                    </span>

                    <span className="groupe-actions">
                      <button className="tnv-btn tnv-btn--ghost" onClick={() => exporter(noteSelectionnee, "txt")}>
                        .txt
                      </button>
                      <button className="tnv-btn tnv-btn--ghost" onClick={() => exporter(noteSelectionnee, "md")}>
                        .md
                      </button>
                      <button className="tnv-btn tnv-btn--ghost" onClick={() => exporter(noteSelectionnee, "docx")}>
                        .docx
                      </button>
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {modeSelection && selection.size > 0 && (
        <div className="tnv-bulk-bar">
          <button className="tnv-btn tnv-btn--ghost" onClick={() => setTagSheetOuvert(true)}>
            Tag
          </button>
          {selection.size >= 2 && (
            <>
              <button className="tnv-btn tnv-btn--ghost" onClick={() => ouvrirFusion("note")}>
                Fusionner en note
              </button>
              <button className="tnv-btn tnv-btn--ghost" onClick={() => ouvrirFusion("tache")}>
                Fusionner en tâche
              </button>
            </>
          )}
          <button className="tnv-btn tnv-btn--ghost" onClick={partagerSelection}>
            Partager
          </button>
          <button className="tnv-btn tnv-btn--danger-ghost" onClick={supprimerSelection}>
            Supprimer
          </button>
        </div>
      )}

      {fusionCible && (
        <div className="tnv-overlay tnv-sheet" onClick={() => setFusionCible(null)}>
          <div className="tnv-sheet__panel" onClick={(e) => e.stopPropagation()}>
            <div className="tnv-sheet__grabber" />
            <span className="tnv-sheet__title">
              Fusionner {selection.size} notes en {fusionCible === "note" ? "une note" : "une tâche"}
            </span>
            {fusionCible === "note" && (
              <p className="tnv-meta-text">
                Le contenu de chaque note est conservé (concaténé), les domaines sont fusionnés, les pièces jointes
                réassignées. Les notes d'origine seront supprimées.
              </p>
            )}
            <input
              className="tnv-input"
              type="text"
              placeholder="Titre (optionnel, auto-généré sinon)"
              value={fusionTitre}
              onChange={(e) => setFusionTitre(e.target.value)}
            />
            <button className="tnv-btn tnv-btn--primary" onClick={confirmerFusion}>
              Fusionner
            </button>
            <button className="tnv-btn tnv-btn--ghost" onClick={() => setFusionCible(null)}>
              Annuler
            </button>
          </div>
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
