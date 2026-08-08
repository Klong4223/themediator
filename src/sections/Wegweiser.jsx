import React from "react";
import { C, st, font, Ausklappbar } from "../ui.jsx";

/* Wegweiser fuer "Dein Raum".
 *
 * Rueckmeldung aus der Testphase: die einzelnen Reiter sind fuer sich
 * verstaendlich, aber niemand sieht, wozu sie zusammen gut sind -- und
 * warum das Beziehungsbild wartet. Genau diese Kette fehlte:
 *   schreiben -> verstanden werden -> daraus entsteht das gemeinsame Bild.
 *
 * Bewusst kein einmaliges Onboarding, das nach dem Wegklicken fuer immer
 * verschwindet: die Ueberschrift bleibt stehen, man kommt jederzeit
 * zurueck. Das Ein- und Ausklappen steckt in `Ausklappbar` (ui.jsx) --
 * dieselbe Komponente traegt die Erklaerung zum Beziehungsbild, damit sich
 * beide nicht nur aehnlich, sondern gleich verhalten.
 */

const RAEUME = [
  ["Tagebuch", "Der Hauptweg. Schreib, was gerade ist — ungeordnet reicht. Du bekommst eine Antwort und meistens eine Rückfrage, die weiterführt."],
  ["Über dich", "Ein Fragebogen und ein paar Nachfragen. Der schnellste Weg, dass Zwischenraum dich kennt, ohne dass du alles selbst erzählen musst."],
  ["Themen & Konflikte", "Für den einen Streit, der immer wiederkommt und den du einmal in Ruhe auseinandernehmen willst — getrennt vom Alltag."],
  ["Dein Spiegel", "Was Zwischenraum über dich verstanden hat, dir zurückgegeben. Nur für dich; deine Partnerin oder dein Partner sieht das nie."],
  ["Beziehungsbild", "Das fertige gemeinsame Bild in Ruhe für dich durchsprechen. Was du hier fragst und schreibst, bleibt privat."],
];

export default function Wegweiser({ userId }) {
  return (
    <div style={{ ...st.card, borderLeft: `3px solid ${C.a}`, marginBottom: 20 }}>
      <Ausklappbar titel="Wofür ist das hier?" speicherKey={`zr_wegweiser_${userId || "anon"}`}>
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
      </Ausklappbar>
    </div>
  );
}
