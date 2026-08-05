import React, { useEffect, useState } from "react";
import { supabase, callAI } from "../supabase.js";
import { C, st, Btn, Convergence, ErrorNote } from "../ui.jsx";

export default function Report({ membership }) {
  const [myConsent, setMyConsent] = useState(false);
  const [partnerConsent, setPartnerConsent] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [reports, setReports] = useState([]);
  const [mirrors, setMirrors] = useState([]);
  const [mirrorBusy, setMirrorBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    const { data: members } = await supabase.from("couple_members")
      .select("user_id, report_consent").eq("couple_id", membership.couple_id);
    for (const m of members || []) {
      if (m.user_id === membership.user_id) setMyConsent(!!m.report_consent);
      else { setPartnerJoined(true); setPartnerConsent(!!m.report_consent); }
    }
    const { data: r } = await supabase.from("reports")
      .select("id, content, created_at").order("created_at", { ascending: false });
    setReports(r || []);
    const { data: m } = await supabase.from("mirrors")
      .select("id, content, created_at").order("created_at", { ascending: false });
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
    setMirrorBusy(true); setError(null);
    try {
      await callAI({ action: "mirror" });
      await load();
    } catch (e) {
      setError("Der Spiegel konnte nicht erstellt werden. Bitte erneut versuchen.");
    }
    setMirrorBusy(false);
  }

  async function generate() {
    setBusy(true); setError(null);
    try {
      await callAI({ action: "report" });
      try { await callAI({ action: "notify", kind: "report" }); } catch { /* optional */ }
      await load();
    } catch (e) {
      setError("Der Bericht konnte nicht erstellt werden. Bitte erneut versuchen.");
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
              {busy ? "Zwischenraum schreibt euer Beziehungsbild …" : reports.length ? "Neues Beziehungsbild erstellen" : "Beziehungsbild erstellen"}
            </Btn>
            {busy && <p style={{ ...st.hint, marginTop: 10 }}>Das dauert einen Moment — es ist der tiefste Blick, den Zwischenraum wirft.</p>}
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
              {mirrorBusy ? "Zwischenraum schaut genau hin …" : mirrors.length ? "Neuen Spiegel erstellen" : "Deinen Spiegel erstellen"}
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
            <p style={{ ...st.body, whiteSpace: "pre-wrap", marginTop: 6 }}>{m.content}</p>
          </div>
        ))}
      </section>

      {reports.map((r) => (
        <section key={r.id} style={{ ...st.card, borderTop: `4px solid ${C.ink}` }}>
          <span style={{ fontSize: 12, color: C.inkSoft }}>
            {new Date(r.created_at).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}
          </span>
          <p style={{ ...st.body, whiteSpace: "pre-wrap", marginTop: 8 }}>{r.content}</p>
        </section>
      ))}
    </div>
  );
}
