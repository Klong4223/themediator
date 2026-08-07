import React, { useState } from "react";
import { C, st, font } from "../ui.jsx";

/* Wegweiser fuer "Dein Raum".
 *
 * Rueckmeldung aus der Testphase: die einzelnen Reiter sind fuer sich
 * verstaendlich, aber niemand sieht, wozu sie zusammen gut sind -- und
 * warum das Beziehungsbild wartet. Genau diese Kette fehlte:
 *   schreiben -> verstanden werden -> daraus entsteht das gemeinsame Bild.
 *
 * Bewusst kein einmaliges Onboarding, das nach dem Wegklicken fuer immer
 * verschwindet: eingeklappt bleibt eine schmale Zeile stehen, ueber die
 * man jederzeit zurueckkommt. Der Zustand liegt in localStorage (reine
 * Oberflaechen-Vorliebe, kein Inhalt -- gehoert nicht in die Datenbank)
 * und ist an die Nutzer-ID gebunden, damit zwei Konten auf einem Geraet
 * sich nicht gegenseitig den Wegweiser wegklicken.
 */

const RAEUME = [
  ["Tagebuch", "Der Hauptweg. Schreib, was gerade ist — ungeordnet reicht. Du bekommst eine Antwort und meistens eine Rückfrage, die weiterführt."],
  ["Über dich", "Ein Fragebogen und ein paar Nachfragen. Der schnellste Weg, dass Zwischenraum dich kennt, ohne dass du alles selbst erzählen musst."],
  ["Themen & Konflikte", "Für den einen Streit, der immer wiederkommt und den du einmal in Ruhe auseinandernehmen willst — getrennt vom Alltag."],
  ["Dein Spiegel", "Was Zwischenraum über dich verstanden hat, dir zurückgegeben. Nur für dich; deine Partnerin oder dein Partner sieht das nie."],
  ["Beziehungsbild", "Das fertige gemeinsame Bild in Ruhe für dich durchsprechen. Was du hier fragst und schreibst, bleibt privat."],
];

export default function Wegweiser({ userId }) {
  const key = `zr_wegweiser_${userId || "anon"}`;
  const [offen, setOffen] = useState(() => {
    try { return localStorage.getItem(key) !== "zu"; } catch { return true; }
  });

  function umschalten() {
    const neu = !offen;
    setOffen(neu);
    try { localStorage.setItem(key, neu ? "auf" : "zu"); } catch { /* privater Modus */ }
  }

  if (!offen) {
    return (
      <button
        onClick={umschalten}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`,
          padding: "0 2px 12px", marginBottom: 20, cursor: "pointer",
          fontFamily: "inherit", fontSize: 13.5, color: C.inkSoft, textAlign: "left",
        }}
      >
        <span aria-hidden="true">▸</span>
        Wofür ist das hier? — kurze Orientierung
      </button>
    );
  }

  return (
    <div style={{ ...st.card, borderLeft: `3px solid ${C.a}`, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={st.h2}>Wofür ist das hier?</h2>
        <button
          onClick={umschalten}
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, color: C.inkSoft, textDecoration: "underline",
            flexShrink: 0,
          }}
        >
          Einklappen
        </button>
      </div>

      <p style={{ ...st.body, marginTop: 8 }}>
        Alles in diesem Raum ist privat — und gleichzeitig das Material, aus dem später
        euer gemeinsames Beziehungsbild entsteht. Je mehr Zwischenraum von dir weiß,
        desto weniger muss es raten.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {RAEUME.map(([titel, text]) => (
          <div key={titel} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0 10px" }}>
            <span aria-hidden="true" style={{ color: C.a, fontWeight: 700, lineHeight: 1.5 }}>·</span>
            <p style={{ ...st.body, margin: 0, fontSize: 14.5 }}>
              <strong style={{ fontFamily: font.display, fontWeight: 600 }}>{titel}</strong>
              {" — "}{text}
            </p>
          </div>
        ))}
      </div>

      <div style={{ background: C.paper, borderRadius: 10, padding: "12px 14px", marginTop: 16 }}>
        <p style={{ ...st.body, margin: 0, fontSize: 14.5 }}>
          Das Beziehungsbild wird aus all dem gemacht — deshalb braucht es von beiden Seiten
          etwas Substanz. Wäre erst wenig da, würde jede „Zusammenfassung" in Wahrheit zur
          Nacherzählung, und dein Gegenüber läse praktisch deinen Originaltext. Genau das soll
          nie passieren. Unter <strong>Der Zwischenraum</strong> siehst du jederzeit, wie weit du
          schon bist.
        </p>
      </div>
    </div>
  );
}
