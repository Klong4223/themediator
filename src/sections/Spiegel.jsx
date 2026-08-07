import React, { useEffect, useRef, useState } from "react";
import { supabase, callAI } from "../supabase.js";
import { C, st, Btn, ErrorNote } from "../ui.jsx";
import DocChat from "./DocChat.jsx";

// Aus Report.jsx herausgeloest (KONZEPT.md 7.4): der Spiegel ist privates
// Feedback und gehoert zu "Dein Raum" (eingebunden in AboutYou.jsx), nicht
// zum Zwischenraum-Tab, der allein dem Beziehungsbild gehoert.
//
// Die Freigabe ist DASSELBE Datenbankfeld wie beim Beziehungsbild
// (couple_members.report_consent) -- absichtlich in beiden Raeumen
// umschaltbar, kein separates Feld. Toggle hier oder in Report.jsx
// aktualisiert dieselbe Quelle, es gibt keine Inkonsistenz-Gefahr.
const UNGEWOEHNLICH_LANGE_MS = 20 * 60 * 1000;
const dauertUngewoehnlichLang = (zeile) =>
  zeile.status === "running" &&
  Date.now() - new Date(zeile.created_at).getTime() > UNGEWOEHNLICH_LANGE_MS;

// Phasenanzeige (KONZEPT.md Stufe 2), siehe Report.jsx fuer den gleichen
// Gedanken beim Beziehungsbild: "stage" bildet den echten zweistufigen
// Ablauf ab (Notizen -> Spiegel).
const phasenText = (zeile) =>
  zeile.stage === "notizen"
    ? "Zwischenraum schaut sich eure Situation an …"
    : "Zwischenraum schreibt deinen Spiegel …";

export default function Spiegel({ membership }) {
  const [myConsent, setMyConsent] = useState(false);
  const [partnerConsent, setPartnerConsent] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [mirrors, setMirrors] = useState([]);
  const [mirrorBusy, setMirrorBusy] = useState(false);
  const [error, setError] = useState(null);

  const laufend = mirrors.some((m) => m.status === "running");
  const mirrorsRef = useRef(mirrors);
  useEffect(() => { mirrorsRef.current = mirrors; }, [mirrors]);

  useEffect(() => {
    if (!laufend) return;
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [laufend]);

  async function tick() {
    for (const m of mirrorsRef.current) {
      if (m.status === "running") {
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
    // Ueber die Edge Function: der Spiegeltext liegt verschluesselt in
    // der Datenbank (CLAUDE.md Backlog 7).
    try {
      const res = await callAI({ action: "mirrors_list" });
      setMirrors(res.items || []);
    } catch (e) {
      setError("Spiegel konnten nicht geladen werden: " + (e?.message || e));
    }
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
    setMirrorBusy(true); setError(null);
    try {
      await callAI({ action: "mirror" });
      await load();
    } catch (e) {
      setError("Der Spiegel konnte nicht erstellt werden: " + (e?.message || JSON.stringify(e)));
    }
    setMirrorBusy(false);
  }

  const both = myConsent && partnerConsent;

  return (
    <section style={st.card}>
      <h2 style={st.h2}>Dein Spiegel</h2>
      <p style={st.hint}>
        Individuelles Feedback nur für dich: Zwischenraum kennt beide Seiten, richtet den Blick
        aber ausschließlich auf <em>dich</em> — Selbstbild und Wirkung, dein Anteil an eurer
        Dynamik, blinde Flecken, Stärken und Wachstumskanten. Nichts daraus verrät, was die
        andere Person privat geschrieben hat.
      </p>
      <ErrorNote>{error}</ErrorNote>
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
      {both ? (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <Btn onClick={generateMirror} disabled={mirrorBusy}>
            {mirrorBusy ? "Wird gestartet …" : mirrors.length ? "Neuen Spiegel erstellen" : "Deinen Spiegel erstellen"}
          </Btn>
        </div>
      ) : (
        <p style={{ ...st.hint, textAlign: "center", marginTop: 14 }}>Verfügbar, sobald beide oben freigegeben haben.</p>
      )}
      {mirrors.map((m, i) => (
        <div key={m.id} style={{ background: C.paper, borderLeft: `3px solid ${membership.role === "A" ? C.a : C.b}`, borderRadius: 8, padding: "12px 14px", marginTop: 14 }}>
          <span style={{ fontSize: 12, color: C.inkSoft }}>
            {new Date(m.created_at).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}
          </span>
          {m.status === "running" ? (
            <div style={{ marginTop: 6 }}>
              <p style={st.body}>
                {dauertUngewoehnlichLang(m)
                  ? "Zwischenraum denkt noch — das dauert diesmal ungewöhnlich lange. Du kannst weiter warten oder es parallel noch einmal versuchen."
                  : `${phasenText(m)} Das kann 10–20 Minuten dauern, weil Zwischenraum gründlich nachdenkt.`}
              </p>
              {dauertUngewoehnlichLang(m) && (
                <Btn onClick={generateMirror} disabled={mirrorBusy}>
                  {mirrorBusy ? "Neuer Versuch läuft …" : "Noch einmal versuchen"}
                </Btn>
              )}
            </div>
          ) : m.status === "error" ? (
            <div style={{ marginTop: 6 }}>
              <p style={{ ...st.body, color: C.danger }}>
                Fehlgeschlagen{m.error_msg ? `: ${m.error_msg}` : "."}
              </p>
              <Btn onClick={generateMirror} disabled={mirrorBusy}>
                {mirrorBusy ? "Neuer Versuch läuft …" : "Noch einmal versuchen"}
              </Btn>
            </div>
          ) : (
            <>
              <p style={{ ...st.body, whiteSpace: "pre-wrap", marginTop: 6 }}>{m.content}</p>
              <DocChat kind="mirror" docId={m.id} canWrite={i === 0} />
            </>
          )}
        </div>
      ))}
    </section>
  );
}
