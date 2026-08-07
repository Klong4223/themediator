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
  App.jsx              Auth, Onboarding, Tab-Navigation, Admin-Weiche
  Landing.jsx          Startseite für Nicht-Angemeldete
  Legal.jsx            Impressum, Datenschutz, Nutzungshinweise (Footer-Modal)
  AdminDashboard.jsx   Separates Admin-Konto, nur aggregierte Kennzahlen
  ui.jsx               Design-Tokens (C, st, font), Btn, Tag, Shell, InviteBox
  supabase.js          Client + callAI()
  sections/
    Diary.jsx          Tagebuch, Dialog-Fäden, "Zwischenraum fragt"
    Conflicts.jsx      Themen & Konflikte
    SharedChat.jsx     Gate + moderierter gemeinsamer Chat
    Report.jsx         Beziehungsbild + Spiegel (Hintergrundverarbeitung)
    AboutYou.jsx       Fragebogen, KI-Interview, Profil, Chronik
    Settings.jsx       Benachrichtigungen, Konto, Löschung
supabase/
  schema.sql                   Vollständiges Schema, idempotent
  functions/ai/index.ts        Gesamte KI-Logik
```

### Datenmodell (Kern)

- `couples`, `couple_members` (role A/B, display_name, report_consent, email_freq)
- `diary_entries` + `diary_replies` (Dialog-Fäden, `thread_closed`)
- `conflicts`, `assessments` (Fragebogen + KI-Nachfragen), `probes` (Nachfragen)
- `ai_profiles` (verdichtetes Profil), `chronicle` (dauerhafte Beobachtungen)
- `reports`, `mirrors` (mit `status`: running/done/error)
- `chat_messages` (sender_id NULL = KI), `couple_state` (gate_open)
- `email_events`, `admins`

**RLS-Prinzip:** Eigene Inhalte nur für sich selbst lesbar. Partner-Profile und
-Chroniken sind für Clients gar nicht zugänglich — nur die Edge Function
(Service Role) liest sie.

### Aktionen der Edge Function

`diary`, `diary_reply`, `conflict`, `assessment`, `assessment_followup`,
`probe`, `probe_answer`, `gate`, `chat`, `report`, `mirror`, `notify`,
`daily_digest`, `delete_account`, `admin_stats`

Beziehungsbild und Spiegel laufen über `EdgeRuntime.waitUntil` im Hintergrund
und setzen `status` in der Datenbank; das Frontend pollt alle 5 Sekunden.
Seit Version `2026-08-06c` hat jeder Modellaufruf ein `AbortController`-Limit
(150 s) und der Gesamtlauf ein Budget (330 s) — Stand 06.08. beobachtet aber
Läufe, die auch das deutlich überschreiten, ohne dass `status` auf `error`
kippt. Ursache noch offen, siehe Backlog.

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
1. **Laufzeit von Beziehungsbild/Spiegel in den Griff bekommen, ohne die
   Modelltiefe zu beschneiden** — der Kernwert der Begleitung hängt an
   Aufrufen, die bewusst lange und gründlich denken dürfen. Das AbortController-
   Timeout aus `2026-08-06c` schützt die Datenbankzeile (kein ewiges
   „running" mehr), löst aber nicht das eigentliche Problem: Modellaufrufe,
   die die Wall-Clock-Grenze der Edge Function reißen, laufen weiterhin ins
   Leere. Naheliegendster Ausweg: OpenAI-Aufrufe über die Responses-API mit
   `background: true` starten, Antwort per Polling abholen — das entkoppelt
   Denkzeit des Modells von der Lebensdauer der Edge Function vollständig.
   Zweitschritt, falls das nicht reicht: den zweistufigen Ablauf (Notizen →
   Bericht) in zwei eigenständige Funktionsaufrufe zerlegen, die je nur einen
   Modellaufruf überstehen müssen.
2. **Versionsinfo in den Einstellungen** — Frontend-Version und tatsächlich
   deployte Edge-Function-Version anzeigen (letztere per `?ping=1`), damit
   sichtbar ist, ob ein Update angekommen ist.
3. **Tagebuch-Ablauf:** Ein neuer Eintrag soll sofort oben in der Liste
   erscheinen, der Ladehinweis direkt darunter — dort, wo die Antwort kommt.
   Aktuell steht „Zwischenraum liest …" oben am Eingabefeld, der Eintrag
   erscheint weit darunter.
4. **Sichtbarer Arbeitsstatus** überall statt des unscheinbaren Hinweises:
   deutlich erkennbar, dass die KI arbeitet, gern mit Phasenanzeige
   („liest deinen Eintrag" → „formuliert eine Rückmeldung"). Betrifft Tagebuch,
   Dialog, Konflikte, Nachfragen, Chat-Moderation, Beziehungsbild, Spiegel.
   Für Beziehungsbild/Spiegel gibt es seit 06.08. immerhin eine Stale-Erkennung
   mit Wiederholen-Knopf (`Report.jsx`) — das ist ein Netz gegen ewiges Warten,
   keine Phasenanzeige.
5. ~~Barometer~~ **→ „Der nächste Schritt"** (verworfen und ersetzt am
   07.08.2026, siehe `KONZEPT.md`): Kein Füllstand je Partner — ein
   Fleiß-Maß über die andere Person würde bei einem Paar in der Krise zum
   Vorwurf. Stattdessen eine Karte, die den nächsten noch nicht erreichten
   Meilenstein benennt und im Klartext begründet, warum er es noch nicht
   ist. Baut auf dem vorhandenen Muster von `couple_state.readiness` auf.
6. **Verschlüsselung der Inhalte in der Datenbank** — als Letztes. Ziel:
   Schutz gegen Datenbank-Leaks und versehentliches Mitlesen im Table Editor.
   Schlüssel als Edge-Function-Secret. Klar kommunizierte Grenze: schützt nicht
   gegen den entschlossenen Betreiber; echte Nulleinsicht ginge nur
   clientseitig. Migration bestehender Daten nötig — vorher Backup.

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
