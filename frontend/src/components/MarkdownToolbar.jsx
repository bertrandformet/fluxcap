import { useRef, useState } from "react";
import { rendreMarkdown } from "../utils/markdown.js";

export default function MarkdownToolbar({ value, onChange, placeholder, rows = 6 }) {
  const ref = useRef(null);
  const [apercu, setApercu] = useState(false);

  function appliquer(nouveauTexte, selDebut, selFin) {
    onChange(nouveauTexte);
    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.focus();
      ref.current.setSelectionRange(selDebut, selFin);
    });
  }

  function inserer(avant, apres = "", texteParDefaut = "") {
    const el = ref.current;
    if (!el) return;
    const debut = el.selectionStart;
    const fin = el.selectionEnd;
    const selection = value.slice(debut, fin) || texteParDefaut;
    const nouveau = value.slice(0, debut) + avant + selection + apres + value.slice(fin);
    appliquer(nouveau, debut + avant.length, debut + avant.length + selection.length);
  }

  function prefixerLigne(prefixe) {
    const el = ref.current;
    if (!el) return;
    const debut = el.selectionStart;
    const debutLigne = value.lastIndexOf("\n", debut - 1) + 1;
    const nouveau = value.slice(0, debutLigne) + prefixe + value.slice(debutLigne);
    appliquer(nouveau, debut + prefixe.length, el.selectionEnd + prefixe.length);
  }

  const boutons = [
    { label: "H1", title: "Titre 1", action: () => prefixerLigne("# ") },
    { label: "H2", title: "Titre 2", action: () => prefixerLigne("## ") },
    { label: "G", title: "Gras", action: () => inserer("**", "**", "gras") },
    { label: "I", title: "Italique", action: () => inserer("*", "*", "italique") },
    { label: "S", title: "Barré", action: () => inserer("~~", "~~", "barré") },
    { label: "</>", title: "Code", action: () => inserer("`", "`", "code") },
    { label: "•", title: "Liste à puces", action: () => prefixerLigne("- ") },
    { label: "1.", title: "Liste numérotée", action: () => prefixerLigne("1. ") },
    { label: "☑", title: "Case à cocher", action: () => prefixerLigne("- [ ] ") },
    { label: "”", title: "Citation", action: () => prefixerLigne("> ") },
    { label: "🔗", title: "Lien", action: () => inserer("[", "](https://)", "texte du lien") },
    { label: "—", title: "Ligne horizontale", action: () => inserer("\n\n---\n\n") },
  ];

  return (
    <div className="tnv-md-container">
      <div className="tnv-md-toolbar">
        {boutons.map((b) => (
          <button key={b.title} type="button" className="tnv-md-toolbar__btn" title={b.title} onClick={b.action} disabled={apercu}>
            {b.label}
          </button>
        ))}
        <button
          type="button"
          className="tnv-md-toolbar__btn"
          onClick={() => setApercu((a) => !a)}
          style={{ marginLeft: "auto", color: apercu ? "var(--tnv-accent)" : undefined }}
        >
          {apercu ? "Éditer" : "Aperçu"}
        </button>
      </div>

      {apercu ? (
        <div className="markdown-apercu" style={{ padding: "16px 18px" }} dangerouslySetInnerHTML={{ __html: rendreMarkdown(value) }} />
      ) : (
        <textarea
          ref={ref}
          className="tnv-md-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
        />
      )}
    </div>
  );
}
