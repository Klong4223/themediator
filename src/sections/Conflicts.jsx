import React, { useEffect, useState } from "react";
import { supabase, callAI } from "../supabase.js";
import { C, st, Btn, AIBlock, ErrorNote } from "../ui.jsx";

export default function Conflicts({ membership }) {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Backlog Punkt 4: der Ladehinweis gehoert an den Eintrag selbst, nicht
  // nur an den Knopf oben (gleiches Muster wie im Tagebuch, Punkt 3).
  const [wartend, setWartend] = useState(null);

  async function load() {
    const { data } = await supabase
      .from("conflicts")
      .select("id, title, content, ai_reflection, created_at")
      .order("created_at", { ascending: false });
    setItems(data || []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!draft.trim()) return;
    setBusy(true); setError(null);
    let conflictId = null;
    try {
      const { data, error } = await supabase
        .from("conflicts")
        .insert({ couple_id: membership.couple_id, title: title.trim() || null, content: draft.trim() })
        .select("id").single();
      if (error) throw error;
      conflictId = data.id;
      setTitle(""); setDraft("");
      setWartend(conflictId);
      await load(); // erscheint sofort oben, Ladehinweis steht direkt daran
    } catch (e) {
      setError("Fehler: " + (e?.message || JSON.stringify(e)));
      setBusy(false);
      return;
    }
    try {
      await callAI({ action: "conflict", conflict_id: conflictId });
    } catch (e) {
      setError("Dein Eintrag ist gespeichert, aber die Reflexion schlug fehl: " + (e?.message || JSON.stringify(e)));
    }
    setWartend(null);
    await load();
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={st.card}>
        <h2 style={st.h2}>Ein Thema oder einen Konflikt beschreiben</h2>
        <p style={st.hint}>
          Ein konkreter Streit — oder das große Ganze: eine Frage, die zwischen euch steht,
          etwas Grundsätzliches, das dich beschäftigt. Beides gehört hierher. Beschreibe es aus
          deiner Sicht — auch das, was schwer zuzugeben ist.
          Zwischenraum verknüpft dies mit allem, was es von euch beiden weiß, schlägt Reflexion
          und Vermittlung vor — und spricht offen an, wo etwas beschönigt sein könnte. Auch hier
          gilt: Dein Text bleibt bei dir.
        </p>
        <ErrorNote>{error}</ErrorNote>
        <input style={st.input} placeholder="Kurzer Titel (optional)" value={title} disabled={busy}
          onChange={(e) => setTitle(e.target.value)} />
        <textarea style={{ ...st.textarea, marginTop: 10 }} rows={6} value={draft} disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Was ist passiert — oder was steht grundsätzlich zwischen euch?" />
        <div style={{ marginTop: 12 }}>
          <Btn variant="who" role={membership.role} onClick={save} disabled={busy || !draft.trim()}>
            {busy ? "Wird gespeichert …" : "Einreichen"}
          </Btn>
        </div>
      </section>

      {items.map((k) => (
        <section key={k.id} style={{ ...st.card, borderTop: `4px solid ${membership.role === "A" ? C.a : C.b}` }}>
          <span style={{ fontSize: 12, color: C.inkSoft }}>
            {new Date(k.created_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
          </span>
          {k.title && <h2 style={{ ...st.h2, marginTop: 4 }}>{k.title}</h2>}
          <p style={{ ...st.body, whiteSpace: "pre-wrap" }}>{k.content}</p>
          {k.id === wartend ? (
            <p style={{ ...st.hint, marginTop: 10, fontStyle: "italic" }}>Zwischenraum denkt darüber nach …</p>
          ) : (
            <AIBlock title="REFLEXION & VERMITTLUNG" text={k.ai_reflection} />
          )}
        </section>
      ))}
      {items.length === 0 && (
        <p style={{ ...st.hint, textAlign: "center" }}>Noch keine Themen oder Konflikte beschrieben.</p>
      )}
    </div>
  );
}
