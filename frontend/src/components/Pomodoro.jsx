import { useEffect, useState } from "react";
import { IconPause, IconPlay, IconSkip, IconStop, IconTomato } from "./Icons.jsx";

function creerContexte() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  return new Ctx();
}

function jouerNote(ctx, frequence, debut, duree, volume) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequence;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, debut);
  gain.gain.linearRampToValueAtTime(volume, debut + Math.min(0.05, duree * 0.3));
  gain.gain.linearRampToValueAtTime(0, debut + duree);
  osc.start(debut);
  osc.stop(debut + duree);
}

// Deux notes montantes brèves, façon "Tink" macOS — signale un lancement de phase.
function sonLancement() {
  try {
    const ctx = creerContexte();
    const t = ctx.currentTime;
    jouerNote(ctx, 659.25, t, 0.12, 0.07);
    jouerNote(ctx, 987.77, t + 0.1, 0.15, 0.07);
  } catch {
    // audio non disponible dans ce navigateur
  }
}

// Une seule note neutre et douce, façon "Pop" macOS — signale une mise en pause.
function sonPause() {
  try {
    const ctx = creerContexte();
    jouerNote(ctx, 440, ctx.currentTime, 0.18, 0.05);
  } catch {
    // audio non disponible dans ce navigateur
  }
}

// Trois notes formant un accord résolu, façon carillon de fin — signale la fin du cycle complet.
function sonFinCycle() {
  try {
    const ctx = creerContexte();
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((frequence, i) => jouerNote(ctx, frequence, t + i * 0.14, 0.35, 0.07));
  } catch {
    // audio non disponible dans ce navigateur
  }
}

// Un simple tic très discret — alerte douce avant la fin d'une phase, ne doit pas surprendre.
function sonAlerte() {
  try {
    const ctx = creerContexte();
    jouerNote(ctx, 880, ctx.currentTime, 0.2, 0.025);
  } catch {
    // audio non disponible dans ce navigateur
  }
}

function notifier(titre, corps) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification(titre, { body: corps });
}

export default function Pomodoro({ tache, onClose }) {
  const [phase, setPhase] = useState("reglage"); // reglage | focus | repos
  const [dureeFocus, setDureeFocus] = useState(25);
  const [dureeRepos, setDureeRepos] = useState(5);
  const [restant, setRestant] = useState(0);
  const [dureeTotale, setDureeTotale] = useState(0);
  const [enPause, setEnPause] = useState(false);
  const [alerteJouee, setAlerteJouee] = useState(false);

  useEffect(() => {
    if (phase === "reglage" || enPause) return;
    if (restant <= 0) {
      terminerPhase();
      return;
    }
    const seuilAlerte = dureeTotale > 10 * 60 ? 120 : 60;
    if (!alerteJouee && restant === seuilAlerte) {
      sonAlerte();
      setAlerteJouee(true);
    }
    const t = setTimeout(() => setRestant((r) => r - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restant, enPause, dureeTotale, alerteJouee]);

  function demarrer() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    sonLancement();
    setPhase("focus");
    setDureeTotale(dureeFocus * 60);
    setRestant(dureeFocus * 60);
    setEnPause(false);
    setAlerteJouee(false);
  }

  function basculerPause() {
    setEnPause((p) => {
      const nouveau = !p;
      if (nouveau) sonPause();
      return nouveau;
    });
  }

  function terminerPhase() {
    if (phase === "focus") {
      sonLancement();
      notifier("Focus terminé", `Pause de ${dureeRepos} min.`);
      setPhase("repos");
      setDureeTotale(dureeRepos * 60);
      setRestant(dureeRepos * 60);
      setAlerteJouee(false);
    } else if (phase === "repos") {
      sonFinCycle();
      notifier("Pause terminée", "Prêt·e pour un nouveau focus ?");
      onClose();
    }
  }

  const minutes = Math.floor(restant / 60).toString().padStart(2, "0");
  const secondes = (restant % 60).toString().padStart(2, "0");
  const pourcentage = dureeTotale > 0 ? Math.round(((dureeTotale - restant) / dureeTotale) * 100) : 0;

  return (
    <div className="tnv-overlay tnv-modal-center" onClick={onClose}>
      <div className="tnv-pomodoro" onClick={(e) => e.stopPropagation()}>
        <IconTomato size={40} />
        <span className="tnv-pomodoro__task">{tache?.titre}</span>

        {phase === "reglage" ? (
          <>
            <div className="tnv-field-row">
              <div>
                <input
                  type="number"
                  className="tnv-input"
                  min="1"
                  max="120"
                  value={dureeFocus}
                  onChange={(e) => setDureeFocus(Number(e.target.value))}
                />
                <span className="tnv-meta-text">min focus</span>
              </div>
              <div>
                <input
                  type="number"
                  className="tnv-input"
                  min="1"
                  max="60"
                  value={dureeRepos}
                  onChange={(e) => setDureeRepos(Number(e.target.value))}
                />
                <span className="tnv-meta-text">min pause</span>
              </div>
            </div>
            <button className="tnv-btn tnv-btn--primary" onClick={demarrer}>
              <IconTomato size={16} /> Démarrer
            </button>
            <button className="tnv-btn tnv-btn--ghost" onClick={onClose}>
              Fermer
            </button>
          </>
        ) : (
          <>
            <span className={phase === "repos" ? "tnv-pomodoro__phase tnv-pomodoro__phase--pause" : "tnv-pomodoro__phase"}>
              {phase === "focus" ? "Focus" : "Pause"}
            </span>
            <span className="tnv-pomodoro__time">
              {minutes}:{secondes}
            </span>
            <div className="tnv-bar-track" style={{ width: "100%" }}>
              <div className="tnv-bar-fill" style={{ width: `${pourcentage}%` }} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="tnv-icon-btn" onClick={basculerPause} title={enPause ? "Reprendre" : "Pause"} aria-label={enPause ? "Reprendre" : "Pause"}>
                {enPause ? <IconPlay /> : <IconPause />}
              </button>
              <button className="tnv-icon-btn" onClick={terminerPhase} title="Passer" aria-label="Passer">
                <IconSkip />
              </button>
              <button className="tnv-icon-btn" onClick={onClose} title="Arrêter" aria-label="Arrêter">
                <IconStop />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
