import React from "react";
import { C, st, font, Btn } from "./ui.jsx";

const S = ({ children, style }) => (
  <section style={{ maxWidth: 560, margin: "0 auto", padding: "0 4px", ...style }}>{children}</section>
);

// Begegnet den drei Aengsten der eingeladenen Person, in dieser Reihenfolge:
// Ueberwachung, Parteinahme, Verpflichtung. Personalisieren geht nicht --
// der Name der einladenden Person ist per RLS erst nach der Anmeldung
// lesbar (couples/couple_members verlangen is_member()).
export default function Invite({ onStart }) {
  const h = { fontFamily: font.display, color: C.ink, letterSpacing: "-0.01em" };
  return (
    <S style={{ textAlign: "center", paddingTop: 40 }}>
      <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", color: C.inkSoft, textTransform: "uppercase" }}>
        Zwischenraum
      </p>
      <h1 style={{ ...h, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 600, lineHeight: 1.2, margin: "10px 0 0" }}>
        Jemand hat einen Raum<br />für euch beide eingerichtet.
      </h1>

      <div style={{ ...st.card, textAlign: "left", marginTop: 28, padding: "22px 24px" }}>
        <p style={{ ...st.body, margin: 0 }}>
          Bevor du dich entscheidest, das Wichtigste:
        </p>
        <ul style={{ ...st.body, margin: "12px 0 0", paddingLeft: 20, display: "grid", gap: 10 }}>
          <li><strong>Was du hier schreibst, liest die andere Person nie im Original.</strong> Du
            bekommst dein eigenes, vollständig privates Konto — genau denselben geschützten Raum wie
            sie.</li>
          <li><strong>Zwischenraum ergreift keine Partei</strong> — auch nicht die der Person, die
            dich eingeladen hat. Beide Seiten zählen gleich.</li>
          <li><strong>Du entscheidest, wie weit du gehst.</strong> Schau es dir an. Du kannst
            jederzeit wieder gehen, nichts ist verpflichtend.</li>
        </ul>
      </div>

      <div style={{ marginTop: 26 }}>
        <Btn onClick={onStart} style={{ padding: "14px 30px", fontSize: 16 }}>Raum ansehen</Btn>
      </div>
      <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 12 }}>
        Kostenlos · eigenes Passwort · jederzeit löschbar
      </p>
    </S>
  );
}
