import React, { useEffect, useState } from "react";
import { callAI } from "../supabase.js";
import { C, st, Btn, ErrorNote } from "../ui.jsx";

// Verankerter Gespraechsfaden zu einem Beziehungsbild oder Spiegel
// (KONZEPT.md Abschnitt 7.2-7.5). Wiederverwendbar fuer beide Dokumenttypen.
//
// Kernregel gegen Datenverlust: Der Entwurf im Eingabefeld wird erst
// geleert, NACHDEM der Server bestaetigt hat, dass die Nachricht
// gespeichert wurde. Scheitert nur die KI-Antwort, bleibt die Nachricht
// trotzdem sichtbar im Verlauf -- nichts geht verloren, nur die Antwort
// fehlt und kann nachtraeglich generiert werden. Scheitert der Aufruf
// schon vorher (Netzwerk, Berechtigung), bleibt der Entwurf im Feld
// stehen, damit nichts getippt umsonst war.
export default function DocChat({ kind, docId, canWrite }) {
  const [messages, setMessages] = useState(null);
  const [entwurf, setEntwurf] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [teilenBusy, setTeilenBusy] = useState(false);
  const [geteilt, setGeteilt] = useState(false);

  // Ueber die Edge Function: die Gespraechsbeitraege liegen verschluesselt
  // in der Datenbank (CLAUDE.md Backlog 7).
  async function load() {
    try {
      const res = await callAI({ action: "doc_chat_list", doc_id: docId });
      setMessages(res.messages || []);
    } catch (e) {
      setMessages([]);
      setError("Das Gespräch konnte nicht geladen werden: " + (e?.message || e));
    }
  }
  useEffect(() => { load(); }, [docId]);

  const letzte = messages && messages.length ? messages[messages.length - 1] : null;
  const wartetAufAntwort = letzte?.sender === "user";

  async function senden() {
    const text = entwurf.trim();
    if (!text || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await callAI({ action: "doc_chat", kind, doc_id: docId, message: text });
      // Erfolgreich beim Server angekommen -> die Nachricht ist gespeichert,
      // der Entwurf darf jetzt geleert werden, egal ob die KI-Antwort klappte.
      setEntwurf("");
      await load();
      if (res?.fehler) setError("Deine Nachricht ist gespeichert. Antwort konnte gerade nicht erzeugt werden: " + res.fehler);
    } catch (e) {
      // Hier NICHT leeren -- die Nachricht kam moeglicherweise nie an.
      setError("Nachricht konnte nicht gesendet werden: " + (e?.message || JSON.stringify(e)));
    }
    setBusy(false);
  }

  async function antwortNachtragen() {
    setBusy(true); setError(null);
    try {
      const res = await callAI({ action: "doc_chat", kind, doc_id: docId });
      await load();
      if (res?.fehler) setError("Antwort konnte gerade nicht erzeugt werden: " + res.fehler);
    } catch (e) {
      setError("Antwort konnte nicht erzeugt werden: " + (e?.message || JSON.stringify(e)));
    }
    setBusy(false);
  }

  async function teilen() {
    setTeilenBusy(true); setError(null);
    try {
      await callAI({ action: "doc_chat_share", kind, doc_id: docId, modus: "eroeffnung" });
      setGeteilt(true);
    } catch (e) {
      setError("Konnte nicht geteilt werden: " + (e?.message || JSON.stringify(e)));
    }
    setTeilenBusy(false);
  }

  if (messages === null) return null;

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
      {messages.length === 0 && canWrite && (
        <p style={{ ...st.hint, margin: "0 0 8px" }}>Was löst das in dir aus?</p>
      )}
      {messages.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          {messages.map((m) => (
            <div key={m.id} style={{
              justifySelf: m.sender === "user" ? "end" : "start",
              maxWidth: "85%",
              background: m.sender === "user" ? C.paper : "#fff",
              border: `1px solid ${C.line}`,
              borderRadius: 12,
              padding: "9px 13px",
            }}>
              {m.sender === "ai" && (
                <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: "0.06em" }}>ZWISCHENRAUM</span>
              )}
              <p style={{ ...st.body, margin: m.sender === "ai" ? "2px 0 0" : 0, whiteSpace: "pre-wrap", fontSize: 14.5 }}>
                {m.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {messages.length === 0 && (
        <p style={{ ...st.hint, fontSize: 12.5, margin: "0 0 10px", fontStyle: "italic" }}>
          Dieses Gespräch ist nur deins — niemand sonst sieht deine Fragen oder die Antworten.
        </p>
      )}

      <ErrorNote>{error}</ErrorNote>

      {wartetAufAntwort && !error && (
        <p style={{ ...st.hint, margin: "0 0 10px" }}>Zwischenraum antwortet …</p>
      )}
      {wartetAufAntwort && error && (
        <div style={{ marginBottom: 10 }}>
          <Btn variant="ghost" onClick={antwortNachtragen} disabled={busy}>
            {busy ? "Versuch läuft …" : "Antwort noch einmal versuchen"}
          </Btn>
        </div>
      )}

      {canWrite ? (
        <>
          <textarea
            style={{ ...st.textarea, minHeight: 70 }}
            placeholder="Schreib, was dir dazu durch den Kopf geht — Zwischenraum antwortet."
            value={entwurf}
            onChange={(e) => setEntwurf(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) senden(); }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Btn onClick={senden} disabled={busy || !entwurf.trim()}>
              {busy ? "Wird gesendet …" : "Senden"}
            </Btn>
            {messages.length > 0 && !geteilt && (
              <Btn variant="ghost" onClick={teilen} disabled={teilenBusy}>
                {teilenBusy ? "…" : "Das gehört in unseren Raum"}
              </Btn>
            )}
            {geteilt && (
              <span style={{ fontSize: 13, color: C.ok }}>✓ In euren Raum getragen — moderiert, nicht wörtlich.</span>
            )}
          </div>
        </>
      ) : (
        messages.length > 0 && (
          <p style={{ ...st.hint, fontSize: 12.5 }}>Dieses Gespräch ist abgeschlossen — nur das jüngste Dokument nimmt neue Nachrichten an.</p>
        )
      )}
    </div>
  );
}
