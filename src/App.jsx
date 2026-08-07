import React, { useEffect, useState } from "react";
import { supabase, callAI } from "./supabase.js";
import { C, st, font, Btn, Tag, Shell, ErrorNote, InviteBox } from "./ui.jsx";
import Diary from "./sections/Diary.jsx";
import Conflicts from "./sections/Conflicts.jsx";
import SharedChat from "./sections/SharedChat.jsx";
import AboutYou from "./sections/AboutYou.jsx";
import Report from "./sections/Report.jsx";
import Landing from "./Landing.jsx";
import Invite from "./Invite.jsx";
import Settings from "./sections/Settings.jsx";
import Geraetesperre from "./sections/Geraetesperre.jsx";
import AdminDashboard from "./AdminDashboard.jsx";

function codeAusUrl() {
  try { return new URLSearchParams(window.location.search).get("code") || ""; }
  catch { return ""; }
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [membership, setMembership] = useState(undefined);
  const [showAuth, setShowAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inviteGesehen, setInviteGesehen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setMembership(session === null ? null : undefined); return; }
    loadMembership();
  }, [session]);

  async function loadMembership() {
    const { data: adminRow } = await supabase.from("admins")
      .select("user_id").eq("user_id", session.user.id).maybeSingle();
    if (adminRow) { setIsAdmin(true); setMembership(null); return; }
    setIsAdmin(false);
    const { data } = await supabase
      .from("couple_members")
      .select("couple_id, user_id, role, display_name, couples(invite_code)")
      .eq("user_id", session.user.id)
      .maybeSingle();
    setMembership(data || null);
  }

  if (session === undefined) return <Shell><p style={st.hint}>Lade …</p></Shell>;
  if (!session) {
    const eingeladen = !!codeAusUrl();
    // Eingeladene Personen sehen erst die eigene Ansprache (drei Saetze gegen
    // Ueberwachung, Parteinahme, Verpflichtung), bevor sie ueberhaupt auf ein
    // Formular treffen — siehe KONZEPT.md Abschnitt 4.
    if (eingeladen && !inviteGesehen) return <Shell><Invite onStart={() => setInviteGesehen(true)} /></Shell>;
    if (!showAuth && !eingeladen) return <Shell><Landing onStart={() => setShowAuth(true)} /></Shell>;
    return <AuthScreen
      onBack={() => (eingeladen ? setInviteGesehen(false) : setShowAuth(false))}
      eingeladen={eingeladen}
    />;
  }
  if (membership === undefined) return <Shell><p style={st.hint}>Lade …</p></Shell>;
  if (isAdmin) return <AdminDashboard />;
  if (!membership) return <Onboarding session={session} onDone={loadMembership} />;
  return <Main session={session} membership={membership} />;
}

/* ─── Anmeldung ─────────────────────────────────────────── */
function AuthScreen({ onBack, eingeladen }) {
  const [mode, setMode] = useState(eingeladen ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);

  async function reset() {
    if (!email) { setError("Bitte trag zuerst deine E-Mail-Adresse ein."); return; }
    setError(null); setInfo(null); setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setInfo("Wir haben dir einen Link zum Zurücksetzen geschickt. Schau auch im Spam-Ordner nach.");
  }

  async function submit() {
    setError(null); setInfo(null); setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password: pw,
          options: { data: { einwilligung_art9: true, einwilligung_zeitpunkt: new Date().toISOString() } },
        });
        if (error) throw error;
        if (data.user && !data.session) setInfo("Konto erstellt. Wir haben dir eine Bestätigungsmail geschickt — bitte klick den Link darin. Schau unbedingt auch im Spam-Ordner nach: Unsere Adresse ist noch neu, deshalb landen die Mails dort manchmal.");
      }
    } catch (e) {
      setError(e.message || "Anmeldung fehlgeschlagen.");
    }
    setBusy(false);
  }

  return (
    <Shell>
      <div style={{ maxWidth: 420, margin: "0 auto", paddingTop: 40 }}>
        <h1 style={{ ...st.h1, textAlign: "center" }}>Zwischenraum</h1>
        <p style={{ ...st.hint, textAlign: "center", fontSize: 15, marginBottom: 28 }}>
          Zwei Sichten. Ein neutraler Dritter.<br />
          Was du hier schreibst, sieht dein Partner nie im Original.
        </p>
        <div style={st.card}>
          {eingeladen && mode === "signup" && (
            <p style={{ ...st.body, background: C.paper, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 14.5 }}>
              Du wurdest eingeladen. Leg dir hier dein eigenes Konto an — dein Zugang ist getrennt
              von dem deiner Partnerin oder deines Partners, niemand liest deine Texte.
            </p>
          )}
          <ErrorNote>{error}</ErrorNote>
          {info && <p style={{ ...st.hint, color: C.ok }}>{info}</p>}
          <label style={st.hint}>E-Mail</label>
          <input style={st.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <label style={{ ...st.hint, display: "block", marginTop: 12 }}>Passwort</label>
          <input style={st.input} type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
          {mode === "signup" && (
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, fontSize: 13.5, color: C.ink, cursor: "pointer", lineHeight: 1.5 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                Ich willige ausdrücklich ein, dass meine Eingaben — die auch besondere Kategorien
                personenbezogener Daten enthalten können (z.B. zu Gesundheit, Sexualleben, seelischem
                Befinden) — zur Bereitstellung der Funktionen von Zwischenraum verarbeitet und dafür an
                den KI-Dienst OpenAI übermittelt werden (Art. 9 Abs. 2 lit. a DSGVO). Details in der
                Datenschutzerklärung (Link unten). Widerruf jederzeit möglich.
              </span>
            </label>
          )}
          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
            <Btn onClick={submit} disabled={busy || !email || pw.length < 6 || (mode === "signup" && !consent)}>
              {mode === "login" ? "Anmelden" : "Konto erstellen"}
            </Btn>
            {mode === "login" && (
              <button onClick={reset}
                style={{ background: "none", border: "none", color: C.inkSoft, fontSize: 14, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                Passwort vergessen?
              </button>
            )}
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")}
              style={{ background: "none", border: "none", color: C.inkSoft, fontSize: 14, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
              {mode === "login" ? "Neu hier? Konto erstellen" : "Schon ein Konto? Anmelden"}
            </button>
          </div>
        </div>
        <p style={{ ...st.hint, textAlign: "center", marginTop: 20 }}>
          Passwörter mindestens 6 Zeichen. Jede Person nutzt ihr eigenes Konto.
        </p>
        <p style={{ textAlign: "center", marginTop: 8 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.inkSoft, fontSize: 14, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
            ← Zurück zur Übersicht
          </button>
        </p>
      </div>
    </Shell>
  );
}

/* ─── Onboarding: Paar-Raum erstellen oder beitreten ────── */
function Onboarding({ session, onDone }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(codeAusUrl());
  const [created, setCreated] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function createCouple() {
    setBusy(true); setError(null);
    const { data, error } = await supabase.rpc("create_couple", { p_name: name.trim() });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setCreated(data);
  }

  async function joinCouple() {
    setBusy(true); setError(null);
    const { error } = await supabase.rpc("join_couple", { p_code: code.trim().toLowerCase(), p_name: name.trim() });
    setBusy(false);
    if (error) { setError("Beitritt fehlgeschlagen. Stimmt der Einladungscode?"); return; }
    try { await callAI({ action: "notify", kind: "partner_joined" }); } catch { /* optional */ }
    onDone();
  }

  if (created) {
    return (
      <Shell>
        <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 48, textAlign: "center" }}>
          <h1 style={st.h1}>Euer Raum ist bereit</h1>
          <p style={st.hint}>Teile diesen Einladungscode mit deiner Partnerin oder deinem Partner:</p>
          <div style={{ ...st.card, margin: "20px 0" }}>
            <InviteBox code={created.invite_code} />
          </div>
          <Btn onClick={onDone}>Weiter zum Tagebuch</Btn>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 40 }}>
        <h1 style={{ ...st.h1, textAlign: "center", marginBottom: 8 }}>Fast geschafft</h1>
        <p style={{ ...st.hint, textAlign: "center", marginBottom: 24 }}>Wie dürfen wir dich nennen?</p>
        <div style={st.card}>
          <ErrorNote>{error}</ErrorNote>
          <input style={st.input} placeholder="Dein Vorname" value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ borderTop: `1px solid ${C.line}`, margin: "20px 0", paddingTop: 18 }}>
            <h2 style={st.h2}>Neuen Paar-Raum erstellen</h2>
            <p style={st.hint}>Du bekommst einen Code, mit dem deine Partnerin oder dein Partner beitritt.</p>
            <Btn onClick={createCouple} disabled={busy || !name.trim()}>Raum erstellen</Btn>
          </div>
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 18 }}>
            <h2 style={st.h2}>Mit Einladungscode beitreten</h2>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input style={st.input} placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
              <Btn variant="ghost" onClick={joinCouple} disabled={busy || !name.trim() || !code.trim()}>Beitreten</Btn>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ─── Hauptansicht: drei Raeume ──────────────────────────
   KONZEPT.md Abschnitt 1: Dein Raum / Der Zwischenraum / Euer Raum.
   Ein Tab = ein Raum = ein Vertraulichkeitsversprechen. "Dein Raum"
   buendelt drei bisher eigenstaendige Tabs (Ueber dich, Tagebuch,
   Themen & Konflikte) unter einer Unter-Navigation, weil sie alle
   ausschliesslich dir gehoeren. Einstellungen ist kein Raum, sondern
   Utility, und bleibt deshalb ausserhalb des Raum-Modells. */
function Main({ session, membership }) {
  const [raum, setRaum] = useState("dein");
  const [deinTab, setDeinTab] = useState("tagebuch");
  const [state, setState] = useState(null);
  // Wiedereinstiegs-Schutz (Backlog Punkt 6): pinGesetzt=null, solange der
  // Status noch nicht bekannt ist -- erst dann darf "Dein Raum" ueberhaupt
  // gerendert werden, sonst blitzt der Inhalt kurz unverschluesselt auf.
  const [pinGesetzt, setPinGesetzt] = useState(null);
  const [entsperrt, setEntsperrt] = useState(false);

  async function loadState() {
    const { data } = await supabase.rpc("gate_progress");
    setState(data);
  }
  useEffect(() => { loadState(); }, []);

  async function pruefePinStatus() {
    try { const r = await callAI({ action: "lock_status" }); setPinGesetzt(!!r.gesetzt); }
    catch { setPinGesetzt(false); }
  }
  useEffect(() => { pruefePinStatus(); }, []);

  useEffect(() => {
    function onVisibility() {
      // Sperrt sofort beim Verlassen des Tabs/Geraets -- beim Zurueckkehren
      // steht die Sperre dann schon, statt erst danach aufzupoppen.
      if (document.visibilityState === "hidden") setEntsperrt(false);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const deinBereit = pinGesetzt !== null;
  const deinGesperrt = pinGesetzt === true && !entsperrt;

  const gateOpen = !!state?.gate_open;

  const raeume = [
    ["dein", "Dein Raum", C.a],
    ["zwischenraum", "Der Zwischenraum", C.ink],
    ["euer", gateOpen ? "Euer Raum" : "Euer Raum 🔒", C.b],
  ];
  const deinTabs = [
    ["tagebuch", "Tagebuch"],
    ["ueber_dich", "Über dich"],
    ["konflikte", "Themen & Konflikte"],
  ];

  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ ...st.h1, fontSize: 26 }}>Zwischenraum</h1>
          <Tag role={membership.role}>{membership.display_name || `Partner ${membership.role}`}</Tag>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {state?.partner_joined !== true && membership.couples?.invite_code && (
            <span style={{ fontSize: 13, color: C.inkSoft }}>
              Einladungscode: <strong>{membership.couples.invite_code}</strong>
            </span>
          )}
          <button onClick={() => setRaum("einstellungen")} title="Einstellungen"
            style={{
              background: raum === "einstellungen" ? C.ink : "transparent",
              color: raum === "einstellungen" ? "#fff" : C.inkSoft,
              border: `1px solid ${raum === "einstellungen" ? C.ink : C.line}`,
              borderRadius: 999, width: 36, height: 36, fontSize: 16,
              cursor: "pointer", fontFamily: "inherit",
            }}>
            ⚙
          </button>
          <Btn variant="ghost" onClick={() => supabase.auth.signOut()}>Abmelden</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {raeume.map(([id, label, farbe]) => (
          <button key={id} onClick={() => setRaum(id)}
            style={{
              background: raum === id ? farbe : "transparent",
              color: raum === id ? "#fff" : C.inkSoft,
              border: `1px solid ${raum === id ? farbe : C.line}`,
              borderRadius: 999, padding: "9px 20px", fontSize: 14.5, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>
            {label}
          </button>
        ))}
      </div>

      {raum === "dein" && deinBereit && !deinGesperrt && (
        <div style={{ display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap" }}>
          {deinTabs.map(([id, label]) => (
            <button key={id} onClick={() => setDeinTab(id)}
              style={{
                background: deinTab === id ? C.aSoft : "transparent",
                color: deinTab === id ? C.a : C.inkSoft,
                border: `1px solid ${deinTab === id ? C.a : C.line}`,
                borderRadius: 999, padding: "6px 15px", fontSize: 13.5, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>
              {label}
            </button>
          ))}
        </div>
      )}
      {(raum !== "dein" || !deinBereit || deinGesperrt) && <div style={{ marginBottom: 22 }} />}

      {raum === "dein" && !deinBereit && <p style={st.hint}>Lade …</p>}
      {raum === "dein" && deinBereit && deinGesperrt && (
        <Geraetesperre onEntsperrt={() => setEntsperrt(true)} />
      )}
      {raum === "dein" && deinBereit && !deinGesperrt && deinTab === "tagebuch" && <Diary membership={membership} />}
      {raum === "dein" && deinBereit && !deinGesperrt && deinTab === "ueber_dich" && <AboutYou membership={membership} />}
      {raum === "dein" && deinBereit && !deinGesperrt && deinTab === "konflikte" && <Conflicts membership={membership} />}
      {raum === "zwischenraum" && (
        <Report membership={membership} onGespraech={() => { setRaum("dein"); setDeinTab("ueber_dich"); }} />
      )}
      {raum === "euer" && <SharedChat membership={membership} state={state} refreshState={loadState} />}
      {raum === "einstellungen" && (
        <Settings membership={membership} onChanged={loadState} onLockChanged={pruefePinStatus} />
      )}
    </Shell>
  );
}
