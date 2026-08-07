import React, { useEffect, useState } from "react";
import { callAI } from "../supabase.js";
import { C, st, InviteBox } from "../ui.jsx";

// Ersetzt das verworfene Barometer (KONZEPT.md 6.2/7.2): kein Fuellstand,
// keine Fleiss-Masse ueber die andere Person — nur der naechste tatsaechlich
// noch nicht erreichte Meilenstein, mit Begruendung im Klartext. Der
// Wortlaut kommt vollstaendig vom Server, damit er nirgends auseinanderlaeuft.
//
// refreshKey aendert sich, wenn der Aufrufer (Report.jsx) einen Zustand
// veraendert hat, der die Meilensteine beeinflusst (z.B. Freigabe-Toggle),
// damit die Karte sofort nachzieht statt erst beim naechsten Laden.
export default function NaechsterSchritt({ membership, refreshKey }) {
  const [m, setM] = useState(undefined);

  useEffect(() => {
    let aktiv = true;
    callAI({ action: "meilensteine" }).then((r) => { if (aktiv) setM(r); }).catch(() => { if (aktiv) setM(null); });
    return () => { aktiv = false; };
  }, [refreshKey]);

  if (!m || !m.naechster) return null;

  return (
    <section style={{ ...st.card, borderTop: `3px solid ${C.ink}` }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft }}>
        Der nächste Schritt
      </span>
      <p style={{ ...st.body, marginTop: 6 }}>{m.grund}</p>
      {m.naechster === "partner_fehlt" && (
        <div style={{ marginTop: 10 }}>
          <InviteBox code={membership.couples?.invite_code} />
        </div>
      )}
    </section>
  );
}
