import React, { useEffect, useState } from "react";
import { supabase, callAI } from "../supabase.js";
import { C, st, Btn, AIBlock, ErrorNote } from "../ui.jsx";

export const QUESTIONS = [
  // Block A — Konflikt & Bindung
  { id: "q1", block: "Konflikt & Bindung", text: "Wenn wir streiten, reagiere ich meistens …", type: "choice",
    options: ["Ich ziehe mich zurück", "Ich werde laut oder heftig", "Ich will sofort klären", "Ich lenke ab oder mache Witze", "Sehr unterschiedlich"] },
  { id: "q2", block: "Konflikt & Bindung", text: "Nach einem Streit brauche ich vor allem …", type: "choice",
    options: ["Zeit für mich", "Schnelle Versöhnung", "Körperliche Nähe", "Ein klärendes Gespräch"] },
  { id: "q3", block: "Konflikt & Bindung", text: "Was verletzt dich in Konflikten am meisten?", type: "text" },
  { id: "q4", block: "Konflikt & Bindung", text: "Wie leicht fällt es dir, über deine Gefühle zu sprechen? (1 = sehr schwer, 5 = sehr leicht)", type: "scale" },
  { id: "q5", block: "Konflikt & Bindung", text: "Wovor hast du in eurer Beziehung am meisten Sorge?", type: "text" },
  // Block B — Bedürfnisse & Werte
  { id: "q6", block: "Bedürfnisse & Werte", text: "Was ist dir in einer Beziehung am wichtigsten? (wähle das Stärkste)", type: "choice",
    options: ["Körperliche Nähe und Zärtlichkeit", "Emotionale Nähe und Verbundenheit", "Freiraum und Eigenständigkeit", "Sicherheit und Verlässlichkeit", "Anerkennung und Wertschätzung", "Gemeinsame Entwicklung und Abenteuer"] },
  { id: "q6b", block: "Bedürfnisse & Werte", text: "Wie erlebst du körperliche Nähe und Zärtlichkeit bei euch?", type: "choice",
    options: ["Stimmig — passt für mich", "Ich wünsche mir mehr", "Ich wünsche mir mehr Zeit für mich", "Wir sprechen zu selten darüber", "Es ist gerade ein wunder Punkt"] },
  { id: "q6c", block: "Bedürfnisse & Werte", text: "Was würdest du dir in Sachen Nähe und Intimität wünschen, wenn alles möglich wäre? (optional)", type: "text", optional: true },
  { id: "q7", block: "Bedürfnisse & Werte", text: "Ich fühle mich geliebt, wenn …", type: "text" },
  { id: "q8", block: "Bedürfnisse & Werte", text: "Wieviel gemeinsame Zeit ist für dich ideal?", type: "choice",
    options: ["So viel wie möglich", "Ein guter Mix aus gemeinsam und getrennt", "Qualität vor Quantität — wenige, intensive Momente", "Ich brauche viel Zeit für mich"] },
  { id: "q9", block: "Bedürfnisse & Werte", text: "Was schätzt du an deiner Partnerin oder deinem Partner am meisten?", type: "text" },
  { id: "q10", block: "Bedürfnisse & Werte", text: "Wo gehst du in eurer Beziehung die größten Kompromisse ein?", type: "text" },
  // Block C — Prägung
  { id: "q11", block: "Prägung", text: "Wie wurde in dem Zuhause, in dem du aufgewachsen bist, gestritten?", type: "choice",
    options: ["Laut und offen", "Gar nicht — Konflikte wurden vermieden", "Kühl und schweigend", "Meist konstruktiv", "Sehr wechselhaft"] },
  { id: "q12", block: "Prägung", text: "Und wie wurde sich versöhnt?", type: "text" },
  { id: "q13", block: "Prägung", text: "Was möchtest du in deiner Beziehung anders machen als die Erwachsenen, bei denen du aufgewachsen bist?", type: "text" },
  { id: "q14", block: "Prägung", text: "Gibt es frühere Erfahrungen (Beziehungen, Ereignisse), die dich bis heute prägen? (optional)", type: "text", optional: true },
  { id: "q15", block: "Prägung", text: "Was sollte Zwischenraum sonst noch über dich wissen? (optional)", type: "text", optional: true },
];

export default function AboutYou({ membership }) {
  const [row, setRow] = useState(undefined);
  const [profile, setProfile] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("assessments").select("*")
      .eq("user_id", membership.user_id).maybeSingle();
    setRow(data || null);
    const { data: p } = await supabase.from("ai_profiles").select("profile")
      .eq("user_id", membership.user_id).maybeSingle();
    setProfile(p?.profile || "");
  }
  useEffect(() => { load(); }, []);

  async function submitQuestionnaire(answers) {
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.from("assessments").upsert({
        couple_id: membership.couple_id, user_id: membership.user_id,
        answers, completed: true, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await callAI({ action: "assessment" });
      await load();
    } catch (e) {
      setError("Auswertung fehlgeschlagen. Deine Antworten sind gesichert — versuche es gleich erneut über den Knopf unten.");
      await load();
    }
    setBusy(false);
  }

  async function answerFollowup(index, answer) {
    setBusy(true); setError(null);
    try {
      await callAI({ action: "assessment_followup", index, answer });
      await load();
    } catch (e) {
      setError("Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.");
    }
    setBusy(false);
  }

  if (row === undefined) return <p style={st.hint}>Lade …</p>;

  async function skip() {
    await supabase.from("assessments").upsert({
      couple_id: membership.couple_id, user_id: membership.user_id,
      skipped: true, updated_at: new Date().toISOString(),
    });
    await load();
  }
  async function unskip() {
    await supabase.from("assessments").upsert({
      couple_id: membership.couple_id, user_id: membership.user_id,
      skipped: false, updated_at: new Date().toISOString(),
    });
    await load();
  }

  // 0) Übersprungen: freier Weg
  if (row?.skipped && !row?.completed) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <section style={st.card}>
          <h2 style={st.h2}>Du gehst den freien Weg ✓</h2>
          <p style={st.hint}>
            Kein Fragebogen — schreib einfach Tagebuch. Zwischenraum stellt dir dort gezielte
            Fragen zu dem, was ihm für ein faires Bild noch fehlt. Wenn du doch lieber einen
            Rahmen möchtest, kannst du jederzeit starten.
          </p>
          <Btn variant="ghost" onClick={unskip}>Fragebogen doch machen</Btn>
        </section>
        <section style={st.card}>
          <h2 style={st.h2}>So versteht dich Zwischenraum</h2>
          <p style={{ ...st.body, whiteSpace: "pre-wrap" }}>{profile || "(noch leer — dein erster Tagebucheintrag füllt es)"}</p>
        </section>
      </div>
    );
  }

  // 1) Fragebogen noch offen
  if (!row?.completed) {
    return (
      <div>
        <ErrorNote>{error}</ErrorNote>
        <p style={{ ...st.hint, textAlign: "center" }}>
          Der Fragebogen ist optional — er hilft beim Einstieg, wenn du nicht weißt, wo anfangen.{" "}
          <button onClick={skip} style={{ background: "none", border: "none", color: C.inkSoft, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", fontSize: 13.5, padding: 0 }}>
            Lieber frei schreiben? Überspringen
          </button>
        </p>
        <Wizard membership={membership} busy={busy} onSubmit={submitQuestionnaire} />
      </div>
    );
  }

  // 2) Fragebogen fertig, aber Auswertung/Nachfragen fehlen noch
  const followups = row.followups || [];
  const nextIdx = followups.findIndex((f) => !f.a);
  if (followups.length === 0 && !row.interview_done) {
    return (
      <section style={{ ...st.card, textAlign: "center" }}>
        <ErrorNote>{error}</ErrorNote>
        <p style={st.body}>Deine Antworten sind gespeichert, die Auswertung steht noch aus.</p>
        <div style={{ marginTop: 12 }}>
          <Btn onClick={() => submitQuestionnaire(row.answers)} disabled={busy}>
            {busy ? "Zwischenraum wertet aus …" : "Auswertung starten"}
          </Btn>
        </div>
      </section>
    );
  }

  // 3) KI-Interview: Nachfragen beantworten
  if (!row.interview_done && nextIdx >= 0) {
    return (
      <Interview membership={membership} followups={followups} nextIdx={nextIdx}
        busy={busy} error={error} onAnswer={answerFollowup} />
    );
  }

  // 4) Fertig: Transparenz-Ansicht
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={st.card}>
        <h2 style={st.h2}>Deine Basis steht ✓</h2>
        <p style={st.hint}>
          Fragebogen und Nachfragen sind abgeschlossen. Zwischenraum nutzt dieses Verständnis
          ab jetzt in Tagebuch, Konflikten und im gemeinsamen Raum — dein Partner sieht davon nichts.
        </p>
      </section>
      <section style={st.card}>
        <h2 style={st.h2}>So versteht dich Zwischenraum</h2>
        <p style={st.hint}>Dein verdichtetes Profil — es wächst mit jedem Eintrag weiter. Nur du siehst es.</p>
        <p style={{ ...st.body, whiteSpace: "pre-wrap" }}>{profile || "(noch leer)"}</p>
      </section>
    </div>
  );
}

/* ─── Fragebogen-Wizard ─────────────────────────────────── */
function Wizard({ membership, busy, onSubmit }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const [textDraft, setTextDraft] = useState("");
  const [other, setOther] = useState(false);
  const q = QUESTIONS[i];
  const total = QUESTIONS.length;

  function next(value) {
    const a = { ...answers, [q.id]: { frage: q.text, antwort: value } };
    setAnswers(a);
    setTextDraft("");
    if (i + 1 < total) setI(i + 1);
    else onSubmit(a);
  }

  return (
    <section style={st.card}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: membership.role === "A" ? C.a : C.b, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {q.block}
        </span>
        <span style={{ fontSize: 13, color: C.inkSoft }}>{i + 1} / {total}</span>
      </div>
      <div style={{ height: 4, background: C.line, borderRadius: 2, marginBottom: 18 }}>
        <div style={{ height: 4, width: `${(i / total) * 100}%`, background: membership.role === "A" ? C.a : C.b, borderRadius: 2 }} />
      </div>
      <h2 style={{ ...st.h2, marginBottom: 14 }}>{q.text}</h2>

      {q.type === "choice" && (
        <div style={{ display: "grid", gap: 8 }}>
          {q.options.map((o) => (
            <Btn key={o} variant="ghost" onClick={() => next(o)} disabled={busy}
              style={{ textAlign: "left", color: C.ink }}>{o}</Btn>
          ))}
          {!other ? (
            <Btn variant="ghost" onClick={() => setOther(true)} disabled={busy}
              style={{ textAlign: "left", color: C.inkSoft, fontStyle: "italic" }}>
              Meine Situation ist anders …
            </Btn>
          ) : (
            <div>
              <textarea style={st.textarea} rows={3} value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="Beschreib es in deinen eigenen Worten — das ist oft aufschlussreicher als jede Auswahl." />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn variant="who" role={membership.role} disabled={busy || !textDraft.trim()}
                  onClick={() => { next(textDraft.trim()); setOther(false); }}>
                  {i + 1 === total ? "Abschließen" : "Weiter"}
                </Btn>
                <Btn variant="ghost" onClick={() => setOther(false)} disabled={busy}>Zurück zur Auswahl</Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {q.type === "scale" && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Btn key={n} variant="ghost" onClick={() => next(String(n))} disabled={busy}
              style={{ minWidth: 52, color: C.ink }}>{n}</Btn>
          ))}
        </div>
      )}

      {q.type === "text" && (
        <div>
          <textarea style={st.textarea} rows={3} value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            placeholder={q.optional ? "Optional — du kannst auch überspringen" : "Deine Antwort …"} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Btn variant="who" role={membership.role} disabled={busy || (!q.optional && !textDraft.trim())}
              onClick={() => next(textDraft.trim() || "(übersprungen)")}>
              {i + 1 === total ? (busy ? "Wird ausgewertet …" : "Abschließen") : "Weiter"}
            </Btn>
            {q.optional && (
              <Btn variant="ghost" onClick={() => next("(übersprungen)")} disabled={busy}>Überspringen</Btn>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── KI-Interview (Nachfragen) ─────────────────────────── */
function Interview({ membership, followups, nextIdx, busy, error, onAnswer }) {
  const [draft, setDraft] = useState("");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ErrorNote>{error}</ErrorNote>
      <section style={st.card}>
        <h2 style={st.h2}>Zwischenraum fragt nach</h2>
        <p style={st.hint}>
          Auf Basis deiner Antworten hat Zwischenraum {followups.length} persönliche Nachfragen —
          Frage {nextIdx + 1} von {followups.length}.
        </p>
        {followups.slice(0, nextIdx).map((f, k) => (
          <div key={k} style={{ marginBottom: 10, opacity: 0.7 }}>
            <p style={{ ...st.body, fontStyle: "italic" }}>{f.q}</p>
            <p style={st.body}>→ {f.a}</p>
          </div>
        ))}
        <AIBlock title="ZWISCHENRAUM" text={followups[nextIdx].q} />
        <textarea style={{ ...st.textarea, marginTop: 12 }} rows={3} value={draft}
          onChange={(e) => setDraft(e.target.value)} placeholder="Deine Antwort …" />
        <div style={{ marginTop: 10 }}>
          <Btn variant="who" role={membership.role} disabled={busy || !draft.trim()}
            onClick={() => { onAnswer(nextIdx, draft.trim()); setDraft(""); }}>
            {busy ? "…" : nextIdx + 1 === followups.length ? "Antworten & abschließen" : "Antworten"}
          </Btn>
        </div>
      </section>
    </div>
  );
}
