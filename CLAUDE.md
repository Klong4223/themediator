# Zwischenraum — Projektkontext

KI-gestützte Paarbegleitung. Zwei Menschen schreiben getrennt und vertraulich,
eine neutrale KI vermittelt — ohne je die Rohtexte der einen Seite an die
andere durchzureichen.

**Live:** https://zwischenraum.work · **Status:** MVP in Testphase mit einer
Handvoll echter Nutzerinnen (Familie und Freunde). Noch keine Bezahlfunktion.

---

## Die unverhandelbaren Regeln

Diese Punkte sind das Produkt, nicht Implementierungsdetails. Sie werden nicht
aufgeweicht, auch nicht auf Zuruf — höchstens nach ausdrücklicher, informierter
Zustimmung beider Nutzer.

1. **Rohtext-Trennung.** Was eine Person schreibt, sieht die andere nie im
   Original. Technisch per Row-Level-Security erzwungen, nicht nur im UI.
   Cross-Partner-Wissen fließt ausschließlich über abstrahierte Profile und
   Chroniken (keine Zitate, keine erzählten Einzelereignisse, keine intimen
   Details, keine Namen Dritter).
   *Die Grenze ist nicht das Thema, sondern die Quelle:* Themenbereiche dürfen
   aus dem Wissen über beide angesteuert werden, Inhalte nie.
2. **Epistemik.** Jede Schilderung ist Perspektive, nie Faktum. Nur was beide
   unabhängig berichten, gilt als gesichertes Muster. Keine Parteinahme.
3. **Doppelte Freigabe** für Beziehungsbild und Spiegel — beide müssen aktiv
   zustimmen, Widerruf jederzeit möglich.
4. **Scope.** Beziehungsbegleitung, keine Therapie. Keine Diagnosen, keine
   Tiefenpsychologie. Verhalten, Bedürfnisse, Muster.
5. **Safety-Override.** Bei Hinweisen auf Gewalt, Missbrauch, Selbst- oder
   Fremdgefährdung verlässt die KI die Neutralität und verweist auf Hilfe
   (Hilfetelefon 116 016, Telefonseelsorge 0800 111 0 111, Notruf 112).
6. **E-Mails enthalten niemals Inhalte** — nur den Hinweis, dass es etwas Neues
   gibt.

---

## Architektur

**Frontend:** React + Vite, deutsch. Deployment über GitHub → Vercel
(automatisch bei jedem Commit auf `main`).

**Backend:** Supabase (EU/Irland, `eu-west-1`, Projekt `bhdybaonkdvpqlttyihx`)
— Auth, Postgres mit RLS, eine Edge
Function namens `ai` (Deno), die die gesamte KI-Logik kapselt.

**KI:** OpenAI (`gpt-5.6` für alles). Provider-Umschalter für Anthropic ist
eingebaut (`PROVIDER`-Konstante). Schlüssel liegen nur als Supabase-Secrets:
`OPENAI_API_KEY`, `RESEND_API_KEY`, optional `CRON_SECRET`.

**Mail:** Resend über `hallo@zwischenraum.work`, Supabase-Auth-Mails per SMTP
ebenfalls über Resend.

### Dateien

```
src/
  App.jsx              Auth, Onboarding, Admin-Weiche, Navigation (drei Räume)
  Landing.jsx          Startseite für Nicht-Angemeldete
  Invite.jsx           Ansprache für eingeladene Personen (?code= vor dem Login)
  Legal.jsx            Impressum, Datenschutz, Nutzungshinweise (Footer-Modal)
  AdminDashboard.jsx   Separates Admin-Konto, nur aggregierte Kennzahlen
  ui.jsx               Design-Tokens (C, st, font), Btn, Tag, Shell, InviteBox
  supabase.js          Client + callAI()
  sections/
    Diary.jsx           Tagebuch, Dialog-Fäden, "Zwischenraum fragt" (Dein Raum)
    Conflicts.jsx       Themen & Konflikte (Dein Raum)
    AboutYou.jsx        Fragebogen, KI-Interview, Profil, Chronik (Dein Raum)
    Spiegel.jsx         Consent, Polling, Generierung, DocChat — eigener Reiter (Dein Raum)
    Report.jsx          Beziehungsbild + "Der nächste Schritt" (Der Zwischenraum)
    BeziehungsbildGespraech.jsx  Gespräch zu fertigen Berichten — eigener Reiter (Dein Raum)
    NaechsterSchritt.jsx  Meilenstein-Karte, gespeist aus der meilensteine-Aktion
    DocChat.jsx          Verankerter Gesprächsfaden zu Bericht/Spiegel (privat)
    SharedChat.jsx       Gate + moderierter gemeinsamer Chat (Euer Raum)
    Geraetesperre.jsx    Lock-Screen fuer den Wiedereinstiegs-Schutz (Dein Raum)
    Settings.jsx         Benachrichtigungen, Konto, Löschung, PIN-Sperre (eigenes Icon, kein Raum)
supabase/
  schema.sql                   Vollständiges Schema, idempotent
  functions/ai/index.ts        Gesamte KI-Logik
```

**Navigation (App.jsx, seit 07.08.2026):** drei Räume statt einzelner Tabs —
„Dein Raum" (Unter-Navigation: Tagebuch / Über dich / Themen & Konflikte /
Dein Spiegel / Beziehungsbild), „Der Zwischenraum" (Beziehungsbild),
„Euer Raum" (gemeinsamer Chat).
Einstellungen ist Utility, kein Raum, eigenes Zahnrad-Icon. Details und
Begründung: `KONZEPT.md`.

### Datenmodell (Kern)

- `couples`, `couple_members` (role A/B, display_name, report_consent, email_freq)
- `diary_entries` + `diary_replies` (Dialog-Fäden, `thread_closed`)
- `conflicts`, `assessments` (Fragebogen + KI-Nachfragen), `probes` (Nachfragen)
- `ai_profiles` (verdichtetes Profil), `chronicle` (dauerhafte, abstrahierte
  Beobachtungen — das Langzeitgedächtnis der Begleitung)
- `reports`, `mirrors` (mit `status`: running/done/error, `stage`: notizen/bericht)
- `doc_chats` (verankerte private Gespräche zu Bericht/Spiegel, `kind`+`doc_id`)
- `chat_messages` (sender_id NULL = KI, `origin` = Herkunft bei getragenen
  Eröffnungen, z.B. `doc_chat:report`), `couple_state` (gate_open)
- `device_locks` (PIN-Hash+Salt fuer den Wiedereinstiegs-Schutz, RLS aktiv
  mit **null** Policies — nur die Edge Function per Service Role kommt ran)
- `email_events`, `admins`

**Verschlüsselte Spalten (seit 07.08.2026):** alle Inhaltsspalten — siehe
Backlog 7 für die vollständige Liste. Nur die Edge Function kann sie lesen
(`CONTENT_ENC_KEY`). Beim Fragebogen heißen sie `answers_enc`/
`followups_enc`; die alten `jsonb`-Spalten `answers`/`followups` sind
geleert und werden nicht mehr beschrieben.

**Regel für neue Features:** Inhalte werden ausschließlich über
Edge-Function-Aktionen gelesen und geschrieben. Seit dem 07.08.2026 ist
das **technisch erzwungen**: Clients haben auf allen Inhaltstabellen nur
noch Leserechte (RLS `for select`), Schreiben geht nur über die Service
Role. Ein versehentlicher Direkt-Insert scheitert also laut, statt still
Klartext zu hinterlassen. Lesen bleibt erlaubt — der Client bekäme
ohnehin nur Ciphertext.

Unverschlüsselt und weiterhin direkt beschreibbar sind nur Metadaten:
`couple_members` (`report_consent`, `display_name`, `email_freq`).
Alles andere (IDs, Zeitstempel, Status-Flags, `couple_state`) ist
lesbar, aber nicht mehr vom Client änderbar.

**Dauerhafte Folge:** auf verschlüsselten Spalten sind `like`/Volltextsuche,
Sortierung und SQL-seitige Aggregation nicht mehr möglich. Zählungen über
`count(*)` und Filter auf `null` funktionieren weiter (das Admin-Dashboard
und der Nachfragen-Filter beruhen darauf).

`reports.notizen`/`mirrors.notizen` sind zusätzlich per Spalten-Grant für
Clients gesperrt (siehe Delta `2026-08-07c` in `schema.sql`) — die
RLS-Policy auf `reports` gilt zeilenweise und hätte den Partnern sonst die
internen Analysenotizen offengelegt.

**RLS-Prinzip:** Eigene Inhalte nur für sich selbst lesbar. Partner-Profile,
-Chroniken und -Gespräche sind für Clients gar nicht zugänglich — nur die
Edge Function (Service Role) liest sie. Seit 07.08.2026 gilt zusätzlich:
Clients haben auf Inhaltstabellen **nur noch Leserechte**, jedes Schreiben
läuft über die Edge Function.

### Aktionen der Edge Function

`diary`, `diary_reply`, `conflict`, `assessment`, `assessment_followup`,
`probe`, `probe_answer`, `gate`, `chat`, `report`, `report_poll`, `mirror`,
`mirror_poll`, `doc_chat`, `doc_chat_share`, `meilensteine`, `notify`,
`daily_digest`, `lock_status`, `lock_set`, `lock_remove`, `lock_verify`,
`lock_reset_request`, `lock_reset_confirm`, `about_you_get`, `diary_list`,
`conflicts_list`, `chat_list`, `chat_send`, `reports_list`, `mirrors_list`,
`doc_chat_list`, `doc_chat_verdichten`, `assessment_skip`, `enc_status`,
`delete_account`, `admin_stats`

Die `*_list`-Aktionen und `chat_send` sind mit der Verschlüsselung
entstanden: sie ersetzen die früheren Direktzugriffe des Frontends und
liefern entschlüsselten Klartext. Wichtig dabei — sie laufen über den
Service-Role-Client und umgehen damit RLS, die Berechtigungsprüfung steht
also **im Code**: `mirrors_list` und `doc_chat_list` filtern auf
`user_id` (privat), `reports_list` und `chat_list` auf `couple_id`
(gemeinsam), `chat_send` prüft zusätzlich `couple_state.gate_open` und
setzt `sender_id` explizit (der Spalten-Default `auth.uid()` ergibt unter
Service Role NULL — und NULL heißt in diesem Schema „von Zwischenraum").

`diary` und `conflict` legen den Eintrag jetzt selbst an (nur so kommt er
verschlüsselt in die Datenbank) und akzeptieren übergangsweise noch die
alte Form mit `entry_id`/`conflict_id`, damit nach einem Deploy offene
Browser-Tabs keine Klartext-Zeilen erzeugen. Diese Kompatibilität kann
nach ein paar Wochen entfallen.

`about_you_get` liefert Fragebogen, Profil und Chronik entschlüsselt.
`assessment_skip` setzt nur das Überspringen-Flag — liegt trotzdem hier,
damit auf `assessments` gar keine Client-Schreibrechte mehr nötig sind.

`doc_chat_verdichten` arbeitet die verankerten Gespräche ins Profil und die
Chronik ein — sie waren bis 07.08.2026 die einzige Textquelle, die **nicht**
zurückfloss. Zwei Dinge daran sind bewusst so:
1. **Nur die eigenen Beiträge**, nie die Antworten von Zwischenraum. Beim
   Beziehungsbild beschreibt der Ausgangstext beide Menschen; würde man den
   Dialog komplett einarbeiten, sickerten Aussagen über die andere Person
   ins Profil dieser Person (Verstoß gegen Regel 1).
2. **Eigene Aktion statt inline in `doc_chat`**, weil `updateProfile` zwei
   Modellaufrufe braucht (~1 Minute). `DocChat.jsx` stößt sie nach dem
   Senden ohne Warten an; geht der Aufruf verloren, holt der nächste
   Beitrag alles Offene nach (`doc_chats.verdichtet`).
`enc_status` ist ein Admin-Diagnosewerkzeug: zählt je Spalte, wie viel noch
Klartext ist — liefert nur Zahlen, nie Inhalte.

**Secrets:** `OPENAI_API_KEY`, `RESEND_API_KEY`, `CONTENT_ENC_KEY`
(Verschlüsselung, siehe Backlog 7), optional `CRON_SECRET`.

Beziehungsbild und Spiegel laufen seit 07.08.2026 über OpenAIs Responses-API
mit `background: true` (`starteHintergrundantwort`/`holeHintergrundantwort`):
`report`/`mirror` starten nur Stufe 1 und kehren sofort zurück, `report_poll`/
`mirror_poll` (vom Frontend alle 5 s aufgerufen) fragen den Fortschritt ab und
stoßen Stufe 2 an. Kein einzelner Funktionsaufruf muss dadurch länger als ein
paar Sekunden laufen, unabhängig davon, wie lange das Modell denkt — löst das
alte `EdgeRuntime.waitUntil`-Problem (Wall-Clock-Abbruch mitten im Lauf, siehe
Git-Historie 06.–07.08.) grundlegend statt es nur abzufedern.

---

## Konventionen

- **Sprache:** UI, Prompts und Kommentare auf Deutsch. Prompts in der Edge
  Function ohne Umlaute (ae/oe/ue), weil sie in Template-Strings stehen.
- **Ton:** warm, konkret, nie therapeutisch-distanziert. Duzen.
  **Rückfragen nur, wenn sie etwas öffnen** — keine Pflichtfrage am Ende jeder
  Antwort. Bei abgeschlossenen oder erfreulichen Einträgen: anerkennen und
  stehenlassen.
- **Design:** Tokens aus `ui.jsx` verwenden, keine neuen Farben erfinden.
  Fraunces für Überschriften, Source Sans 3 für Fließtext. Partner A ocker
  (`C.a`), Partner B petrol (`C.b`).
- **Fehlermeldungen:** immer die echte Ursache anzeigen, nie „Bitte erneut
  versuchen" ohne Detail. Bei fehlschlagenden Aktionen einen Wiederholen-Knopf
  anbieten.
- **SQL:** ausschließlich idempotent und additiv (`if not exists`,
  `drop policy if exists` vor jedem `create policy`, `create or replace`).
  Niemals Daten löschen oder überschreiben, ohne das vorher anzukündigen.
  Keine literalen `\n` im SQL — das ist hier schon zweimal schiefgegangen.
- **Vor jedem Ausliefern:** `npm run build` muss durchlaufen. Die Edge Function
  zusätzlich mit `tsc --noEmit` prüfen — esbuild findet keine
  Nutzung-vor-Deklaration, was schon einen Produktionsfehler verursacht hat.

---

## Deployment

1. **Frontend:** Commit auf `main` → Vercel baut automatisch.
2. **Edge Function:** Inhalt von `supabase/functions/ai/index.ts` im
   Supabase-Dashboard unter Edge Functions → `ai` einfügen und deployen.
   (Manuell, weil Peter meist ohne CLI arbeitet.)
3. **Schema-Änderungen:** als eigenes, idempotentes Delta-Skript ausgeben, das
   Peter im SQL Editor ausführt. Zusätzlich an `supabase/schema.sql` anhängen.

Reihenfolge immer: SQL → Edge Function → Frontend.

---

## Offener Backlog

0. **Automatische Datenbank-Backups aktivieren** — Stand 06.08.2026 aus
   (`pitr_enabled: false`, keine gespeicherten Backups laut Management-API).
   Braucht mindestens den Pro-Plan (Settings → Add-ons). Bis dahin: jeder
   schreibende Eingriff in die Datenbank ist ohne Netz. Dringlicher als
   Punkt 5, weil Verschlüsselung ohne Backup das Risiko nur verschiebt.
   **Bewusst zurückgestellt (Peter, 07.08.2026):** noch eine Handvoll
   Testerinnen, kein zahlender Betrieb — Aktivierung erst bei größerer
   Nutzerbasis. Vor dem nächsten größeren Nutzerschub oder Kommerzialisierung
   erneut ansprechen, nicht stillschweigend liegen lassen.
1. ~~Laufzeit von Beziehungsbild/Spiegel~~ **→ gelöst (07.08.2026).**
   `report`/`mirror` laufen jetzt über OpenAIs Responses-API mit
   `background: true`, Fortschritt per Polling (`report_poll`/`mirror_poll`)
   — kein `EdgeRuntime.waitUntil` mehr, kein Wall-Clock-Risiko, keine
   Deckelung der Denktiefe. Der zweite, härtere Fund dabei: mehrere
   Fehlschläge lagen gar nicht an der Laufzeit, sondern an einem eigenen
   Extraktionsfehler (`holeHintergrundantwort` las nur das oft leere
   `output_text`-Kurzfeld statt den Text zusätzlich aus dem strukturierten
   `output`-Array zu holen) — behoben in `2026-08-06e`/`d31f837`. Mit echten
   Nutzerinnen (Kathrin/Markus, Sarah) verifiziert.
2. ~~Versionsinfo in den Einstellungen~~ **→ gelöst (07.08.2026).**
   Frontend-Version (`FRONTEND_VERSION` in `supabase.js`) und tatsächlich
   deployte Edge-Function-Version (`?ping=1` über `pingAI()`) stehen in
   `Settings.jsx` untereinander — sichtbar per Browser-QA verifiziert.
3. ~~Tagebuch-Ablauf~~ **→ gelöst (07.08.2026).** `Diary.jsx` laedt die
   Liste sofort nach dem Speichern neu, der neue Eintrag erscheint oben,
   der Ladehinweis („Zwischenraum liest deinen Eintrag …") steht direkt am
   Eintrag statt am Eingabefeld.
4. ~~Sichtbarer Arbeitsstatus~~ **→ gelöst (07.08.2026).** Eigener,
   konkreter Ladehinweis je Aktion statt generischem Button-Spinner:
   Tagebuch, Dialog-Antworten, Konflikte, Chat-Moderation. Beziehungsbild/
   Spiegel haben zusätzlich eine echte Phasenanzeige über die vorhandene
   `stage`-Spalte (`Report.jsx`/`Spiegel.jsx`: „liest euch beide …" vs.
   „schreibt euer Beziehungsbild …").
5. ~~Barometer~~ **→ „Der nächste Schritt"** (verworfen und ersetzt am
   07.08.2026, siehe `KONZEPT.md`): Kein Füllstand je Partner — ein
   Fleiß-Maß über die andere Person würde bei einem Paar in der Krise zum
   Vorwurf. Stattdessen eine Karte, die den nächsten noch nicht erreichten
   Meilenstein benennt und im Klartext begründet, warum er es noch nicht
   ist. Baut auf dem vorhandenen Muster von `couple_state.readiness` auf.
6. ~~Wiedereinstiegs-Schutz für „Dein Raum"~~ **→ gelöst (07.08.2026).**
   PIN, bevor „Dein Raum" nach einer Pause erneut sichtbar wird. Motivation
   nicht Kryptografie, sondern die realistischste Bedrohung bei einem
   Paar-Produkt: das entsperrte Handy liegt kurz auf dem Tisch, die
   Partnerin oder der Partner nimmt es in die Hand. Dasselbe Prinzip wie der
   App-Lock bei Signal oder Banking-Apps — die Anmeldesitzung bleibt
   bestehen, aber niemand kommt ohne den zweiten Schritt an Inhalte.
   Technisch: eigene Tabelle `device_locks` (salted SHA-256, Salt pro
   Nutzer) mit RLS aktiv und **null** Policies — kein Client, auch nicht der
   eigene, kann den Hash je lesen, nur die Edge Function per Service Role.
   Vier Aktionen (`lock_status`/`lock_set`/`lock_remove`/`lock_verify`),
   `App.jsx` sperrt „Dein Raum" ueber `visibilitychange` (sofort beim
   Verstecken, nicht erst beim Zurueckkommen) und laesst die anderen beiden
   Raeume unberuehrt, `Settings.jsx` verwaltet Einrichten/Aendern/Entfernen.
   Ehrlich beschriftet als „zusätzliche Sperre auf diesem Gerät", nicht als
   Verschlüsselung — schützt nicht vor jemandem mit dauerhaftem Zugriff auf
   das entsperrte Gerät. Per Browser-QA mit Wegwerf-Testkonto vollständig
   durchgespielt (Sperre setzen/falsch/richtig, PIN ändern mit falschem/
   richtigem altem PIN, Sperre entfernen, `delete_account` räumt
   `device_locks` mit auf) und rückstandsfrei aufgeräumt.

   **Nachtrag (07.08.2026): PIN vergessen.** Zwei weitere Aktionen,
   `lock_reset_request`/`lock_reset_confirm` — Peters Frage, ob es dafür
   einen Weg gibt, war berechtigt: ohne sie saß man vor der eigenen Sperre
   fest, weder `lock_set` noch `lock_remove` kommen ohne den PIN aus, den man
   ja gerade vergessen hat. Bewusst per Mail statt z.B. per Konto-Passwort,
   weil genau das den zweiten Faktor gegen die eigentliche Bedrohung bringt:
   Wer nur das entsperrte, angemeldete Handy in der Hand hat, kommt ohne
   Zugriff auf das Mail-Postfach nicht daran vorbei. `device_locks` hat dafür
   zwei weitere Spalten (`reset_token_hash`, `reset_expires`, 30 Minuten
   gültig, Token einmalig). Der Mail-Link (`?pin_reset=<token>`) landet in
   `App.jsx`, das ihn nach dem Login automatisch einlöst, die Sperre entfernt
   und den Query-Parameter aus der URL entfernt, damit ein Reload ihn nicht
   erneut einlöst. Getestet: Anfrage (Token-Hash+Ablauf landen korrekt in der
   Tabelle), falscher Code, abgelaufener Link, erfolgreicher Rücksetzvorgang
   über die echte UI, Replay desselben Links (schlägt danach fehl, weil die
   Zeile schon gelöscht ist) — danach wieder rückstandsfrei aufgeräumt.
7. **Verschlüsselung der Inhalte in der Datenbank** — in drei Wellen, weil
   ein einziger Deploy sonst Krypto-Risiko und Autorisierungs-Risiko
   vermischt und man bei einem Fehler nicht mehr weiß, welches davon.
   **→ gelöst (07.08.2026), alle drei Wellen.** In der Datenbank steht
   kein Inhalts-Klartext mehr (per `enc_status` verifiziert):
   `ai_profiles.profile`, `chronicle.observation`,
   `reports.notizen`+`content`, `mirrors.notizen`+`content`,
   `diary_entries.content`+`ai_feedback`, `diary_replies.content`,
   `conflicts.title`+`content`+`ai_reflection`, `chat_messages.content`,
   `probes.q`+`a`, `doc_chats.content`, `assessments.answers_enc`+
   `followups_enc`.
   AES-256-GCM, Schlüssel nur als Secret `CONTENT_ENC_KEY`, nie in
   Postgres. Format `zr1:<Fingerprint>:<IV>:<Ciphertext>`; alles ohne
   `zr1:` gilt als Alt-Klartext und wird durchgereicht, deshalb ist ein
   Code-Deploy für sich allein immer unschädlich. Bestandsdaten migriert
   und gegen ein vorher gezogenes Backup zeichengenau verifiziert
   (24/24, 160/160, 9/9 identisch).
   Bei `assessments` liegen die Werte in **neuen** Spalten `answers_enc`/
   `followups_enc` (text) statt in den alten `jsonb`-Spalten — ein
   Typwechsel hätte ein Deploy-Fenster erzeugt, in dem das Speichern
   entweder scheitert oder still Klartext schreibt. Die alten Spalten
   sind geleert und können später ersatzlos entfallen.
   **Ehrliche Grenze, so auch nach außen formulieren:** schützt gegen
   Table Editor, SQL-Zugriff und Datenbank-Lecks — *nicht* gegen den
   Betreiber, weil die KI die Rohtexte zwangsläufig im Klartext
   verarbeitet. Absolute Nulleinsicht ginge nur clientseitig.
   Plan mit allen Details: `C:\Users\Peter\.claude\plans\moonlit-meandering-steele.md`

## Bekannte Grenzen

- Chat aktualisiert per Polling, nicht Realtime.
- Apple-Login vorbereitet, aber nicht konfiguriert (Button entfernt).
- Tageszusammenfassung braucht noch einen Cron-Job (auskommentiert in `schema.sql`).
- Vor kommerziellem Start: Anwaltsprüfung (Art.-9-Daten, AGB), Gewerbeanmeldung.

## Zusammenarbeit

Peter arbeitet oft am Handy — dann Änderungen als vollständige Dateien zum
Kopieren ausgeben und explizit sagen, welche Dateien betroffen sind.
Widerspruch ist erwünscht: Wenn eine Anforderung dem Vertrauensversprechen
oder dem Nutzen der Anwenderinnen widerspricht, das ansprechen statt still
umsetzen.
