import React, { useEffect, useState } from "react";
import { supabase, callAI, pingAI, FRONTEND_VERSION } from "../supabase.js";
import { C, st, Btn, ErrorNote } from "../ui.jsx";

export default function Settings({ membership, onChanged, onLockChanged }) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Benachrichtigungen membership={membership} />
      <Anzeigename membership={membership} onChanged={onChanged} />
      <EmailAendern />
      <PasswortAendern />
      <WiedereinstiegsSchutz onChanged={onLockChanged} />
      <KontoLoeschen membership={membership} />
      <Versionsinfo />
    </div>
  );
}

/* Reine JSON-Fehlertexte aus der Edge Function ("... — {"error":"..."}")
   auf die eigentliche Ursache eindampfen, statt sie roh anzuzeigen. */
function fehlerText(e) {
  const raw = e?.message || String(e);
  const m = raw.match(/"error"\s*:\s*"([^"]+)"/);
  return m ? m[1] : raw;
}

/* ─── Wiedereinstiegs-Schutz (Backlog Punkt 6) ───────────── */
function WiedereinstiegsSchutz({ onChanged }) {
  const [gesetzt, setGesetzt] = useState(null);
  const [modus, setModus] = useState(null); // null | "setzen" | "aendern" | "entfernen"
  const [altPin, setAltPin] = useState("");
  const [neuPin, setNeuPin] = useState("");
  const [neuPin2, setNeuPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    callAI({ action: "lock_status" }).then((r) => setGesetzt(!!r.gesetzt)).catch(() => setGesetzt(false));
  }, []);

  function reset() {
    setModus(null); setAltPin(""); setNeuPin(""); setNeuPin2(""); setError(null);
  }

  async function speichern() {
    if (neuPin.length < 4) { setError("Der PIN muss aus mindestens 4 Ziffern bestehen."); return; }
    if (neuPin !== neuPin2) { setError("Die beiden PINs stimmen nicht überein."); return; }
    setBusy(true); setError(null);
    try {
      await callAI({ action: "lock_set", pin: neuPin, altes_pin: gesetzt ? altPin : undefined });
      setGesetzt(true); reset();
      if (onChanged) onChanged();
      setStatus("✓ PIN gespeichert");
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      setError(fehlerText(e));
    }
    setBusy(false);
  }

  async function entfernen() {
    if (!altPin.trim()) { setError("Bitte den aktuellen PIN eingeben."); return; }
    setBusy(true); setError(null);
    try {
      await callAI({ action: "lock_remove", pin: altPin });
      setGesetzt(false); reset();
      if (onChanged) onChanged();
      setStatus("✓ Sperre entfernt");
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      setError(fehlerText(e));
    }
    setBusy(false);
  }

  if (gesetzt === null) return null;

  return (
    <section style={st.card}>
      <h2 style={st.h2}>Wiedereinstiegs-Schutz für „Dein Raum"</h2>
      <p style={st.hint}>
        Ein PIN, den nur du kennst — schützt „Dein Raum" davor, dass jemand kurz mitliest, wenn
        du dein Gerät aus der Hand gibst. Er wird abgefragt, sobald du zu Zwischenraum zurückkehrst.
        Kein Schutz, wenn jemand dauerhaft Zugriff auf dein entsperrtes Gerät hat.
      </p>
      <ErrorNote>{error}</ErrorNote>
      {status && <p style={{ ...st.hint, color: C.ok }}>{status}</p>}

      {modus === null && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {gesetzt ? (
            <>
              <span style={{ ...st.body, color: C.ok, fontWeight: 600, margin: 0 }}>✓ Sperre aktiv</span>
              <Btn variant="ghost" onClick={() => setModus("aendern")}>PIN ändern</Btn>
              <Btn variant="ghost" onClick={() => setModus("entfernen")} style={{ color: C.danger, borderColor: C.danger }}>
                Sperre entfernen
              </Btn>
            </>
          ) : (
            <Btn variant="ghost" onClick={() => setModus("setzen")}>PIN einrichten</Btn>
          )}
        </div>
      )}

      {(modus === "setzen" || modus === "aendern") && (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {gesetzt && (
            <input style={st.input} type="password" inputMode="numeric" autoComplete="off" value={altPin} disabled={busy}
              onChange={(e) => setAltPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="Bisheriger PIN" />
          )}
          <input style={st.input} type="password" inputMode="numeric" autoComplete="off" value={neuPin} disabled={busy}
            onChange={(e) => setNeuPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="Neuer PIN (4-8 Ziffern)" />
          <input style={st.input} type="password" inputMode="numeric" autoComplete="off" value={neuPin2} disabled={busy}
            onChange={(e) => setNeuPin2(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="Neuer PIN wiederholen" />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={speichern} disabled={busy}>{busy ? "Wird gespeichert …" : "Speichern"}</Btn>
            <Btn variant="ghost" onClick={reset} disabled={busy}>Abbrechen</Btn>
          </div>
        </div>
      )}

      {modus === "entfernen" && (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <input style={st.input} type="password" inputMode="numeric" autoComplete="off" value={altPin} disabled={busy}
            onChange={(e) => setAltPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="Aktueller PIN" />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={entfernen} disabled={busy} style={{ background: C.danger }}>
              {busy ? "Wird entfernt …" : "Sperre endgültig entfernen"}
            </Btn>
            <Btn variant="ghost" onClick={reset} disabled={busy}>Abbrechen</Btn>
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── Versionsinfo (Backlog-Punkt 2) ─────────────────────── */
function Versionsinfo() {
  const [edge, setEdge] = useState(undefined);

  useEffect(() => {
    pingAI().then(setEdge).catch(() => setEdge(null));
  }, []);

  return (
    <section style={{ ...st.card, background: C.paper }}>
      <h2 style={st.h2}>Version</h2>
      <p style={{ ...st.hint, marginTop: 6 }}>
        Frontend: <strong>{FRONTEND_VERSION}</strong>
        <br />
        Server (Edge Function):{" "}
        {edge === undefined ? "wird geprüft …" : edge === null ? "nicht erreichbar" : (
          <strong>{edge.version}</strong>
        )}
      </p>
    </section>
  );
}

/* ─── Benachrichtigungen ────────────────────────────────── */
export function Benachrichtigungen({ membership }) {
  const [freq, setFreq] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    supabase.from("couple_members").select("email_freq")
      .eq("user_id", membership.user_id).maybeSingle()
      .then(({ data }) => setFreq(data?.email_freq ?? "daily"));
  }, []);

  async function setzen(wert) {
    setFreq(wert); setStatus(null);
    const { error } = await supabase.from("couple_members")
      .update({ email_freq: wert }).eq("user_id", membership.user_id);
    setStatus(error ? "Konnte nicht gespeichert werden." : "✓ Gespeichert");
    setTimeout(() => setStatus(null), 2500);
  }

  const optionen = [
    ["none", "Gar nicht"],
    ["daily", "Einmal am Tag"],
    ["instant", "Bei jeder neuen Nachricht"],
  ];

  return (
    <section style={st.card}>
      <h2 style={st.h2}>Benachrichtigungen</h2>
      <p style={st.hint}>
        Wann sollen wir dir eine E-Mail schreiben, wenn es bei euch weitergeht?
        In unseren E-Mails stehen <strong>niemals Inhalte</strong> — nur der Hinweis,
        dass es etwas Neues gibt.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {optionen.map(([wert, label]) => (
          <Btn key={wert} variant={freq === wert ? "who" : "ghost"} role={membership.role}
            onClick={() => setzen(wert)}
            style={{ textAlign: "left", color: freq === wert ? "#fff" : C.ink }}>
            {freq === wert ? "✓ " : ""}{label}
          </Btn>
        ))}
      </div>
      {status && <p style={{ ...st.hint, marginTop: 8 }}>{status}</p>}
      <p style={{ ...st.hint, marginTop: 10 }}>
        Hinweis: Unsere Mails landen anfangs gelegentlich im Spam-Ordner. Wenn du sie
        dort als „Kein Spam" markierst, kommen künftige Nachrichten zuverlässig an.
      </p>
    </section>
  );
}

/* ─── Anzeigename ───────────────────────────────────────── */
function Anzeigename({ membership, onChanged }) {
  const [name, setName] = useState(membership.display_name || "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  async function speichern() {
    setBusy(true); setStatus(null);
    const { error } = await supabase.from("couple_members")
      .update({ display_name: name.trim() || null }).eq("user_id", membership.user_id);
    setBusy(false);
    setStatus(error ? "Konnte nicht gespeichert werden." : "✓ Gespeichert");
    if (!error && onChanged) onChanged();
    setTimeout(() => setStatus(null), 2500);
  }

  return (
    <section style={st.card}>
      <h2 style={st.h2}>Dein Name</h2>
      <p style={st.hint}>So spricht Zwischenraum dich an.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...st.input, flex: 1, minWidth: 180 }} value={name}
          onChange={(e) => setName(e.target.value)} placeholder="Dein Vorname" />
        <Btn variant="who" role={membership.role} onClick={speichern} disabled={busy}>Speichern</Btn>
      </div>
      {status && <p style={{ ...st.hint, marginTop: 8 }}>{status}</p>}
    </section>
  );
}

/* ─── E-Mail ändern ─────────────────────────────────────── */
function EmailAendern() {
  const [aktuell, setAktuell] = useState("");
  const [neu, setNeu] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAktuell(data?.user?.email || ""));
  }, []);

  async function aendern() {
    setBusy(true); setError(null); setStatus(null);
    const { error } = await supabase.auth.updateUser({ email: neu.trim() });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setNeu("");
    setStatus("Wir haben eine Bestätigung an die neue Adresse geschickt. Bitte dort bestätigen — schau auch im Spam-Ordner nach.");
  }

  return (
    <section style={st.card}>
      <h2 style={st.h2}>E-Mail-Adresse</h2>
      <p style={st.hint}>Aktuell: <strong>{aktuell || "…"}</strong></p>
      <ErrorNote>{error}</ErrorNote>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...st.input, flex: 1, minWidth: 200 }} type="email" value={neu}
          onChange={(e) => setNeu(e.target.value)} placeholder="Neue E-Mail-Adresse" />
        <Btn variant="ghost" onClick={aendern} disabled={busy || !neu.trim()}>Ändern</Btn>
      </div>
      {status && <p style={{ ...st.hint, color: C.ok, marginTop: 8 }}>{status}</p>}
    </section>
  );
}

/* ─── Passwort ändern ───────────────────────────────────── */
function PasswortAendern() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  async function aendern() {
    if (pw !== pw2) { setError("Die beiden Passwörter stimmen nicht überein."); return; }
    setBusy(true); setError(null); setStatus(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setPw(""); setPw2("");
    setStatus("✓ Passwort geändert");
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <section style={st.card}>
      <h2 style={st.h2}>Passwort</h2>
      <p style={st.hint}>Mindestens 6 Zeichen.</p>
      <ErrorNote>{error}</ErrorNote>
      <div style={{ display: "grid", gap: 8 }}>
        <input style={st.input} type="password" value={pw} autoComplete="new-password"
          onChange={(e) => setPw(e.target.value)} placeholder="Neues Passwort" />
        <input style={st.input} type="password" value={pw2} autoComplete="new-password"
          onChange={(e) => setPw2(e.target.value)} placeholder="Neues Passwort wiederholen" />
        <div>
          <Btn variant="ghost" onClick={aendern} disabled={busy || pw.length < 6 || !pw2}>Passwort ändern</Btn>
        </div>
      </div>
      {status && <p style={{ ...st.hint, color: C.ok, marginTop: 8 }}>{status}</p>}
    </section>
  );
}

/* ─── Konto löschen ─────────────────────────────────────── */
function KontoLoeschen({ membership }) {
  const [offen, setOffen] = useState(false);
  const [bestaetigung, setBestaetigung] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function loeschen() {
    setBusy(true); setError(null);
    try {
      await callAI({ action: "delete_account" });
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e) {
      setError("Löschen fehlgeschlagen: " + (e?.message || e));
      setBusy(false);
    }
  }

  return (
    <section style={{ ...st.card, borderColor: C.danger }}>
      <h2 style={{ ...st.h2, color: C.danger }}>Konto löschen</h2>
      <p style={st.hint}>
        Damit werden <strong>alle deine Inhalte unwiderruflich gelöscht</strong>: dein Tagebuch,
        deine Themen und Konflikte, dein Fragebogen, dein Profil, deine Spiegel und deine
        Nachrichten im gemeinsamen Raum. Auch gemeinsame Beziehungsbilder werden gelöscht,
        weil sie aus deinem Material entstanden sind.
      </p>
      <p style={st.hint}>
        Der Paar-Raum bleibt für deine Partnerin oder deinen Partner mit ihren oder seinen
        eigenen Inhalten bestehen — sie oder er sieht dann, dass du den Raum verlassen hast.
      </p>
      <ErrorNote>{error}</ErrorNote>
      {!offen ? (
        <Btn variant="ghost" onClick={() => setOffen(true)}
          style={{ color: C.danger, borderColor: C.danger }}>Konto löschen …</Btn>
      ) : (
        <div>
          <p style={{ ...st.body, fontSize: 14.5 }}>
            Tippe <strong>LÖSCHEN</strong> ein, um zu bestätigen:
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <input style={{ ...st.input, flex: 1, minWidth: 160 }} value={bestaetigung}
              onChange={(e) => setBestaetigung(e.target.value)} placeholder="LÖSCHEN" />
            <Btn onClick={loeschen} disabled={busy || bestaetigung.trim().toUpperCase() !== "LÖSCHEN"}
              style={{ background: C.danger }}>
              {busy ? "Wird gelöscht …" : "Endgültig löschen"}
            </Btn>
            <Btn variant="ghost" onClick={() => { setOffen(false); setBestaetigung(""); }}>Abbrechen</Btn>
          </div>
        </div>
      )}
    </section>
  );
}
