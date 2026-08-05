# Zwischenraum — KI-Paarbegleitung

Zwei Konten pro Paar, drei Sektionen: privates **Tagebuch** mit KI-Impressionen,
**Konflikte** mit Reflexion & Vermittlung, und ein **gemeinsamer moderierter Chat**,
der sich erst öffnet, wenn die KI beide Seiten gut genug kennt.

Datenschutz-Kernprinzip: Rohtexte verlassen nie das eigene Konto. Die KI der einen
Seite sieht von der anderen nur ein laufend verdichtetes, abstrahiertes Profil —
durchgesetzt per Row-Level-Security und serverseitiger KI-Logik.

## Stack

- Frontend: React + Vite (dieses Repo), Deployment z.B. Vercel
- Backend: Supabase (EU-Region wählbar) — Auth, Postgres mit RLS, Edge Function
- KI: Anthropic API (`claude-sonnet-4-6`), Key liegt nur in der Edge Function

## Setup (ca. 30–45 Min.)

### 1. Supabase-Projekt

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen — **Region: EU (z.B. Frankfurt)**.
2. SQL Editor öffnen → kompletten Inhalt von `supabase/schema.sql` ausführen.
3. Unter **Authentication → Providers → Email**: aktiviert lassen. Für schnelles
   Testen mit Freunden kannst du "Confirm email" **deaktivieren** (Registrierung
   ohne Bestätigungsmail). Für später wieder aktivieren.

### 2. Edge Function deployen

Mit der [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref DEIN_PROJECT_REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai
```

Den Anthropic-Key bekommst du unter [console.anthropic.com](https://console.anthropic.com)
(Kosten laufen auf dein Konto; mit Sonnet liegt eine typische Interaktion im
Bereich weniger Cent).

### 3. Frontend lokal starten

```bash
npm install
cp .env.example .env        # und Werte eintragen:
# VITE_SUPABASE_URL      → Supabase → Settings → API → Project URL
# VITE_SUPABASE_ANON_KEY → Supabase → Settings → API → anon public key
npm run dev
```

### 4. Deployen & an Freunde verschicken

Repo zu GitHub pushen → auf [vercel.com](https://vercel.com) importieren →
die beiden `VITE_…`-Variablen als Environment Variables setzen → Deploy.
Danach in Supabase unter **Authentication → URL Configuration** die Vercel-URL
als Site URL eintragen. Den Link kannst du direkt verschicken.

### 5. Optional: Mit Apple anmelden

Funktioniert erst nach Konfiguration (Apple-Developer-Konto nötig, ca. 99 €/Jahr):
Supabase **Authentication → Providers → Apple** → Anleitung dort folgen
(Service ID, Key, Team ID). Ohne Konfiguration zeigt der Button einen Hinweis
und E-Mail-Login funktioniert normal.

## Ablauf für Testpaare

1. Beide erstellen je ein eigenes Konto (E-Mail + Passwort).
2. Person 1 erstellt einen Paar-Raum und teilt den Einladungscode.
3. Person 2 tritt mit dem Code bei.
4. Beide schreiben Tagebuch und beschreiben Konflikte — jede Seite privat.
5. Ab je 3 Tagebucheinträgen und 1 Konflikt pro Person kann unter "Gemeinsam"
   die Bereitschaft geprüft werden; die KI entscheidet und eröffnet den Chat.

## Architektur-Notizen

- `diary_entries` / `conflicts`: RLS erzwingt, dass nur die Autorin liest.
- `ai_profiles`: das verdichtete Profil; Clients lesen nur das eigene, das des
  Partners ist ausschließlich der Edge Function (Service Role) zugänglich.
- `couple_state.gate_open`: der Chat-Insert ist per RLS-Policy blockiert,
  solange das Gate zu ist — nicht nur im UI.
- Sicherheits-Layer: alle Prompts enthalten die Regel, bei Gewalt/Gefährdung
  die Neutralität zu verlassen und auf Hilfsangebote zu verweisen.

## Bewusste MVP-Grenzen

- Chat aktualisiert per Polling (5 s) statt Realtime — für Tests ausreichend.
- Keine Verschlüsselung at rest über Supabase-Standard hinaus; für den
  Produktivbetrieb einplanen.
- Kein Passwort-Reset-Flow im UI (über Supabase möglich), keine Löschfunktion
  für den Paar-Raum — vor echtem Betrieb ergänzen (DSGVO).
