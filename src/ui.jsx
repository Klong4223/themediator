import React from "react";
import { LegalFooter } from "./Legal.jsx";

export const C = {
  paper: "#F5F6F3",
  card: "#FFFFFF",
  ink: "#232B38",
  inkSoft: "#5A6472",
  line: "#E3E6E0",
  a: "#B07C2E",
  aSoft: "#F6EEDD",
  b: "#3F7484",
  bSoft: "#E3EEF1",
  danger: "#A33B2E",
  dangerSoft: "#F8E8E5",
  ok: "#3E7A4E",
};

export const font = {
  display: "'Fraunces', Georgia, serif",
  body: "'Source Sans 3', system-ui, sans-serif",
};

export const st = {
  h1: { fontFamily: font.display, fontSize: 34, fontWeight: 600, color: C.ink, letterSpacing: "-0.01em", margin: 0 },
  h2: { fontFamily: font.display, fontSize: 19, fontWeight: 600, margin: 0, color: C.ink },
  hint: { fontSize: 13.5, color: C.inkSoft, margin: "6px 0 12px", lineHeight: 1.5 },
  body: { fontSize: 15, lineHeight: 1.65, color: C.ink, margin: "6px 0 0" },
  card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px" },
  input: {
    width: "100%", border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px",
    fontSize: 15, fontFamily: "inherit", color: C.ink, background: "#FDFDFC", boxSizing: "border-box",
  },
  textarea: {
    width: "100%", border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, fontSize: 15,
    fontFamily: "inherit", color: C.ink, background: "#FDFDFC", resize: "vertical", minHeight: 130, boxSizing: "border-box",
  },
};

export function Btn({ children, onClick, disabled, variant = "primary", role, type = "button", style }) {
  const bg = variant === "primary" ? C.ink : variant === "who" ? (role === "A" ? C.a : C.b) : "transparent";
  const color = variant === "ghost" ? C.inkSoft : "#fff";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? C.line : bg,
        color: disabled ? C.inkSoft : color,
        border: variant === "ghost" ? `1px solid ${C.line}` : "none",
        borderRadius: 10, padding: "11px 20px", fontSize: 15, fontWeight: 600,
        cursor: disabled ? "default" : "pointer", fontFamily: "inherit", ...style,
      }}
    >
      {children}
    </button>
  );
}

/* Ein Erklaerblock, den man wegklappen kann, ohne ihn zu verlieren.
 *
 * Die Ueberschrift bleibt in beiden Zustaenden stehen -- eingeklappt ist
 * der Block also weiterhin auffindbar, anders als bei einem Einmal-Hinweis,
 * der nach dem Wegklicken fuer immer verschwindet.
 *
 * Der Zustand liegt in localStorage: reine Oberflaechen-Vorliebe, die nichts
 * in der Datenbank zu suchen hat. Der Schluessel wird an die Nutzer-ID
 * gebunden uebergeben, damit zwei Konten auf einem Geraet sich nicht
 * gegenseitig die Erklaerungen wegklicken.
 *
 * `standardOffen` greift nur, solange die Person selbst noch nichts
 * entschieden hat -- er darf eine gespeicherte Entscheidung nie ueberstimmen.
 * Weil der Aufrufer den Standard oft erst nach einem Ladevorgang kennt
 * (Report.jsx: "schon freigegeben?"), wird er nachtraeglich uebernommen,
 * statt nur einmal beim ersten Rendern gelesen zu werden.
 */
export function Ausklappbar({ titel, speicherKey, standardOffen = true, children }) {
  const gespeichert = () => {
    try { return localStorage.getItem(speicherKey); } catch { return null; }
  };
  const [offen, setOffen] = React.useState(() => {
    const v = gespeichert();
    return v === "auf" ? true : v === "zu" ? false : standardOffen;
  });
  const [beruehrt, setBeruehrt] = React.useState(false);

  React.useEffect(() => {
    if (beruehrt || gespeichert()) return;
    setOffen(standardOffen);
  }, [standardOffen, beruehrt]);

  function umschalten() {
    const neu = !offen;
    setOffen(neu);
    setBeruehrt(true);
    try { localStorage.setItem(speicherKey, neu ? "auf" : "zu"); } catch { /* privater Modus */ }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={st.h2}>{titel}</h2>
        <button
          onClick={umschalten}
          aria-expanded={offen}
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0,
            fontFamily: "inherit", fontSize: 13, color: C.inkSoft, textDecoration: "underline",
          }}
        >
          {offen ? "Einklappen" : "Mehr dazu"}
        </button>
      </div>
      {offen && children}
    </div>
  );
}

export function Tag({ role, children }) {
  const col = role === "A" ? C.a : C.b;
  const soft = role === "A" ? C.aSoft : C.bSoft;
  return (
    <span style={{
      background: soft, color: col, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
      padding: "3px 10px", borderRadius: 999, textTransform: "uppercase", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

export function Convergence() {
  return (
    <svg width="100%" height="44" viewBox="0 0 600 44" preserveAspectRatio="none" aria-hidden="true">
      <path d="M40 4 C 200 4, 260 40, 300 40" stroke={C.a} strokeWidth="2.5" fill="none" />
      <path d="M560 4 C 400 4, 340 40, 300 40" stroke={C.b} strokeWidth="2.5" fill="none" />
      <circle cx="300" cy="40" r="4" fill={C.ink} />
    </svg>
  );
}

export function AIBlock({ title, text }) {
  if (!text) return null;
  return (
    <div style={{ background: C.paper, borderLeft: `3px solid ${C.ink}`, borderRadius: 8, padding: "12px 14px", marginTop: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, letterSpacing: "0.06em" }}>{title}</span>
      <p style={{ ...st.body, marginTop: 4, whiteSpace: "pre-wrap" }}>{text}</p>
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div style={{ background: C.dangerSoft, color: C.danger, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 14 }}>
      {children}
    </div>
  );
}

export function InviteBox({ code }) {
  const [kopiert, setKopiert] = React.useState(false);
  if (!code) return null;
  const link = `https://zwischenraum.work/?code=${code}`;
  const text = `Ich habe uns einen Raum bei Zwischenraum angelegt — einer App, die uns beim Verstehen hilft. Jeder schreibt für sich, niemand liest die Texte des anderen. Hier ist dein Zugang: ${link}`;

  async function teilen() {
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      setKopiert(true); setTimeout(() => setKopiert(false), 2500);
    } catch { /* abgebrochen */ }
  }

  return (
    <div>
      <div style={{
        textAlign: "center", fontFamily: font.body, fontSize: 14, color: C.inkSoft,
        padding: "12px 14px", border: `1px dashed ${C.line}`, borderRadius: 10,
        background: "#FDFDFC", userSelect: "all", overflowWrap: "anywhere",
      }}>
        {link}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
        <Btn onClick={teilen}>{kopiert ? "✓ Kopiert" : "Einladung teilen"}</Btn>
      </div>
      <p style={{ fontSize: 12.5, color: C.inkSoft, textAlign: "center", marginTop: 8 }}>
        Code zum manuellen Eingeben: <strong style={{ userSelect: "all" }}>{code}</strong>
      </p>
    </div>
  );
}

export function Shell({ children }) {
  return (
    <div style={{ background: C.paper, minHeight: "100vh", padding: "24px 16px 72px", color: C.ink }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        h1, h2, h3, p, span, li, div { overflow-wrap: anywhere; word-break: normal; }
        img, svg { max-width: 100%; }
      `}</style>
      <div style={{ maxWidth: 860, margin: "0 auto", fontFamily: font.body }}>{children}<LegalFooter /></div>
    </div>
  );
}
