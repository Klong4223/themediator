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
  // Vorschau vor dem Teilen: { entwurf_id, eroeffnung } oder null.
  // Solange das gesetzt ist, ist noch NICHTS im gemeinsamen Raum gelandet.
  const [vorschau, setVorschau] = useState(null);
  const [modus, setModus] = useState("eroeffnung");

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

  // Stoesst an, dass die eigenen Beitraege ins Profil und die Chronik
  // einfliessen -- ohne darauf zu warten. Die Verdichtung braucht zwei
  // Modellaufrufe und damit rund eine Minute; inline wuerde jede Antwort
  // entsprechend spaeter erscheinen. Geht der Aufruf verloren, holt die
  // Edge Function es beim naechsten Beitrag nach.
  function verdichtenAnstossen() {
    callAI({ action: "doc_chat_verdichten", doc_id: docId }).catch(() => { /* nachgeholt */ });
  }

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
      verdichtenAnstossen();
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

  // Erzeugt NUR den Vorschlag. Es geht dabei nichts in den gemeinsamen
  // Raum -- das passiert erst in bestaetigen().
  async function vorschauErzeugen(gewuenschterModus) {
    setTeilenBusy(true); setError(null);
    try {
      const res = await callAI({ action: "doc_chat_share", kind, doc_id: docId, modus: gewuenschterModus });
      setModus(gewuenschterModus);
      setVorschau({ entwurf_id: res.entwurf_id, eroeffnung: res.eroeffnung });
    } catch (e) {
      setError("Der Vorschlag konnte nicht erzeugt werden: " + (e?.message || JSON.stringify(e)));
    }
    setTeilenBusy(false);
  }

  // Verwirft den Vorschlag auch serverseitig. Die Anzeige verschwindet
  // sofort; dass das Aufraeumen kurz danach passiert, muss niemand
  // abwarten, und scheitert es, wird der Entwurf beim naechsten Vorschlag
  // ohnehin ersetzt.
  function abbrechen() {
    const id = vorschau?.entwurf_id;
    setVorschau(null);
    if (id) callAI({ action: "doc_chat_share_abbrechen", doc_id: docId }).catch(() => { /* wird ersetzt */ });
  }

  // Schickt genau den Text ab, der in der Vorschau stand -- der Server
  // nimmt ihn aus seiner eigenen Ablage, nicht aus dieser Antwort.
  async function bestaetigen() {
    if (!vorschau) return;
    setTeilenBusy(true); setError(null);
    try {
      await callAI({ action: "doc_chat_share_confirm", entwurf_id: vorschau.entwurf_id });
      setVorschau(null);
      setGeteilt(true);
    } catch (e) {
      setError("Konnte nicht gesendet werden: " + (e?.message || JSON.stringify(e)));
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
            {messages.length > 0 && !geteilt && !vorschau && (
              <Btn variant="ghost" onClick={() => vorschauErzeugen(modus)} disabled={teilenBusy}>
                {teilenBusy ? "Vorschlag entsteht …" : "Daraus etwas in euren Raum tragen …"}
              </Btn>
            )}
            {geteilt && (
              <span style={{ fontSize: 13, color: C.ok }}>✓ In euren Raum getragen — moderiert, nicht wörtlich.</span>
            )}
          </div>

          {/* Vorschau. Bis "In euren Raum senden" gedrueckt ist, steht
              nichts im gemeinsamen Raum -- das muss hier auch dastehen,
              sonst traegt der Knopf dieselbe Angst wie vorher. */}
          {vorschau && (
            <div style={{ ...st.card, background: C.paper, marginTop: 12 }}>
              <h3 style={{ ...st.h2, fontSize: 16 }}>Das käme im gemeinsamen Raum an</h3>
              <p style={{ ...st.hint, marginTop: 6 }}>
                Dein Gespräch bleibt privat — nichts davon wird weitergegeben. Zwischenraum hat
                daraus einen neuen Text formuliert, ohne Zitate und ohne zu sagen, wer was
                gefühlt hat. <strong>Noch ist nichts gesendet.</strong>
              </p>

              <div style={{ display: "flex", gap: 6, margin: "10px 0", flexWrap: "wrap" }}>
                {[["eroeffnung", "Kurze Eröffnung"], ["thema", "Nur das Thema"]].map(([id, label]) => (
                  <button key={id} onClick={() => vorschauErzeugen(id)} disabled={teilenBusy}
                    style={{
                      background: modus === id ? C.aSoft : "transparent",
                      color: modus === id ? C.a : C.inkSoft,
                      border: `1px solid ${modus === id ? C.a : C.line}`,
                      borderRadius: 999, padding: "5px 13px", fontSize: 13, fontWeight: 600,
                      cursor: teilenBusy ? "default" : "pointer", fontFamily: "inherit",
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ ...st.body, margin: 0, whiteSpace: "pre-wrap" }}>{vorschau.eroeffnung}</p>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <Btn onClick={bestaetigen} disabled={teilenBusy}>
                  {teilenBusy ? "…" : "In euren Raum senden"}
                </Btn>
                <Btn variant="ghost" onClick={abbrechen} disabled={teilenBusy}>
                  Abbrechen
                </Btn>
              </div>
            </div>
          )}
        </>
      ) : (
        messages.length > 0 && (
          <p style={{ ...st.hint, fontSize: 12.5 }}>Dieses Gespräch ist abgeschlossen — nur das jüngste Dokument nimmt neue Nachrichten an.</p>
        )
      )}
    </div>
  );
}
