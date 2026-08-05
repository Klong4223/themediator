import React, { useEffect, useState } from "react";
import { supabase, callAI } from "./supabase.js";
import { C, st, font, Btn, Shell, ErrorNote } from "./ui.jsx";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    try { setStats(await callAI({ action: "admin_stats" })); }
    catch (e) { setError("Statistiken konnten nicht geladen werden."); }
  }
  useEffect(() => { load(); }, []);

  const Big = ({ label, value, sub }) => (
    <div style={{ ...st.card, textAlign: "center", padding: "22px 16px" }}>
      <div style={{ fontFamily: font.display, fontSize: 40, fontWeight: 600, color: C.ink }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ ...st.h1, fontSize: 26 }}>Zwischenraum · Admin</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={load}>Aktualisieren</Btn>
          <Btn variant="ghost" onClick={() => supabase.auth.signOut()}>Abmelden</Btn>
        </div>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {!stats ? <p style={st.hint}>Lade …</p> : (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <Big label="Partner-Beitrittsquote"
              value={stats.beitrittsquote != null ? `${stats.beitrittsquote}%` : "—"}
              sub={`${stats.couples_full} von ${stats.couples_total} Räumen vollständig`} />
            <Big label="Beziehungsbild-Quote"
              value={stats.beziehungsbild_quote != null ? `${stats.beziehungsbild_quote}%` : "—"}
              sub={`${stats.couples_with_report} von ${stats.couples_full} vollständigen Paaren`} />
            <Big label="4-Wochen-Retention"
              value={stats.retention_quote != null ? `${stats.retention_quote}%` : "—"}
              sub={stats.couples_older_28d
                ? `${stats.retained_28d} von ${stats.couples_older_28d} älteren Paaren zuletzt aktiv`
                : "Noch keine Paare älter als 28 Tage"} />
          </div>
          <section style={st.card}>
            <h2 style={st.h2}>Aktivität</h2>
            <p style={{ ...st.body, fontSize: 14.5 }}>
              Aktive Paare (letzte 7 Tage): <strong>{stats.active_couples_7d}</strong> ·
              Nutzer gesamt: <strong>{stats.users_total}</strong> ·
              Tagebucheinträge: <strong>{stats.diary_total}</strong> ·
              Themen/Konflikte: <strong>{stats.conflicts_total}</strong> ·
              Beziehungsbilder: <strong>{stats.reports_total}</strong> ·
              Spiegel: <strong>{stats.mirrors_total}</strong>
            </p>
          </section>
          <p style={st.hint}>
            Nur aggregierte Zahlen — Inhalte, Namen und Zuordnungen sind hier bewusst nicht einsehbar.
          </p>
        </div>
      )}
    </Shell>
  );
}
