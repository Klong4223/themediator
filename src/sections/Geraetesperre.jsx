import React, { useState } from "react";
import { callAI } from "../supabase.js";
import { C, st, Btn, ErrorNote } from "../ui.jsx";

/* Wiedereinstiegs-Schutz (Backlog Punkt 6): rein clientseitig gegen
   kurzes Mitlesen, wenn das Geraet aus der Hand gegeben wird -- kein
   Schutz gegen einen entschlossenen Angreifer mit Zugriff auf das
   angemeldete Geraet selbst. Der PIN-Hash verlaesst nie den Server. */
export default function Geraetesperre({ onEntsperrt }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function pruefen() {
    if (!pin.trim()) return;
    setBusy(true); setError(null);
    try {
      const res = await callAI({ action: "lock_verify", pin: pin.trim() });
      if (res.ok) {
        onEntsperrt();
      } else {
        setError("Der PIN stimmt nicht.");
        setPin("");
      }
    } catch (e) {
      setError("Prüfung fehlgeschlagen: " + (e?.message || e));
    }
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 340, margin: "48px auto 0", textAlign: "center" }}>
      <h2 style={st.h2}>Dein Raum ist gesperrt</h2>
      <p style={st.hint}>Gib deinen PIN ein, um weiterzumachen.</p>
      <ErrorNote>{error}</ErrorNote>
      <input
        style={{ ...st.input, textAlign: "center", fontSize: 22, letterSpacing: "0.3em" }}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        disabled={busy}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
        onKeyDown={(e) => e.key === "Enter" && pruefen()}
        placeholder="••••"
        autoFocus
      />
      <div style={{ marginTop: 14 }}>
        <Btn onClick={pruefen} disabled={busy || !pin.trim()}>
          {busy ? "Wird geprüft …" : "Entsperren"}
        </Btn>
      </div>
    </div>
  );
}
