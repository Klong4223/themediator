import React, { useEffect, useRef, useState } from "react";
import { supabase, callAI } from "../supabase.js";
import { C, st, Btn, Convergence, ErrorNote } from "../ui.jsx";
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

// Phasenanzeige (KONZEPT.md Stufe 2): "stage" bildet den echten,
// zweistufigen Ablauf ab (Notizen -> Bericht), seit Beziehungsbild/Spiegel
// ueber die Responses-API laufen. Gruendlichkeit als Qualitaetsmerkmal
// zeigen statt sie hinter einem austauschbaren Ladehinweis zu verstecken.
const phasenText = (zeile) =>
  zeile.stage === "notizen"
    ? "Zwischenraum liest euch beide und vergleicht eure Perspektiven …"
    : "Zwischenraum schreibt euer Beziehungsbild …";

export default function Report({ membership, onGespraech }) {
  const [myConsent, setMyConsent] = useState(false);
  const [partnerConsent, setPartnerConsent] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [letzterFehler, setLetzterFehler] = useState(false);
  // Materialstand: reicht es fuer ein Beziehungsbild? Kommt aus derselben
  // Quelle wie die Server-Sperre, damit Anzeige und Durchsetzung nicht
  // auseinanderlaufen koennen.
  const [material, setMaterial] = useState(null);
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
    // Ueber die Edge Function: der Berichtstext liegt verschluesselt in
    // der Datenbank (CLAUDE.md Backlog 7).
    try {
      const res = await callAI({ action: "reports_list" });
      setReports(res.items || []);
    } catch (e) {
      setError("Beziehungsbilder konnten nicht geladen werden: " + (e?.message || e));
    }
    try {
      setMaterial(await callAI({ action: "meilensteine" }));
    } catch { /* ohne Materialstand faellt nur die Fortschrittsanzeige weg */ }
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

  // Seit 07.08.2026 keine wegklickbare Warnung mehr, sondern eine echte
  // Untergrenze — die der Server ohnehin durchsetzt. Grund: alle bis dahin
  // erstellten Beziehungsbilder entstanden unterhalb der alten Warnschwelle,
  // sie wurde jedes Mal bestaetigt, und Nutzerinnen berichteten, dass ihr
  // eigener Text dabei zu deutlich zur anderen Person durchkam.
  async function generate() {
    setError(null); setLetzterFehler(false);
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
            <Btn onClick={generate} disabled={busy}>
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
            {material?.bild_moeglich === false ? (
              // Kein "trotzdem erstellen" mehr: bei zu wenig Material wuerde
              // der Bericht den eigenen Text zu deutlich wiedergeben. Statt
              // einer Warnung deshalb der Grund und der eigene Fortschritt.
              <div style={{ ...st.card, background: C.paper, textAlign: "left", marginTop: 4 }}>
                <p style={{ ...st.body, margin: 0 }}>{material.grund}</p>
                {material.mein_umfang < material.mindestumfang && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ height: 6, background: C.line, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: 6, borderRadius: 3, background: C.a,
                        width: `${Math.min(100, Math.round((material.mein_umfang / material.mindestumfang) * 100))}%`,
                      }} />
                    </div>
                    <p style={{ ...st.hint, marginTop: 6, marginBottom: 0 }}>
                      Dein Anteil: etwa {Math.min(100, Math.round((material.mein_umfang / material.mindestumfang) * 100))} %
                      — schreib im Tagebuch oder unter „Themen &amp; Konflikte" weiter.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Btn onClick={generate} disabled={busy}>
                  {busy ? "Wird gestartet …" : reports.length ? "Neues Beziehungsbild erstellen" : "Beziehungsbild erstellen"}
                </Btn>
                <p style={{ ...st.hint, marginTop: 10 }}>
                  Die Analyse läuft im Hintergrund und kann 10–20 Minuten dauern, weil Zwischenraum
                  gründlich nachdenkt — du kannst die Seite verlassen und später zurückkommen.
                </p>
              </>
            )}
          </div>
        )}
      </section>

      {reports.map((r) => (
        <section key={r.id} style={{ ...st.card, borderTop: `4px solid ${C.ink}` }}>
          <span style={{ fontSize: 12, color: C.inkSoft }}>
            {new Date(r.created_at).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}
          </span>
          {r.status === "running" ? (
            <div style={{ marginTop: 8 }}>
              <p style={st.body}>
                {dauertUngewoehnlichLang(r)
                  ? "Zwischenraum denkt noch an eurem Beziehungsbild — das dauert diesmal ungewöhnlich lange. Du kannst die Seite ruhig verlassen, es erscheint hier, sobald es fertig ist, oder es parallel noch einmal versuchen."
                  : `${phasenText(r)} Das kann 10–20 Minuten dauern, weil Zwischenraum gründlich nachdenkt. Du kannst die Seite ruhig verlassen — der Bericht erscheint hier, sobald er fertig ist.`}
              </p>
              {both && dauertUngewoehnlichLang(r) && (
                <Btn onClick={generate} disabled={busy}>
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
                <Btn onClick={generate} disabled={busy}>
                  {busy ? "Neuer Versuch läuft …" : "Noch einmal versuchen"}
                </Btn>
              )}
            </div>
          ) : (
            <>
              <p style={{ ...st.body, whiteSpace: "pre-wrap", marginTop: 8 }}>{r.content}</p>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                <p style={{ ...st.hint, margin: 0 }}>
                  Was das in dir auslöst, besprichst du in{" "}
                  {onGespraech ? (
                    <button onClick={onGespraech}
                      style={{ background: "none", border: "none", color: C.a, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline", padding: 0 }}>
                      Dein Raum
                    </button>
                  ) : "Dein Raum"} — nur du siehst dieses Gespräch.
                </p>
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
