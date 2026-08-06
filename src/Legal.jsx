import React, { useState } from "react";
import { C, st } from "./ui.jsx";

/* ────────────────────────────────────────────────────────────
   WICHTIG: Platzhalter in eckigen Klammern VOR dem Teilen
   ausfüllen — ein Impressum ohne echten Namen und ladungs-
   fähige Anschrift ist selbst ein Abmahngrund.
   ──────────────────────────────────────────────────────────── */

export const KONTAKT = {
  name: "Peter Hensel",
  strasse: "Schwanenring 72",
  ort: "47441 Moers",
  email: "P.hensel@gmx.net",
};

const H = ({ children }) => <h3 style={{ ...st.h2, fontSize: 16, marginTop: 18 }}>{children}</h3>;
const P = ({ children }) => <p style={{ ...st.body, fontSize: 14 }}>{children}</p>;

export function ImpressumText() {
  return (
    <div>
      <h2 style={st.h2}>Impressum</h2>
      <P>Angaben gemäß § 5 DDG:</P>
      <P>{KONTAKT.name}<br />{KONTAKT.strasse}<br />{KONTAKT.ort}<br />E-Mail: {KONTAKT.email}</P>
      <P>Verantwortlich im Sinne des § 18 Abs. 2 MStV: {KONTAKT.name}, Anschrift wie oben.</P>
      <H>Hinweis zur Testphase</H>
      <P>Zwischenraum befindet sich in einer nicht-kommerziellen Erprobungsphase. Es bestehen keine
        Umsätze und keine entgeltlichen Leistungen.</P>
      <H>Streitbeilegung</H>
      <P>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.</P>
    </div>
  );
}

export function DatenschutzText() {
  return (
    <div>
      <h2 style={st.h2}>Datenschutzerklärung</h2>

      <H>1. Verantwortlicher</H>
      <P>{KONTAKT.name}, {KONTAKT.strasse}, {KONTAKT.ort}, E-Mail: {KONTAKT.email}</P>

      <H>2. Welche Daten wir verarbeiten</H>
      <P>Kontodaten (E-Mail-Adresse, Passwort verschlüsselt, gewählter Anzeigename) sowie die Inhalte,
        die du aktiv eingibst: Tagebucheinträge, Konfliktbeschreibungen, Fragebogen-Antworten und
        Chat-Nachrichten. Diese Inhalte können naturgemäß besondere Kategorien personenbezogener
        Daten im Sinne von Art. 9 DSGVO enthalten (z.B. Angaben zu Gesundheit, Sexualleben,
        seelischem Befinden).</P>

      <H>3. Zwecke und Rechtsgrundlagen</H>
      <P>Wir verarbeiten deine Daten ausschließlich, um dir die Funktionen von Zwischenraum
        bereitzustellen: private Reflexion, KI-gestützte Rückmeldungen und — nur mit gesonderter
        Freigabe beider Partner — gemeinsame Auswertungen (Beziehungsbild, Spiegel).
        Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Dienstes) und deine
        bei der Registrierung erteilte ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO.
        Du kannst diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen
        (E-Mail genügt); ohne sie ist die Nutzung nicht möglich.</P>

      <H>4. Vertraulichkeit zwischen den Partnern</H>
      <P>Deine Rohtexte sind für deine Partnerin oder deinen Partner zu keinem Zeitpunkt einsehbar;
        das ist technisch auf Datenbankebene erzwungen. KI-Auswertungen, die Wissen über beide
        Seiten zusammenführen, erfolgen nur in abstrahierter Form oder nach ausdrücklicher,
        widerruflicher Freigabe beider Partner.</P>

      <H>5. KI-Verarbeitung (Auftragsverarbeiter)</H>
      <P>Für die KI-Rückmeldungen übermitteln wir deine Eingaben an OpenAI (OpenAI, L.L.C., USA)
        zur Verarbeitung über deren API. Die Übermittlung in die USA erfolgt auf Grundlage des
        EU-US Data Privacy Framework bzw. der EU-Standardvertragsklauseln. API-Daten werden von
        OpenAI nicht zum Training von Modellen verwendet. Es findet keine automatisierte
        Entscheidungsfindung mit Rechtswirkung statt.</P>

      <H>6. E-Mail-Benachrichtigungen</H>
      <P>Wenn du Benachrichtigungen aktiviert hast, senden wir dir E-Mails über den Dienstleister
        Resend (Region EU/Irland). Übermittelt werden dafür nur deine E-Mail-Adresse und ein
        inhaltsloser Hinweistext. <strong>Unsere E-Mails enthalten niemals Inhalte aus deinen
        Einträgen, Konflikten oder Nachrichten.</strong> Die Häufigkeit kannst du jederzeit im
        Bereich „Über dich → Benachrichtigungen" ändern oder den Versand ganz abstellen.</P>

      <H>7. Hosting</H>
      <P>Datenhaltung und Authentifizierung: Supabase (Datenbank-Region: EU/Irland).
        Auslieferung der Web-Oberfläche: Vercel. Mit den Anbietern bestehen
        Auftragsverarbeitungsverträge.</P>

      <H>8. Keine Werbung, kein Tracking</H>
      <P>Wir setzen keine Analyse-, Werbe- oder Tracking-Dienste ein und geben deine Daten nicht
        zu Werbezwecken weiter. Es werden nur technisch notwendige Speichervorgänge im Browser
        genutzt (Anmelde-Sitzung); ein Cookie-Banner ist daher nicht erforderlich
        (§ 25 Abs. 2 TDDDG).</P>

      <H>9. Speicherdauer und Löschung</H>
      <P>Deine Daten bleiben gespeichert, solange dein Konto besteht. Du kannst dein Konto
        jederzeit selbst löschen (Bereich „Einstellungen → Konto löschen"). Dabei werden alle
        deine Inhalte unwiderruflich entfernt: Tagebuch, Themen und Konflikte, Fragebogen,
        Profil, Spiegel und deine Nachrichten. Gemeinsame Beziehungsbilder werden ebenfalls
        gelöscht, da sie aus deinem Material entstanden sind. Der Paar-Raum bleibt für die
        andere Person mit deren eigenen Inhalten bestehen. Alternativ genügt eine formlose
        E-Mail an {KONTAKT.email}.</P>

      <H>10. Deine Rechte</H>
      <P>Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
        Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) sowie
        das Recht, deine Einwilligung jederzeit zu widerrufen. Du kannst dich zudem bei einer
        Datenschutz-Aufsichtsbehörde beschweren.</P>
    </div>
  );
}

export function NutzungText() {
  return (
    <div>
      <h2 style={st.h2}>Nutzungshinweise</h2>
      <H>Keine Therapie, keine Beratung im heilkundlichen Sinn</H>
      <P>Zwischenraum ist ein KI-gestütztes Reflexions- und Kommunikationswerkzeug für Paare.
        Es ist keine Psychotherapie, keine Heilbehandlung, keine Rechtsberatung und ersetzt
        keine professionelle Hilfe. Die KI kann sich irren; ihre Rückmeldungen sind Impulse,
        keine Feststellungen oder Diagnosen. Entscheidungen triffst du selbst.</P>
      <H>In Krisen</H>
      <P>Bei akuten Krisen, Gewalt oder Gedanken, dir oder anderen etwas anzutun, nutze bitte
        sofort professionelle Hilfe: Telefonseelsorge 0800&nbsp;111&nbsp;0&nbsp;111 (kostenlos, rund um
        die Uhr), Hilfetelefon Gewalt gegen Frauen 116&nbsp;016, im Notfall 112.</P>
      <H>Voraussetzungen</H>
      <P>Die Nutzung ist Personen ab 18 Jahren vorbehalten. Zwischenraum befindet sich in einer
        Testphase: Funktionen können sich ändern, Verfügbarkeit und Fehlerfreiheit sind nicht
        zugesichert. Die Haftung ist auf Vorsatz und grobe Fahrlässigkeit beschränkt; die Haftung
        für Schäden aus der Verletzung von Leben, Körper oder Gesundheit bleibt unberührt.</P>
    </div>
  );
}

/* ─── Footer + Modal ────────────────────────────────────── */
export function LegalFooter() {
  const [page, setPage] = useState(null);
  const link = { background: "none", border: "none", color: C.inkSoft, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: 0 };
  return (
    <div>
      <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 40 }}>
        <button style={link} onClick={() => setPage("impressum")}>Impressum</button>
        <button style={link} onClick={() => setPage("datenschutz")}>Datenschutz</button>
        <button style={link} onClick={() => setPage("nutzung")}>Nutzungshinweise</button>
      </div>
      {page && (
        <div onClick={() => setPage(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(35,43,56,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ ...st.card, maxWidth: 640, maxHeight: "80vh", overflowY: "auto", width: "100%" }}>
            {page === "impressum" && <ImpressumText />}
            {page === "datenschutz" && <DatenschutzText />}
            {page === "nutzung" && <NutzungText />}
            <div style={{ textAlign: "center", marginTop: 18 }}>
              <button style={{ ...link, fontSize: 14 }} onClick={() => setPage(null)}>Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
