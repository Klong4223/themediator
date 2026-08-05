import React, { useEffect, useRef, useState } from "react";
import { supabase, callAI } from "../supabase.js";
import { C, st, Btn, Tag, Convergence, ErrorNote, InviteBox } from "../ui.jsx";

export default function SharedChat({ membership, state, refreshState }) {
  if (!state) return <p style={st.hint}>Lade …</p>;
  if (!state.gate_open) return <Gate state={state} refreshState={refreshState} membership={membership} />;
  return <Chat membership={membership} />;
}

/* ─── Gate mit Fortschritt ──────────────────────────────── */
function Gate({ state, refreshState, membership }) {
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState(state.readiness || null);
  const [error, setError] = useState(null);

  async function check() {
    setBusy(true); setError(null);
    try {
      const res = await callAI({ action: "gate" });
      setVerdict(res.readiness);
      await refreshState();
      if (res.gate_open) { try { await callAI({ action: "notify", kind: "gate" }); } catch { /* optional */ } }
    } catch (e) {
      setError("Prüfung fehlgeschlagen. Bitte später erneut versuchen.");
    }
    setBusy(false);
  }

  const Row = ({ label, mine, partner }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14.5 }}>
      <span style={{ color: C.inkSoft }}>{label}</span>
      <span>
        <span style={{ color: C.a, fontWeight: 700 }}>{mine}</span>
        <span style={{ color: C.inkSoft }}> · </span>
        <span style={{ color: C.b, fontWeight: 700 }}>{partner}</span>
      </span>
    </div>
  );

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
      <Convergence />
      <h2 style={{ ...st.h2, fontSize: 24 }}>Der gemeinsame Raum ist noch geschlossen</h2>
      <p style={{ ...st.hint, fontSize: 15 }}>
        Er öffnet sich, wenn Zwischenraum beide Seiten gut genug kennt, um fair zu moderieren —
        es zählt Substanz, nicht Stückzahl. Ein einziger ausführlicher Eintrag kann mehr wiegen
        als fünf kurze.
      </p>
      <ErrorNote>{error}</ErrorNote>
      <div style={{ ...st.card, textAlign: "left", margin: "18px 0" }}>
        <Row label="Tagebucheinträge (du · Partner)" mine={state.my_diary} partner={state.partner_joined ? state.partner_diary : "—"} />
        <Row label="Konflikte beschrieben (du · Partner)" mine={state.my_conflicts} partner={state.partner_joined ? state.partner_conflicts : "—"} />
        <Row label="Fragebogen — optional (du · Partner)" mine={state.my_assessment ? "✓" : "offen"} partner={state.partner_joined ? (state.partner_assessment ? "✓" : "offen") : "—"} />
        {!state.partner_joined && (
          <div style={{ marginTop: 12 }}>
            <p style={st.hint}>Deine Partnerin oder dein Partner ist noch nicht beigetreten. Zum Beitreten braucht sie oder er diesen Einladungscode (Registrieren → „Mit Einladungscode beitreten"):</p>
            <InviteBox code={membership?.couples?.invite_code} />
          </div>
        )}
        {verdict && <p style={{ ...st.body, marginTop: 12, fontStyle: "italic" }}>{verdict}</p>}
      </div>
      <Btn onClick={check} disabled={busy || !state.partner_joined}>
        {busy ? "Zwischenraum prüft …" : "Bereitschaft prüfen"}
      </Btn>
    </div>
  );
}

/* ─── Moderierter Chat ──────────────────────────────────── */
function Chat({ membership }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  async function load() {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, sender_id, content, created_at")
      .order("created_at", { ascending: true })
      .limit(200);
    setMsgs(data || []);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  async function send() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    const { error } = await supabase
      .from("chat_messages")
      .insert({ couple_id: membership.couple_id, content: text });
    if (error) { setError("Senden fehlgeschlagen."); return; }
    await load();
    try { await callAI({ action: "notify", kind: "chat" }); } catch { /* Mail ist optional */ }
  }

  async function moderate() {
    setBusy(true); setError(null);
    try {
      await callAI({ action: "chat" });
      await load();
    } catch (e) {
      setError("Moderation fehlgeschlagen. Bitte erneut versuchen.");
    }
    setBusy(false);
  }

  const mine = (m) => m.sender_id === membership.user_id;

  const uhrzeit = (iso) =>
    new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  const tagesLabel = (iso) => {
    const d = new Date(iso);
    const heute = new Date();
    const gestern = new Date(Date.now() - 864e5);
    const gleich = (a, b) => a.toDateString() === b.toDateString();
    if (gleich(d, heute)) return "Heute";
    if (gleich(d, gestern)) return "Gestern";
    return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <ErrorNote>{error}</ErrorNote>
      <section style={{ ...st.card, minHeight: 300, maxHeight: "55vh", overflowY: "auto" }}>
        {msgs.map((m, idx) => {
          const vorher = idx > 0 ? msgs[idx - 1] : null;
          const neuerTag = !vorher ||
            new Date(vorher.created_at).toDateString() !== new Date(m.created_at).toDateString();
          return (
            <div key={m.id}>
              {neuerTag && (
                <div style={{ textAlign: "center", margin: "18px 0 12px" }}>
                  <span style={{ fontSize: 12, color: C.inkSoft, background: C.paper, padding: "3px 12px", borderRadius: 999 }}>
                    {tagesLabel(m.created_at)}
                  </span>
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                {m.sender_id === null ? (
                  <div style={{ background: C.paper, borderLeft: `3px solid ${C.ink}`, borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, letterSpacing: "0.06em" }}>ZWISCHENRAUM</span>
                      <span style={{ fontSize: 11.5, color: C.inkSoft }}>{uhrzeit(m.created_at)}</span>
                    </div>
                    <p style={{ ...st.body, marginTop: 4, whiteSpace: "pre-wrap" }}>{m.content}</p>
                  </div>
                ) : (
                  <div style={{ textAlign: mine(m) ? "right" : "left" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", justifyContent: mine(m) ? "flex-end" : "flex-start" }}>
                      <Tag role={mine(m) ? membership.role : membership.role === "A" ? "B" : "A"}>
                        {mine(m) ? "Du" : "Partner"}
                      </Tag>
                      <span style={{ fontSize: 11.5, color: C.inkSoft }}>{uhrzeit(m.created_at)}</span>
                    </div>
                    <p style={{ ...st.body, marginTop: 4, whiteSpace: "pre-wrap" }}>{m.content}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </section>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...st.input, flex: 1 }} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Nachricht an euch beide …" />
        <Btn variant="who" role={membership.role} onClick={send}>Senden</Btn>
        <Btn onClick={moderate} disabled={busy}>{busy ? "…" : "Moderieren"}</Btn>
      </div>
      <p style={st.hint}>
        Zwischenraum liest mit. »Moderieren« holt eine neutrale Einordnung — bei Eskalation greift sie von selbst ein.
      </p>
    </div>
  );
}
