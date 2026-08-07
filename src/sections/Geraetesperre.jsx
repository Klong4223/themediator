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
  const [vergessenBusy, setVergessenBusy] = useState(false);
  const [vergessenGesendet, setVergessenGesendet] = useState(false);

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

  async function pinVergessen() {
    setVergessenBusy(true); setError(null);
    try {
      await callAI({ action: "lock_reset_request" });
      setVergessenGesendet(true);
    } catch (e) {
      setError("Anfrage fehlgeschlagen: " + (e?.message || e));
    }
    setVergessenBusy(false);
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
      <div style={{ marginTop: 20 }}>
        {vergessenGesendet ? (
          <p style={{ ...st.hint, color: C.ok }}>
            Falls du einen PIN gesetzt hast, ist eine Mail mit einem Link zum Zurücksetzen
            unterwegs — schau auch im Spam-Ordner nach. Der Link ist 30 Minuten gültig.
          </p>
        ) : (
          <button onClick={pinVergessen} disabled={vergessenBusy}
            style={{ background: "none", border: "none", color: C.inkSoft, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
            {vergessenBusy ? "Wird angefragt …" : "PIN vergessen?"}
          </button>
        )}
      </div>
    </div>
  );
}
