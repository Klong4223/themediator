import React from "react";
import { C, st, font, Btn, Tag } from "./ui.jsx";

const S = ({ children, style }) => (
  <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 4px", ...style }}>{children}</section>
);

function HeroConvergence() {
  return (
    <svg width="100%" height="90" viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden="true">
      <path d="M20 8 C 220 8, 270 78, 300 80" stroke={C.a} strokeWidth="3" fill="none" />
      <path d="M580 8 C 380 8, 330 78, 300 80" stroke={C.b} strokeWidth="3" fill="none" />
      <circle cx="300" cy="80" r="6" fill={C.ink} />
    </svg>
  );
}

export default function Landing({ onStart }) {
  const h = { fontFamily: font.display, color: C.ink, letterSpacing: "-0.01em" };
  return (
    <div>
      {/* ─── Hero ─── */}
      <S style={{ textAlign: "center", paddingTop: 36 }}>
        <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", color: C.inkSoft, textTransform: "uppercase" }}>
          Zwischenraum
        </p>
        <h1 style={{ ...h, fontSize: "clamp(32px, 6vw, 52px)", fontWeight: 600, lineHeight: 1.15, margin: "10px 0 0" }}>
          Endlich versteht euch<br />jemand <em style={{ fontStyle: "italic" }}>beide</em> gleichzeitig.
        </h1>
        <HeroConvergence />
        <p style={{ fontSize: 18, lineHeight: 1.6, color: C.inkSoft, maxWidth: 560, margin: "4px auto 0" }}>
          Jeder von euch schreibt für sich — ehrlich, geschützt, unzensiert.
          Zwischenraum hört beiden zu und hilft euch, einander wieder zu verstehen.
          Ohne Partei zu ergreifen. Ohne dass einer die Worte des anderen liest.
        </p>
        <div style={{ marginTop: 26 }}>
          <Btn onClick={onStart} style={{ padding: "14px 30px", fontSize: 16 }}>Kostenlos starten</Btn>
        </div>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 12 }}>
          Testphase · kostenlos · keine Werbung, kein Tracking
        </p>
      </S>

      {/* ─── Problem ─── */}
      <S style={{ marginTop: 56 }}>
        <div style={{ ...st.card, padding: "26px 28px" }}>
          <h2 style={{ ...h, fontSize: 24, margin: 0 }}>Ihr redet. Und landet doch immer im selben Streit.</h2>
          <p style={{ ...st.body, fontSize: 16, marginTop: 10 }}>
            Nicht, weil ihr euch nichts zu sagen habt — sondern weil im Gespräch jeder gleichzeitig
            senden und sich verteidigen muss. Eine Paartherapie könnte helfen, aber: monatelange
            Wartelisten, 120–180&nbsp;€ pro Sitzung, und der große Schritt, überhaupt hinzugehen.
            Zwischenraum ist der Raum davor: klein genug, um heute anzufangen. Ehrlich genug, um
            etwas zu bewegen.
          </p>
        </div>
      </S>

      {/* ─── Wie es funktioniert ─── */}
      <S style={{ marginTop: 56 }}>
        <h2 style={{ ...h, fontSize: 26, textAlign: "center", margin: "0 0 22px" }}>So funktioniert es</h2>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
          {[
            ["1", "Jeder schreibt für sich", "Tagebuch, Konflikte, ein Fragebogen über dich. Dein Raum ist privat — deine Partnerin oder dein Partner liest nie deinen Text. Versprochen und technisch erzwungen."],
            ["2", "Zwischenraum versteht beide", "Die KI kennt beide Seiten, ergreift aber nie Partei. Sie spiegelt, stellt die richtigen Fragen — und spricht auch an, was du dir vielleicht schönredest."],
            ["3", "Ihr seht euch neu", "Wenn beide bereit sind: das Beziehungsbild — was du erlebst, was dein Gegenüber erlebt, was zwischen euch passiert. Und ein gemeinsamer, moderierter Raum zum Reden."],
          ].map(([n, t, d]) => (
            <div key={n} style={{ ...st.card, padding: "20px" }}>
              <span style={{ fontFamily: font.display, fontSize: 28, color: n === "2" ? C.ink : n === "1" ? C.a : C.b, fontWeight: 600 }}>{n}</span>
              <h3 style={{ ...h, fontSize: 17, margin: "6px 0 6px" }}>{t}</h3>
              <p style={{ ...st.body, fontSize: 14, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </S>

      {/* ─── Vertraulichkeit ─── */}
      <S style={{ marginTop: 56 }}>
        <div style={{ ...st.card, borderTop: `4px solid ${C.ink}`, padding: "26px 28px" }}>
          <h2 style={{ ...h, fontSize: 24, margin: 0 }}>Warum getrennt schreiben?</h2>
          <p style={{ ...st.body, fontSize: 16, marginTop: 10 }}>
            Weil Ehrlichkeit einen geschützten Raum braucht. Wer beim Schreiben denkt
            <em> „das liest nachher mein Partner"</em>, lässt das Wichtigste weg.
            Deshalb hat bei Zwischenraum jeder ein eigenes Konto mit eigenem Passwort.
            Was zwischen euch vermittelt wird, entsteht immer neu formuliert — nie aus euren
            Originaltexten. Und die tiefen gemeinsamen Auswertungen gibt es nur, wenn
            <strong> beide</strong> sie ausdrücklich freigeben.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <Tag role="A">Dein Raum</Tag>
            <Tag role="B">Ihr / sein Raum</Tag>
            <span style={{ background: C.paper, color: C.ink, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", padding: "3px 10px", borderRadius: 999, textTransform: "uppercase", border: `1px solid ${C.line}` }}>
              Der Zwischenraum
            </span>
          </div>
        </div>
      </S>

      {/* ─── Was drinsteckt ─── */}
      <S style={{ marginTop: 56 }}>
        <h2 style={{ ...h, fontSize: 26, textAlign: "center", margin: "0 0 22px" }}>Was Zwischenraum kann</h2>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {[
            ["Tagebuch mit Resonanz", "Schreib, was dich beschäftigt. Zwischenraum antwortet persönlich, erinnert sich an deine Themen und stellt Fragen, die weiterführen."],
            ["Konflikte, neu gehört", "Beschreib den Streit aus deiner Sicht. Du bekommst zurück: was du eigentlich brauchst, was womöglich beschönigt ist — und einen Weg zur Vermittlung."],
            ["Das Beziehungsbild", "Der tiefe Blick, wenn beide bereit sind: Was erlebst du, was erlebt dein Gegenüber, was passiert zwischen euch — ohne Urteil, ohne Recht-haben."],
            ["Dein Spiegel", "Feedback nur für dich: dein Anteil, deine blinden Flecken, deine Stärken, deine nächste Wachstumskante. Sieht niemand außer dir."],
          ].map(([t, d]) => (
            <div key={t} style={{ ...st.card, padding: "20px" }}>
              <h3 style={{ ...h, fontSize: 17, margin: "0 0 6px" }}>{t}</h3>
              <p style={{ ...st.body, fontSize: 14, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </S>

      {/* ─── Ehrlichkeit ─── */}
      <S style={{ marginTop: 56 }}>
        <p style={{ ...st.hint, textAlign: "center", fontSize: 14, maxWidth: 560, margin: "0 auto" }}>
          Ehrlich gesagt: Zwischenraum ist keine Therapie und will keine sein. Es ist der Ort, an dem
          ihr einander wieder zuhören lernt — und wenn mehr nötig ist, sagt es das auch.
          In akuten Krisen: Telefonseelsorge 0800&nbsp;111&nbsp;0&nbsp;111, Hilfetelefon 116&nbsp;016, Notruf 112.
        </p>
      </S>

      {/* ─── CTA ─── */}
      <S style={{ textAlign: "center", marginTop: 40 }}>
        <h2 style={{ ...h, fontSize: "clamp(24px, 4.5vw, 34px)", margin: 0 }}>
          Der erste Schritt ist ein Satz.
        </h2>
        <p style={{ fontSize: 16, color: C.inkSoft, margin: "10px 0 20px" }}>
          Erstell euren Raum, lade deine Partnerin oder deinen Partner ein — und fang einfach an zu schreiben.
        </p>
        <Btn onClick={onStart} style={{ padding: "14px 30px", fontSize: 16 }}>Euren Raum erstellen</Btn>
      </S>
    </div>
  );
}
