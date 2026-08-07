import React, { useEffect, useState } from "react";
import { callAI } from "../supabase.js";
import { C, st, Btn, AIBlock, ErrorNote } from "../ui.jsx";

export default function Diary({ membership }) {
  const [entries, setEntries] = useState([]);
  const [probes, setProbes] = useState([]);
  const [probeDraft, setProbeDraft] = useState("");
  const [probeBusy, setProbeBusy] = useState(false);
  const [replies, setReplies] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyBusy, setReplyBusy] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Backlog Punkt 3/4: der Ladehinweis gehoert dorthin, wo die Antwort
  // erscheint (der neue Eintrag selbst), nicht ans Eingabefeld daneben.
  const [wartend, setWartend] = useState(null);

  // Ein Aufruf statt drei Direktzugriffen: Tagebuch, Konflikte und
  // Nachfragen liegen verschluesselt in der Datenbank (CLAUDE.md
  // Backlog 7), nur die Edge Function hat den Schluessel.
  async function load() {
    try {
      const res = await callAI({ action: "diary_list" });
      setEntries(res.entries || []);
      const grouped = {};
      for (const r of res.replies || []) (grouped[r.entry_id] = grouped[r.entry_id] || []).push(r);
      setReplies(grouped);
      setProbes(res.probes || []);
    } catch (e) {
      setError("Deine Einträge konnten nicht geladen werden: " + (e?.message || e));
    }
  }

  async function fetchProbes() {
    setProbeBusy(true); setError(null);
    try { await callAI({ action: "probe" }); await load(); }
    catch (e) { setError("Fragen konnten nicht erstellt werden: " + (e?.message || JSON.stringify(e))); }
    setProbeBusy(false);
  }

  async function sendReply(entryId) {
    const text = (replyDrafts[entryId] || "").trim();
    if (!text) return;
    setReplyBusy(entryId); setError(null);
    try {
      const res = await callAI({ action: "diary_reply", entry_id: entryId, content: text });
      setReplyDrafts((d) => ({ ...d, [entryId]: "" }));
      await load();
      if (res?.closed) {
        setEntries((prev) => prev.map((x) => x.id === entryId ? { ...x, thread_closed: true } : x));
      }
    } catch (e) {
      setError("Antwort konnte nicht gesendet werden: " + (e?.message || JSON.stringify(e)));
    }
    setReplyBusy(null);
  }

  async function answerProbe(id, answer, skipped) {
    setProbeBusy(true); setError(null);
    try { await callAI({ action: "probe_answer", probe_id: id, answer, skipped }); setProbeDraft(""); await load(); }
    catch (e) { setError("Antwort konnte nicht gespeichert werden."); }
    setProbeBusy(false);
  }
  useEffect(() => { load(); }, []);

  // Speichern und Auswerten laufen jetzt in EINEM Aufruf: nur die Edge
  // Function kann den Text verschluesselt ablegen, ein Direkt-Insert vom
  // Browser aus wuerde Klartext in die Datenbank schreiben.
  //
  // Der Entwurf wird erst geleert, wenn der Server bestaetigt hat -- bei
  // einem Netzfehler bleibt das Getippte stehen.
  async function save() {
    if (!draft.trim()) return;
    setBusy(true); setError(null);
    const text = draft.trim();
    // Der Eintrag erscheint sofort oben in der Liste, mit dem Ladehinweis
    // direkt daran (Backlog Punkt 3). Weil Speichern und Auswerten jetzt
    // ein einziger Aufruf sind, gibt es dafuer noch keine echte ID --
    // deshalb eine vorlaeufige Zeile, die der spaetere load() ersetzt.
    const vorlaeufigeId = "neu";
    setEntries((prev) => [
      { id: vorlaeufigeId, content: text, ai_feedback: null, thread_closed: false,
        created_at: new Date().toISOString() },
      ...prev,
    ]);
    setWartend(vorlaeufigeId);
    setDraft("");
    try {
      await callAI({ action: "diary", content: text });
      setWartend(null);
      await load();
    } catch (e) {
      // Die vorlaeufige Zeile wieder entfernen und den Text ins Feld
      // zuruecklegen -- sonst waere das Getippte weg.
      setEntries((prev) => prev.filter((e2) => e2.id !== vorlaeufigeId));
      setWartend(null);
      setDraft(text);
      setError("Eintrag konnte nicht gespeichert werden: " + (e?.message || JSON.stringify(e)));
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={st.card}>
        <h2 style={st.h2}>Dein Tagebuch</h2>
        <p style={st.hint}>
          Schreibe über dein Leben, dich selbst, eure Partnerschaft — auch über deine Vergangenheit,
          wenn du magst. Vertraulich: Dein Partner sieht nie deinen Text. Zwischenraum liest mit,
          gibt dir Impressionen und stellt Rückfragen — manchmal auch mit Blick auf die andere Seite,
          aber nie mit deren Worten.
        </p>
        <ErrorNote>{error}</ErrorNote>
        <textarea style={st.textarea} rows={6} value={draft} disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Was beschäftigt dich gerade?" />
        <div style={{ marginTop: 12 }}>
          <Btn variant="who" role={membership.role} onClick={save} disabled={busy || !draft.trim()}>
            {busy ? "Wird gespeichert …" : "Eintrag speichern"}
          </Btn>
        </div>
      </section>

      <section style={{ ...st.card, borderTop: `4px solid ${C.ink}` }}>
        <h2 style={st.h2}>Zwischenraum fragt</h2>
        <p style={st.hint}>
          Gezielte Fragen für ein ganzheitliches Bild — sie können aus allem entstehen, was
          Zwischenraum von euch beiden weiß, geben aber nie wieder, was die andere Person
          geschrieben hat. Jede Frage ist freiwillig.
        </p>
        {probes.length === 0 ? (
          <Btn variant="ghost" onClick={fetchProbes} disabled={probeBusy}>
            {probeBusy ? "Zwischenraum überlegt …" : "Frag mich etwas"}
          </Btn>
        ) : (
          <div>
            <p style={{ ...st.body, fontWeight: 600 }}>{probes[0].q}</p>
            <textarea style={{ ...st.textarea, marginTop: 8, minHeight: 90 }} rows={3}
              value={probeDraft} onChange={(e) => setProbeDraft(e.target.value)}
              placeholder="Deine Antwort …" disabled={probeBusy} />
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <Btn variant="who" role={membership.role} disabled={probeBusy || !probeDraft.trim()}
                onClick={() => answerProbe(probes[0].id, probeDraft.trim(), false)}>
                {probeBusy ? "Wird gespeichert …" : "Antworten"}
              </Btn>
              <Btn variant="ghost" disabled={probeBusy}
                onClick={() => answerProbe(probes[0].id, null, true)}>Überspringen</Btn>
              {probes.length > 1 && <span style={{ fontSize: 13, color: C.inkSoft }}>+{probes.length - 1} weitere</span>}
            </div>
          </div>
        )}
      </section>

      {entries.map((e) => (
        <section key={e.id} style={st.card}>
          <span style={{ fontSize: 12, color: C.inkSoft }}>
            {new Date(e.created_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <p style={{ ...st.body, whiteSpace: "pre-wrap" }}>{e.content}</p>
          {e.id === wartend ? (
            <p style={{ ...st.hint, marginTop: 10, fontStyle: "italic" }}>Zwischenraum liest deinen Eintrag …</p>
          ) : (
            <AIBlock title="ZWISCHENRAUM" text={e.ai_feedback} />
          )}
          {(replies[e.id] || []).map((r, i) => (
            r.role === "ai"
              ? <AIBlock key={i} title="ZWISCHENRAUM" text={r.content} />
              : <p key={i} style={{ ...st.body, marginTop: 12, paddingLeft: 12, borderLeft: `3px solid ${membership.role === "A" ? C.a : C.b}`, whiteSpace: "pre-wrap" }}>{r.content}</p>
          ))}
          {e.ai_feedback && !e.thread_closed && (
            <div style={{ marginTop: 12 }}>
              <textarea style={{ ...st.textarea, minHeight: 70 }} rows={2}
                value={replyDrafts[e.id] || ""} disabled={replyBusy === e.id}
                onChange={(ev) => setReplyDrafts((d) => ({ ...d, [e.id]: ev.target.value }))}
                placeholder="Darauf antworten … (kurze Vertiefung, kein Chat)" />
              <div style={{ marginTop: 8 }}>
                <Btn variant="who" role={membership.role} disabled={replyBusy === e.id || !(replyDrafts[e.id] || "").trim()}
                  onClick={() => sendReply(e.id)}>
                  {replyBusy === e.id ? "Wird gesendet …" : "Antworten"}
                </Btn>
              </div>
              {replyBusy === e.id && (
                <p style={{ ...st.hint, marginTop: 10, fontStyle: "italic" }}>Zwischenraum liest und antwortet …</p>
              )}
            </div>
          )}
          {e.thread_closed && (replies[e.id] || []).length > 0 && (
            <p style={{ ...st.hint, marginTop: 10 }}>
              ✓ Dieses Gespräch ist abgeschlossen. Wenn dich davon etwas weiter beschäftigt,
              schreib einen neuen Eintrag — er öffnet ein neues Gespräch.
            </p>
          )}
        </section>
      ))}
      {entries.length === 0 && (
        <p style={{ ...st.hint, textAlign: "center" }}>Noch keine Einträge. Dein erster Eintrag öffnet den Prozess.</p>
      )}
    </div>
  );
}
