import React, { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { C, st } from "../ui.jsx";
import DocChat from "./DocChat.jsx";

// Das Gespraech ueber das Beziehungsbild gehoert strukturell zu "Dein Raum",
// nicht zu "Der Zwischenraum" -- auch wenn der Bericht selbst gemeinsam ist,
// ist das, was er in DIR ausloest, privat. Der Ort allein macht das klar,
// ohne dass ein Hinweistext es erst erklaeren muesste. Der Berichtstext
// selbst wird hier bewusst NICHT wiederholt (der steht in Der Zwischenraum) --
// nur ein knapper Verweis, damit klar bleibt, worueber gesprochen wird.
export default function BeziehungsbildGespraech({ membership }) {
  const [reports, setReports] = useState(null);

  useEffect(() => {
    supabase.from("reports")
      .select("id, status, created_at").eq("status", "done")
      .order("created_at", { ascending: false })
      .then(({ data }) => setReports(data || []));
  }, []);

  if (reports === null) return null;

  return (
    <section style={st.card}>
      <h2 style={st.h2}>Gespräch zu eurem Beziehungsbild</h2>
      <p style={st.hint}>
        Was das Beziehungsbild in dir auslöst, besprichst du hier — nur du siehst dieses
        Gespräch, auch wenn der Bericht selbst gemeinsam ist. Den vollständigen Text findest
        du im Zwischenraum.
      </p>
      {reports.length === 0 ? (
        <p style={{ ...st.hint, fontStyle: "italic" }}>Sobald es ein Beziehungsbild gibt, kannst du hier darüber sprechen.</p>
      ) : (
        reports.map((r, i) => (
          <div key={r.id} style={{ marginTop: i === 0 ? 4 : 20, paddingTop: i === 0 ? 0 : 16, borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
            <span style={{ fontSize: 12, color: C.inkSoft }}>
              Euer Beziehungsbild vom{" "}
              {new Date(r.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <DocChat kind="report" docId={r.id} canWrite={i === 0} />
          </div>
        ))
      )}
    </section>
  );
}
