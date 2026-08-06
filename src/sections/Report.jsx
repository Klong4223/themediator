import React, { useEffect, useRef, useState } from "react";
import { supabase, callAI } from "../supabase.js";
import { C, st, Btn, Convergence, ErrorNote } from "../ui.jsx";

// Ein Lauf, der von der Laufzeitumgebung abgeräumt wird, bleibt in der
// Datenbank auf "running" stehen — ohne diesen Riegel würde die Seite endlos
// weiterwarten. Nach dieser Zeit gilt ein Lauf als abgebrochen.
const ABGEBROCHEN_NACH_MS = 10 * 60 * 1000;

const istHaengend = (zeile) =>
  zeile.status === "running" &&
  Date.now() - new Date(zeile.created_at).getTime() > ABGEBROCHEN_NACH_MS;

export default function Report({ membership }) {
  const [myConsent, setMyConsent] = useState(false);
  const [partnerConsent, setPartnerConsent] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [reports, setReports] = useState([]);
  const [mirrors, setMirrors] = useState([]);
  const [mirrorBusy, setMirrorBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [letzterFehler, setLetzterFehler] = useState(null);

  // Hängende Läufe zählen nicht als "laufend" — sonst pollt die Seite ewig weiter.
  const laufend = reports.some((r) => r.status === "running" && !istHaengend(r))
    || mirrors.some((m) => m.status === "running" && !istHaengend(m));

  // Per Ref statt direkt aus dem State gelesen, damit der Intervall-Callback
  // (der nur einmal beim Start des Laufs neu aufgesetzt wird) immer den
  // aktuellen Stand sieht statt einer veralteten Momentaufnahme.
  const reportsRef = useRef(reports);
  const mirrorsRef = useRef(mirrors);
  useEffect(() => { reportsRef.current = reports; }, [reports]);
  useEffect(() => { mirrorsRef.current = mirrors; }, [mirrors]);

  useEffect(() => {
    if (!laufend) return;
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [laufend]);

  // Stoesst pro laufender (nicht haengender) Zeile den naechsten Schritt an —
  // Beziehungsbild und Spiegel entstehen jetzt in mehreren kurzen Etappen
  // (Notizen -> Bericht/Spiegel), nicht mehr in einem einzigen, potenziell
  // minutenlangen Hintergrundlauf. Fehler beim Anstossen sind kein Drama,
  // der naechste Tick versucht es erneut.
  async function tick() {
    for (const r of reportsRef.current) {
      if (r.status === "running" && !istHaengend(r)) {
        try { await callAI({ action: "report_poll", id: r.id }); } catch { /* naechster Tick */ }
      }
    }
    for (const m of mirrorsRef.current) {
      if (m.status === "running" && !istHaengend(m)) {
        try { await callAI({ action: "mirror_poll", id: m.id }); } catch { /* naechster Tick */ }
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
    const { data: m } = await supabase.from("mirrors")
      .select("id, content, status, error_msg, created_at").order("created_at", { ascending: false });
    setMirrors(m || []);
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
  }

  async function generateMirror() {
    setMirrorBusy(true); setError(null); setLetzterFehler(null);
    try {
      await callAI({ action: "mirror" });
      await load();
      setMirrorBusy(false);
      return;
    } catch (e) {
      setError("Der Spiegel konnte nicht erstellt werden: " + (e?.message || JSON.stringify(e)));
      setLetzterFehler("mirror");
    }
    setMirrorBusy(false);
  }

  // Die Benachrichtigung der anderen Seite loest der Server jetzt selbst aus,
  // sobald der Bericht wirklich fertig ist (report_poll) — nicht mehr hier,
  // weil "fertig" bei mehrstufiger Hintergrundverarbeitung erst nach
  // mehreren Poll-Ticks feststeht, nicht direkt nach diesem Aufruf.
  async function generate() {
    setBusy(true); setError(null); setLetzterFehler(null);
    try {
      await callAI({ action: "report" });
      await load();
      setBusy(false);
      return;
    } catch (e) {
      setError("Der Bericht konnte nicht erstellt werden: " + (e?.message || JSON.stringify(e)));
      setLetzterFehler("report");
    }
    setBusy(false);
  }

  const both = myConsent && partnerConsent;

  return (
    <div style={{ display: "grid", gap: 20 }}>
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
            <Btn onClick={() => (letzterFehler === "report" ? generate() : generateMirror())}
              disabled={busy || mirrorBusy}>
              {busy || mirrorBusy ? "Neuer Versuch läuft …" : "Erneut versuchen"}
            </Btn>
          </div>
        )}
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", fontSize: 15 }}>
            <input type="checkbox" checked={myConsent} onChange={toggleConsent} />
            <span>Ich gebe mein Material für das Beziehungsbild frei</span>
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
            <Btn onClick={generate} disabled={busy}>
              {busy ? "Wird gestartet …" : reports.length ? "Neues Beziehungsbild erstellen" : "Beziehungsbild erstellen"}
            </Btn>
            <p style={{ ...st.hint, marginTop: 10 }}>Die Analyse läuft im Hintergrund — du kannst die Seite verlassen und später zurückkommen.</p>
          </div>
        )}
      </section>

      <section style={st.card}>
        <h2 style={st.h2}>Dein Spiegel</h2>
        <p style={st.hint}>
          Individuelles Feedback nur für dich: Zwischenraum kennt beide Seiten, richtet den Blick
          aber ausschließlich auf <em>dich</em> — Selbstbild und Wirkung, dein Anteil an eurer
          Dynamik, blinde Flecken, Stärken und Wachstumskanten. Nichts daraus verrät, was die
          andere Person privat geschrieben hat. Beide können sich einen Spiegel erstellen;
          den Inhalt sieht jeder nur selbst. Freigabe-Rahmen: derselbe wie beim Beziehungsbild.
        </p>
        {both ? (
          <div style={{ textAlign: "center" }}>
            <Btn onClick={generateMirror} disabled={mirrorBusy}>
              {mirrorBusy ? "Wird gestartet …" : mirrors.length ? "Neuen Spiegel erstellen" : "Deinen Spiegel erstellen"}
            </Btn>
          </div>
        ) : (
          <p style={{ ...st.hint, textAlign: "center" }}>Verfügbar, sobald beide oben freigegeben haben.</p>
        )}
        {mirrors.map((m) => (
          <div key={m.id} style={{ background: C.paper, borderLeft: `3px solid ${membership.role === "A" ? C.a : C.b}`, borderRadius: 8, padding: "12px 14px", marginTop: 14 }}>
            <span style={{ fontSize: 12, color: C.inkSoft }}>
              {new Date(m.created_at).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}
            </span>
            {m.status === "running" && !istHaengend(m) ? (
              <p style={{ ...st.body, marginTop: 6 }}>Zwischenraum schaut genau hin … Das dauert ein bis zwei Minuten.</p>
            ) : m.status === "error" || istHaengend(m) ? (
              <div style={{ marginTop: 6 }}>
                <p style={{ ...st.body, color: C.danger }}>
                  {istHaengend(m)
                    ? "Die Erstellung wurde abgebrochen — sie hat länger gedauert, als der Server zulässt."
                    : `Fehlgeschlagen${m.error_msg ? `: ${m.error_msg}` : "."}`}
                </p>
                <Btn onClick={generateMirror} disabled={mirrorBusy}>
                  {mirrorBusy ? "Neuer Versuch läuft …" : "Noch einmal versuchen"}
                </Btn>
              </div>
            ) : (
              <p style={{ ...st.body, whiteSpace: "pre-wrap", marginTop: 6 }}>{m.content}</p>
            )}
          </div>
        ))}
      </section>

      {reports.map((r) => (
        <section key={r.id} style={{ ...st.card, borderTop: `4px solid ${C.ink}` }}>
          <span style={{ fontSize: 12, color: C.inkSoft }}>
            {new Date(r.created_at).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}
          </span>
          {r.status === "running" && !istHaengend(r) ? (
            <p style={{ ...st.body, marginTop: 8 }}>
              Zwischenraum schreibt euer Beziehungsbild … Das dauert ein bis zwei Minuten.
              Du kannst die Seite ruhig verlassen — der Bericht erscheint hier, sobald er fertig ist.
            </p>
          ) : r.status === "error" || istHaengend(r) ? (
            <div style={{ marginTop: 8 }}>
              <p style={{ ...st.body, color: C.danger }}>
                {istHaengend(r)
                  ? "Die Erstellung wurde abgebrochen — sie hat länger gedauert, als der Server zulässt."
                  : `Die Erstellung ist fehlgeschlagen${r.error_msg ? `: ${r.error_msg}` : "."}`}
              </p>
              {both && (
                <Btn onClick={generate} disabled={busy}>
                  {busy ? "Neuer Versuch läuft …" : "Noch einmal versuchen"}
                </Btn>
              )}
            </div>
          ) : (
            <p style={{ ...st.body, whiteSpace: "pre-wrap", marginTop: 8 }}>{r.content}</p>
          )}
        </section>
      ))}
    </div>
  );
}
