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

// Kennzeichnet ein Beispiel klar als erfunden — an dieser Stelle darf nie
// der Eindruck entstehen, hier stuenden echte Nutzerdaten.
function Beispiel({ children }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", color: C.inkSoft, background: C.paper,
      border: `1px solid ${C.line}`, borderRadius: 999, padding: "2px 10px", marginBottom: 10,
    }}>
      {children}
    </span>
  );
}

// Ein Schritt auf dem Weg. Die Nummerierung ist hier keine Deko: die
// Schritte bauen tatsaechlich aufeinander auf -- genau das war die Luecke,
// die Nutzerinnen gemeldet haben ("wofuer ist das alles?").
function Schritt({ n, farbe, titel, letzter, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: "0 14px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{
          width: 34, height: 34, borderRadius: 999, flexShrink: 0, background: farbe, color: "#fff",
          fontFamily: font.display, fontSize: 16, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {n}
        </span>
        {!letzter && <span aria-hidden="true" style={{ flex: 1, width: 2, background: C.line, marginTop: 6 }} />}
      </div>
      <div style={{ paddingBottom: letzter ? 0 : 24 }}>
        <h3 style={{ fontFamily: font.display, fontSize: 18, fontWeight: 600, color: C.ink, margin: "5px 0 0" }}>
          {titel}
        </h3>
        <p style={{ ...st.body, fontSize: 15 }}>{children}</p>
      </div>
    </div>
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
          Testphase · kostenlos · keine Werbung, kein Tracking · du musst nicht auf deinen Partner warten
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

      {/* ─── So fühlt es sich an ─── */}
      <S style={{ marginTop: 56 }}>
        <h2 style={{ ...h, fontSize: 26, textAlign: "center", margin: "0 0 22px" }}>So fühlt es sich an</h2>
        <div style={{ ...st.card, padding: "22px 24px" }}>
          <Beispiel>Beispiel — kein echter Eintrag</Beispiel>
          <p style={{ ...st.body, margin: 0, fontStyle: "italic" }}>
            „Er sagt, ich mache aus allem ein Drama. Vielleicht stimmt das ja. Aber wenn ich nichts
            sage, ändert sich nie was."
          </p>
          <div style={{ background: C.paper, borderLeft: `3px solid ${C.ink}`, borderRadius: 8, padding: "12px 14px", marginTop: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, letterSpacing: "0.06em" }}>ZWISCHENRAUM</span>
            <p style={{ ...st.body, marginTop: 4 }}>
              „Da steckt ein echtes Dilemma drin: Wenn du es ansprichst, giltst du als anstrengend —
              wenn nicht, bleibst du allein damit. Was wäre denn das Kleinste, das sich ändern müsste,
              damit sich das Ansprechen gelohnt hätte?"
            </p>
          </div>
        </div>
        <p style={{ ...st.hint, textAlign: "center", marginTop: 14 }}>
          Kein Chatbot-Small-Talk. Jemand, der wirklich zuhört — und nachfragt, statt nur zu trösten.
        </p>
      </S>

      {/* ─── Die drei Räume ─── */}
      <S style={{ marginTop: 56 }}>
        <h2 style={{ ...h, fontSize: 26, textAlign: "center", margin: "0 0 8px" }}>Drei Räume, klar getrennt</h2>
        <p style={{ ...st.body, textAlign: "center", color: C.inkSoft, maxWidth: 560, margin: "0 auto 22px" }}>
          Bei jeder Funktion siehst du sofort, wer sie sehen kann. Kein Rätselraten, keine
          Vertrauensfrage, die man erst erklären müsste.
        </p>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {[
            ["Dein Raum", C.a, "Tagebuch, Konflikte, ein Fragebogen über dich, dein persönlicher Spiegel. Alles privat — deine Partnerin oder dein Partner liest hier nie mit. Versprochen und technisch erzwungen, nicht nur zugesagt."],
            ["Der Zwischenraum", C.ink, "Hier entsteht, was keiner von euch allein sehen kann: das Beziehungsbild. Die KI kennt beide Seiten, gibt aber nie Rohtexte weiter — nur neu formuliertes, abgewogenes Verständnis."],
            ["Euer Raum", C.b, "Ein gemeinsamer, moderierter Chat, sobald ihr beide bereit seid. Alles, was hier steht, sehen beide — offen und auf Augenhöhe."],
          ].map(([t, col, d]) => (
            <div key={t} style={{ ...st.card, padding: "20px", borderTop: `3px solid ${col}` }}>
              <h3 style={{ ...h, fontSize: 18, margin: "0 0 8px" }}>{t}</h3>
              <p style={{ ...st.body, fontSize: 14, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </S>

      {/* ─── Wofür das alles gut ist ─── */}
      <S style={{ marginTop: 56 }}>
        <h2 style={{ ...h, fontSize: 26, textAlign: "center", margin: "0 0 8px" }}>Wofür das alles gut ist</h2>
        <p style={{ ...st.body, textAlign: "center", color: C.inkSoft, maxWidth: 560, margin: "0 auto 26px" }}>
          Zwischenraum ist keine Sammlung von Funktionen, sondern ein Weg. Jeder Schritt macht
          den nächsten erst möglich.
        </p>
        <div style={{ ...st.card, padding: "26px 28px" }}>
          <Schritt n="1" farbe={C.a} titel="Du schreibst — für dich allein.">
            Was dich heute beschäftigt. Der Streit, der immer wiederkommt. Ein paar Fragen über
            dich. Ohne Rücksicht darauf, wie es ankommt — hier kommt es bei niemandem an außer
            bei dir.
          </Schritt>
          <Schritt n="2" farbe={C.a} titel="Zwischenraum hört zu und fragt nach.">
            Auf jeden Eintrag kommt eine Antwort, oft eine Rückfrage, die weiterführt. Mit der
            Zeit entsteht daraus ein Verständnis von dir: was dich trägt, was dich verletzt, was
            sich wiederholt. Du kannst es jederzeit nachlesen — es heißt „Dein Spiegel" und
            gehört nur dir.
          </Schritt>
          <Schritt n="3" farbe={C.b} titel="Auf der anderen Seite passiert dasselbe. Getrennt.">
            Deine Partnerin oder dein Partner schreibt im eigenen Raum, mit eigenem Konto und
            eigenem Passwort. Keiner von euch sieht die Texte des anderen — auch nicht, ob
            überhaupt gerade etwas geschrieben wurde.
          </Schritt>
          <Schritt n="4" farbe={C.ink} titel="Daraus entsteht das Beziehungsbild." letzter>
            Zwischenraum ist die einzige Stelle, an der beide Seiten zusammenkommen. Was ihr dann
            lest, ist neu geschrieben: eure Gefühle, Bedürfnisse und Muster — nie eure Sätze. Und
            wenn ihr beide bereit seid, öffnet sich zusätzlich der gemeinsame Raum.
          </Schritt>
        </div>

        <div style={{ ...st.card, borderLeft: `3px solid ${C.ink}`, marginTop: 16 }}>
          <h3 style={{ ...h, fontSize: 18, margin: 0 }}>Deshalb gibt es das Beziehungsbild nicht sofort.</h3>
          <p style={{ ...st.body, fontSize: 15 }}>
            Es wird aus dem gemacht, was ihr schreibt. Wäre erst wenig da, würde jede
            „Zusammenfassung" in Wahrheit zur Nacherzählung — und dein Gegenüber läse praktisch
            deinen Originaltext. Genau das soll nie passieren. Also wartet Zwischenraum, bis von
            beiden Seiten genug da ist, und zeigt dir vorher an, wie weit du schon bist.
          </p>
        </div>
      </S>

      {/* ─── Das Beziehungsbild ─── */}
      <S style={{ marginTop: 56 }}>
        <div style={{ ...st.card, borderTop: `4px solid ${C.ink}`, padding: "26px 28px" }}>
          <h2 style={{ ...h, fontSize: 24, margin: 0 }}>Das Beziehungsbild</h2>
          <p style={{ ...st.body, fontSize: 16, marginTop: 10 }}>
            Wenn beide bereit sind und ausdrücklich zustimmen, entsteht der tiefste Blick, den es bei
            Zwischenraum gibt: ein Bild in drei Teilen — was du erlebst, was dein Gegenüber erlebt, was
            zwischen euch beiden passiert. Ohne Urteil, ohne Recht-haben. Diesen Moment gibt es sonst
            nirgends.
          </p>
          <div style={{ marginTop: 16 }}>
            <Beispiel>Beispiel — kein echtes Beziehungsbild</Beispiel>
            <div style={{ background: C.paper, borderRadius: 10, padding: "16px 18px", display: "grid", gap: 12 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.a, letterSpacing: "0.06em" }}>TEIL 1 — DAS ERLEBT ANNA</span>
                <p style={{ ...st.body, fontSize: 14, margin: "4px 0 0" }}>
                  „… Anna beschreibt eine tiefe Erschöpfung, die weniger mit den einzelnen Streitpunkten
                  zu tun hat als mit dem Gefühl, ständig erklären zu müssen, warum etwas für sie wichtig
                  ist …"
                </p>
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.b, letterSpacing: "0.06em" }}>TEIL 2 — DAS ERLEBT JONAS</span>
                <p style={{ ...st.body, fontSize: 14, margin: "4px 0 0" }}>
                  „… Jonas erlebt dieselben Situationen als Vorwurf, obwohl er versucht, es besser zu
                  machen — und zieht sich dann eher zurück, statt nachzufragen …"
                </p>
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, letterSpacing: "0.06em" }}>TEIL 3 — WAS ZWISCHEN EUCH PASSIERT</span>
                <p style={{ ...st.body, fontSize: 14, margin: "4px 0 0" }}>
                  „… Beide beantworten gerade unterschiedliche Fragen: Anna fragt ‚Wie machen wir es
                  besser?', Jonas eher ‚Kann ich das noch aus vollem Herzen wollen?' …"
                </p>
              </div>
            </div>
          </div>
        </div>
      </S>

      {/* ─── Du musst nicht warten ─── */}
      <S style={{ marginTop: 56 }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ ...h, fontSize: 24, margin: 0 }}>Du musst nicht auf deine Partnerin oder deinen Partner warten.</h2>
          <p style={{ ...st.body, fontSize: 16, marginTop: 10, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
            Fang allein an — schreib, ordne, versteh dich selbst besser. Dein Raum ist schon für sich
            genommen wertvoll. Und wenn deine Partnerin oder dein Partner bereit ist, ist der Raum für
            euch beide längst da.
          </p>
        </div>
      </S>

      {/* ─── Vertrauen kompakt ─── */}
      <S style={{ marginTop: 56 }}>
        <h2 style={{ ...h, fontSize: 26, textAlign: "center", margin: "0 0 18px" }}>Warum du das schreiben kannst, was du sonst für dich behältst</h2>
        <div style={{ ...st.card, padding: "22px 24px" }}>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              "Getrennte Konten mit eigenem Passwort — technisch erzwungen, nicht nur zugesagt",
              "Was zwischen euch vermittelt wird, entsteht immer neu formuliert, nie aus euren Originaltexten",
              "Tiefe gemeinsame Auswertungen nur, wenn beide sie ausdrücklich freigeben",
              "Server in der EU (Irland)",
              "Eure Daten trainieren keine KI-Modelle",
              "Keine Werbung, kein Tracking",
              "E-Mail-Benachrichtigungen enthalten nie Inhalte — nur den Hinweis, dass es etwas Neues gibt",
              "Jederzeit vollständig löschbar",
            ].map((zeile) => (
              <div key={zeile} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: C.ok, fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ ...st.body, margin: 0, fontSize: 14.5 }}>{zeile}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            <Tag role="A">Dein Raum</Tag>
            <Tag role="B">Euer Raum</Tag>
            <span style={{ background: C.paper, color: C.ink, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", padding: "3px 10px", borderRadius: 999, textTransform: "uppercase", border: `1px solid ${C.line}` }}>
              Der Zwischenraum
            </span>
          </div>
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
