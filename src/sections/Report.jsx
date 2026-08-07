import React, { useEffect, useRef, useState } from "react";
import { supabase, callAI } from "../supabase.js";
import { C, st, Btn, Convergence, ErrorNote } from "../ui.jsx";
import DocChat from "./DocChat.jsx";
import NaechsterSchritt from "./NaechsterSchritt.jsx";

// Seit der Umstellung auf OpenAIs Responses-API mit background:true gibt es
// KEIN Zeitlimit mehr fuer die Denktiefe des Modells — das ist gewollt, eine
// tiefe Analyse darf laenger dauern. "status" aus der Datenbank ist deshalb
// die einzige verlaessliche Quelle, ob ein Lauf noch aktiv ist: weiterpollen,
// bis der Server selbst "done" oder "error" meldet. Diese Schwelle bestimmt
// nur noch, ab wann die Seite den Hinweis "dauert laenger als sonst" zeigt —
// sie behauptet NICHT, dass der Server etwas abgebrochen hat, und sie stoppt
// das Polling nicht.
const UNGEWOEHNLICH_LANGE_MS = 20 * 60 * 1000;

const dauertUngewoehnlichLang = (zeile) =>
  zeile.status === "running" &&
  Date.now() - new Date(zeile.created_at).getTime() > UNGEWOEHNLICH_LANGE_MS;

export default function Report({ membership }) {
  const [myConsent, setMyConsent] = useState(false);
  const [partnerConsent, setPartnerConsent] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [letzterFehler, setLetzterFehler] = useState(false);
  const [warnungDuenn, setWarnungDuenn] = useState(false);
  const [meilensteinKey, setMeilensteinKey] = useState(0);

  // Solange der Server "running" sagt, pollt die Seite weiter — auch nach
  // ungewoehnlich langer Zeit. Nur der Server weiss, ob der Lauf noch aktiv
  // ist; die Seite darf das nicht aus verstrichener Zeit erraten.
  const laufend = reports.some((r) => r.status === "running");

  // Per Ref statt direkt aus dem State gelesen, damit der Intervall-Callback
  // (der nur einmal beim Start des Laufs neu aufgesetzt wird) immer den
  // aktuellen Stand sieht statt einer veralteten Momentaufnahme.
  const reportsRef = useRef(reports);
  useEffect(() => { reportsRef.current = reports; }, [reports]);

  useEffect(() => {
    if (!laufend) return;
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [laufend]);

  // Stoesst pro laufender Zeile den naechsten Schritt an — das Beziehungsbild
  // entsteht in mehreren kurzen Etappen (Notizen -> Bericht), nicht mehr in
  // einem einzigen, potenziell minutenlangen Hintergrundlauf. Fehler beim
  // Anstossen sind kein Drama, der naechste Tick versucht es erneut.
  async function tick() {
    for (const r of reportsRef.current) {
      if (r.status === "running") {
        try { await callAI({ action: "report_poll", id: r.id }); } catch { /* naechster Tick */ }
      }
    }
    await load();
  }

  async function load() {
    const { data: members } = await supabase.from("couple_members")
      .select("user_id, report_consent").eq("couple_id", membership.couple_id);
    for (const m of members || []) {
      if (m.user_id === membership.user_id) setMyConsent(!!m.report_consent);
      else { setPartnerJoined(true); setPartnerConsent(!!m.report_consent); }
    }
    const { data: r } = await supabase.from("reports")
      .select("id, content, status, error_msg, created_at").order("created_at", { ascending: false });
    setReports(r || []);
  }
  useEffect(() => { load(); }, []);

  async function toggleConsent() {
    setError(null);
    const next = !myConsent;
    const { error } = await supabase.from("couple_members")
      .update({ report_consent: next }).eq("couple_id", membership.couple_id)
      .eq("user_id", membership.user_id);
    if (error) { setError("Freigabe konnte nicht gespeichert werden."); return; }
    setMyConsent(next);
    setMeilensteinKey((k) => k + 1); // "Der naechste Schritt" sofort nachziehen lassen
  }

  // Entscheidung 1 (KONZEPT.md 6): kein Gate bei duennem Material, aber ein
  // ehrlicher Hinweis vor dem Klick. bestaetigt=true ueberspringt die Pruefung
  // (Nutzerin hat die Warnung schon gesehen und bestaetigt).
  async function generate(bestaetigt = false) {
    setError(null); setLetzterFehler(false);
    if (!bestaetigt) {
      try {
        const m = await callAI({ action: "meilensteine" });
        if (m?.bild_duenn) { setWarnungDuenn(true); return; }
      } catch { /* Pruefung optional — im Zweifel einfach erstellen lassen */ }
    }
    setWarnungDuenn(false);
    setBusy(true);
    // Die Benachrichtigung der anderen Seite loest der Server jetzt selbst
    // aus, sobald der Bericht wirklich fertig ist (report_poll) — "fertig"
    // steht bei mehrstufiger Hintergrundverarbeitung erst nach mehreren
    // Poll-Ticks fest, nicht direkt nach diesem Aufruf.
    try {
      await callAI({ action: "report" });
      await load();
    } catch (e) {
      setError("Der Bericht konnte nicht erstellt werden: " + (e?.message || JSON.stringify(e)));
      setLetzterFehler(true);
    }
    setBusy(false);
  }

  const both = myConsent && partnerConsent;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <NaechsterSchritt membership={membership} refreshKey={meilensteinKey} />

      <section style={st.card}>
        <h2 style={st.h2}>Das Beziehungsbild</h2>
        <p style={st.hint}>
          Ein gemeinsamer Bericht in drei Teilen: <em>Das erlebst du · Das erlebt deine Partnerin
          oder dein Partner · Was zwischen euch passiert.</em> Kein Urteil, kein Recht-haben —
          sondern die Chance, einander zum ersten Mal von innen zu sehen.
        </p>
        <p style={st.hint}>
          <strong>Wichtig:</strong> Dafür wertet Zwischenraum das Material von euch beiden gemeinsam
          aus — anders als sonst. Deshalb entsteht der Bericht nur, wenn <strong>beide</strong> aktiv
          freigeben. Deine Rohtexte bekommt die andere Person trotzdem nie zu lesen; der Bericht
          beschreibt Erleben und Bedürfnisse, ohne Zitate und ohne vertrauliche Einzelheiten.
          Du kannst die Freigabe jederzeit zurückziehen.
        </p>
        <ErrorNote>{error}</ErrorNote>
        {letzterFehler && (
          <div style={{ marginBottom: 14 }}>
            <Btn onClick={() => generate(true)} disabled={busy}>
              {busy ? "Neuer Versuch läuft …" : "Erneut versuchen"}
            </Btn>
          </div>
        )}
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", fontSize: 15 }}>
            <input type="checkbox" checked={myConsent} onChange={toggleConsent} />
            <span>Ich gebe mein Material für Beziehungsbild und Spiegel frei</span>
          </label>
          <span style={{ fontSize: 14, color: partnerConsent ? C.ok : C.inkSoft }}>
            {partnerJoined
              ? partnerConsent ? "✓ Freigabe der anderen Seite liegt vor" : "Freigabe der anderen Seite steht noch aus"
              : "Deine Partnerin oder dein Partner ist noch nicht beigetreten"}
          </span>
        </div>
        {both && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Convergence />
            {warnungDuenn ? (
              <div style={{ ...st.card, background: C.paper, textAlign: "left", marginTop: 4 }}>
                <p style={{ ...st.body, margin: 0 }}>
                  Ihr habt bisher wenig geteilt — das Bild wird entsprechend vorsichtig ausfallen.
                  Trotzdem erstellen?
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center" }}>
                  <Btn onClick={() => generate(true)} disabled={busy}>
                    {busy ? "Wird gestartet …" : "Trotzdem erstellen"}
                  </Btn>
                  <Btn variant="ghost" onClick={() => setWarnungDuenn(false)} disabled={busy}>Abbrechen</Btn>
                </div>
              </div>
            ) : (
              <Btn onClick={() => generate(false)} disabled={busy}>
                {busy ? "Wird gestartet …" : reports.length ? "Neues Beziehungsbild erstellen" : "Beziehungsbild erstellen"}
              </Btn>
            )}
            <p style={{ ...st.hint, marginTop: 10 }}>Die Analyse läuft im Hintergrund — du kannst die Seite verlassen und später zurückkommen.</p>
          </div>
        )}
      </section>

      {reports.map((r, i) => (
        <section key={r.id} style={{ ...st.card, borderTop: `4px solid ${C.ink}` }}>
          <span style={{ fontSize: 12, color: C.inkSoft }}>
            {new Date(r.created_at).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}
          </span>
          {r.status === "running" ? (
            <div style={{ marginTop: 8 }}>
              <p style={st.body}>
                {dauertUngewoehnlichLang(r)
                  ? "Zwischenraum denkt noch an eurem Beziehungsbild — das dauert diesmal ungewöhnlich lange. Du kannst die Seite ruhig verlassen, es erscheint hier, sobald es fertig ist, oder es parallel noch einmal versuchen."
                  : "Zwischenraum schreibt euer Beziehungsbild … Das dauert ein bis zwei Minuten. Du kannst die Seite ruhig verlassen — der Bericht erscheint hier, sobald er fertig ist."}
              </p>
              {both && dauertUngewoehnlichLang(r) && (
                <Btn onClick={() => generate(true)} disabled={busy}>
                  {busy ? "Neuer Versuch läuft …" : "Noch einmal versuchen"}
                </Btn>
              )}
            </div>
          ) : r.status === "error" ? (
            <div style={{ marginTop: 8 }}>
              <p style={{ ...st.body, color: C.danger }}>
                Die Erstellung ist fehlgeschlagen{r.error_msg ? `: ${r.error_msg}` : "."}
              </p>
              {both && (
                <Btn onClick={() => generate(true)} disabled={busy}>
                  {busy ? "Neuer Versuch läuft …" : "Noch einmal versuchen"}
                </Btn>
              )}
            </div>
          ) : (
            <>
              <p style={{ ...st.body, whiteSpace: "pre-wrap", marginTop: 8 }}>{r.content}</p>
              <DocChat kind="report" docId={r.id} canWrite={i === 0} />
            </>
          )}
        </section>
      ))}
    </div>
  );
}
