-- ============================================================
-- Zwischenraum — Schema, RLS & RPCs
-- Im Supabase SQL Editor einmal komplett ausführen.
-- ============================================================

create extension if not exists pgcrypto;

-- ─── Tabellen ────────────────────────────────────────────────
create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

create table if not exists couple_members (
  couple_id uuid not null references couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('A','B')),
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

create table if not exists diary_entries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null,
  ai_feedback text,
  created_at timestamptz not null default now()
);

create table if not exists conflicts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  content text not null,
  ai_reflection text,
  created_at timestamptz not null default now()
);

-- Abstrahiertes KI-Profil pro Person: NIE Rohtext, nur verdichtete Muster.
-- Clients haben KEINEN Zugriff auf das Profil des Partners (RLS unten).
create table if not exists ai_profiles (
  couple_id uuid not null references couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile text not null default '',
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  sender_id uuid default auth.uid(),  -- NULL = Zwischenraum (KI)
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists couple_state (
  couple_id uuid primary key references couples(id) on delete cascade,
  gate_open boolean not null default false,
  readiness text,
  updated_at timestamptz not null default now()
);

-- ─── Hilfsfunktion ───────────────────────────────────────────
create or replace function public.is_member(c uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from couple_members where couple_id = c and user_id = auth.uid()
  );
$$;

-- ─── Row Level Security ──────────────────────────────────────
alter table couples        enable row level security;
alter table couple_members enable row level security;
alter table diary_entries  enable row level security;
alter table conflicts      enable row level security;
alter table ai_profiles    enable row level security;
alter table chat_messages  enable row level security;
alter table couple_state   enable row level security;

create policy "couples: Mitglieder lesen" on couples
  for select using (is_member(id));

create policy "members: Mitglieder lesen" on couple_members
  for select using (is_member(couple_id));

-- Tagebuch & Konflikte: strikt nur eigene Zeilen — der Partner sieht NIE Rohtext.
create policy "diary: nur eigene" on diary_entries
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_member(couple_id));

create policy "conflicts: nur eigene" on conflicts
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_member(couple_id));

-- Profil: nur das eigene lesbar. Schreiben nur durch die Edge Function (Service Role).
create policy "profiles: nur eigenes lesen" on ai_profiles
  for select using (user_id = auth.uid());

-- Chat: beide Mitglieder lesen; schreiben nur als man selbst und nur bei offenem Gate.
create policy "chat: Mitglieder lesen" on chat_messages
  for select using (is_member(couple_id));

create policy "chat: senden bei offenem Gate" on chat_messages
  for insert with check (
    is_member(couple_id)
    and sender_id = auth.uid()
    and exists (select 1 from couple_state cs where cs.couple_id = chat_messages.couple_id and cs.gate_open)
  );

create policy "state: Mitglieder lesen" on couple_state
  for select using (is_member(couple_id));

-- ─── RPCs ────────────────────────────────────────────────────
-- Paar-Raum erstellen (Ersteller wird Partner A)
create or replace function public.create_couple(p_name text)
returns json language plpgsql security definer
set search_path = public as $$
declare v_couple couples;
begin
  if exists (select 1 from couple_members where user_id = auth.uid()) then
    raise exception 'Du bist bereits Teil eines Paar-Raums.';
  end if;
  insert into couples default values returning * into v_couple;
  insert into couple_members (couple_id, user_id, role, display_name)
    values (v_couple.id, auth.uid(), 'A', nullif(trim(p_name), ''));
  insert into couple_state (couple_id) values (v_couple.id);
  return json_build_object('couple_id', v_couple.id, 'invite_code', v_couple.invite_code);
end $$;

-- Mit Einladungscode beitreten (wird Partner B)
create or replace function public.join_couple(p_code text, p_name text)
returns uuid language plpgsql security definer
set search_path = public as $$
declare v_id uuid;
begin
  if exists (select 1 from couple_members where user_id = auth.uid()) then
    raise exception 'Du bist bereits Teil eines Paar-Raums.';
  end if;
  select id into v_id from couples where invite_code = lower(trim(p_code));
  if v_id is null then raise exception 'Ungültiger Einladungscode.'; end if;
  if (select count(*) from couple_members where couple_id = v_id) >= 2 then
    raise exception 'Dieser Raum ist bereits vollständig.';
  end if;
  insert into couple_members (couple_id, user_id, role, display_name)
    values (v_id, auth.uid(), 'B', nullif(trim(p_name), ''));
  return v_id;
end $$;

-- Fortschritt zum Gate: nur Zählwerte, nie Inhalte des Partners.
create or replace function public.gate_progress()
returns json language plpgsql security definer
set search_path = public as $$
declare
  v_couple uuid;
  v_partner uuid;
  v_state couple_state;
begin
  select couple_id into v_couple from couple_members where user_id = auth.uid();
  if v_couple is null then return null; end if;
  select user_id into v_partner from couple_members
    where couple_id = v_couple and user_id <> auth.uid();
  select * into v_state from couple_state where couple_id = v_couple;
  return json_build_object(
    'gate_open', coalesce(v_state.gate_open, false),
    'readiness', v_state.readiness,
    'partner_joined', v_partner is not null,
    'my_diary',         (select count(*) from diary_entries where couple_id = v_couple and user_id = auth.uid()),
    'partner_diary',    (select count(*) from diary_entries where couple_id = v_couple and user_id = v_partner),
    'my_conflicts',     (select count(*) from conflicts     where couple_id = v_couple and user_id = auth.uid()),
    'partner_conflicts',(select count(*) from conflicts     where couple_id = v_couple and user_id = v_partner)
  );
end $$;

grant execute on function public.create_couple(text) to authenticated;
grant execute on function public.join_couple(text, text) to authenticated;
grant execute on function public.gate_progress() to authenticated;
grant execute on function public.is_member(uuid) to authenticated;

-- ============================================================
-- UPDATE 1: Persoenlichkeits-Basis ("Ueber dich")
-- Bei bestehendem Projekt: nur diesen Block im SQL Editor ausfuehren.
-- ============================================================

create table if not exists assessments (
  couple_id uuid not null references couples(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  answers jsonb,
  followups jsonb,
  completed boolean not null default false,
  interview_done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

alter table assessments enable row level security;

create policy "assessments: nur eigene" on assessments
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_member(couple_id));

create or replace function public.gate_progress()
returns json language plpgsql security definer
set search_path = public as $$
declare
  v_couple uuid;
  v_partner uuid;
  v_state couple_state;
begin
  select couple_id into v_couple from couple_members where user_id = auth.uid();
  if v_couple is null then return null; end if;
  select user_id into v_partner from couple_members
    where couple_id = v_couple and user_id <> auth.uid();
  select * into v_state from couple_state where couple_id = v_couple;
  return json_build_object(
    'gate_open', coalesce(v_state.gate_open, false),
    'readiness', v_state.readiness,
    'partner_joined', v_partner is not null,
    'my_diary',         (select count(*) from diary_entries where couple_id = v_couple and user_id = auth.uid()),
    'partner_diary',    (select count(*) from diary_entries where couple_id = v_couple and user_id = v_partner),
    'my_conflicts',     (select count(*) from conflicts     where couple_id = v_couple and user_id = auth.uid()),
    'partner_conflicts',(select count(*) from conflicts     where couple_id = v_couple and user_id = v_partner),
    'my_assessment',      coalesce((select completed from assessments where couple_id = v_couple and user_id = auth.uid()), false),
    'partner_assessment', coalesce((select completed from assessments where couple_id = v_couple and user_id = v_partner), false)
  );
end $$;

-- ============================================================
-- UPDATE 2: Beziehungsbild (dreiteiliger Bericht mit doppelter Freigabe)
-- Nur diesen Block im SQL Editor ausfuehren.
-- ============================================================

alter table couple_members add column if not exists report_consent boolean not null default false;

drop policy if exists "members: eigene Zeile aendern" on couple_members;
create policy "members: eigene Zeile aendern" on couple_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table reports enable row level security;

drop policy if exists "reports: Mitglieder lesen" on reports;
create policy "reports: Mitglieder lesen" on reports
  for select using (is_member(couple_id));

-- ============================================================
-- UPDATE 3: Dein Spiegel (individuelles Feedback, nur fuer die eigene Person)
-- Nur diesen Block im SQL Editor ausfuehren.
-- ============================================================

create table if not exists mirrors (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table mirrors enable row level security;

drop policy if exists "mirrors: nur eigene lesen" on mirrors;
create policy "mirrors: nur eigene lesen" on mirrors
  for select using (user_id = auth.uid());

-- ============================================================
-- UPDATE 4: Substanz-Gate, optionaler Fragebogen, "Zwischenraum fragt"
-- Nur diesen Block im SQL Editor ausfuehren.
-- ============================================================

alter table assessments add column if not exists skipped boolean not null default false;

create table if not exists probes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  q text not null,
  a text,
  skipped boolean not null default false,
  created_at timestamptz not null default now()
);

alter table probes enable row level security;

drop policy if exists "probes: nur eigene lesen" on probes;
create policy "probes: nur eigene lesen" on probes
  for select using (user_id = auth.uid());

-- ============================================================
-- UPDATE 5: Tagebuch-Dialog (begrenzte Vertiefung) + Admin-Dashboard
-- Nur diesen Block im SQL Editor ausfuehren.
-- ============================================================

alter table diary_entries add column if not exists thread_closed boolean not null default false;

create table if not exists diary_replies (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references diary_entries(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','ai')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table diary_replies enable row level security;

drop policy if exists "diary_replies: nur eigene lesen" on diary_replies;
create policy "diary_replies: nur eigene lesen" on diary_replies
  for select using (user_id = auth.uid());

-- Admin: separates Konto, keinem Paar-Raum zugehoerig
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

drop policy if exists "admins: sich selbst erkennen" on admins;
create policy "admins: sich selbst erkennen" on admins
  for select using (user_id = auth.uid());

-- ─── DANACH MANUELL (einmalig): ───
-- 1. In der App ein separates Admin-Konto registrieren (z.B. admin+zr@gmx.net).
-- 2. Dann hier ausfuehren (E-Mail ersetzen):
-- insert into admins (user_id)
--   select id from auth.users where email = 'ADMIN@EMAIL.DE'
--   on conflict do nothing;
-- ============================================================
-- UPDATE 6: E-Mail-Benachrichtigungen, Einladungslink
-- Idempotent, rein additiv.
-- ============================================================

-- Benachrichtigungs-Einstellung je Person
alter table couple_members add column if not exists email_freq text not null default 'daily';
alter table couple_members drop constraint if exists couple_members_email_freq_check;
alter table couple_members add constraint couple_members_email_freq_check
  check (email_freq in ('none','daily','instant'));

-- Protokoll: verhindert Doppelversand und speist die Tageszusammenfassung
create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,               -- 'chat' | 'gate' | 'report' | 'mirror' | 'partner_joined'
  sent_instant boolean not null default false,
  included_in_daily boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists email_events_pending_idx
  on email_events (recipient_id, included_in_daily, created_at);

alter table email_events enable row level security;

drop policy if exists "email_events: nur eigene lesen" on email_events;
create policy "email_events: nur eigene lesen" on email_events
  for select using (recipient_id = auth.uid());

-- Eigene Zeile darf aktualisiert werden (Einstellung ändern)
drop policy if exists "members: eigene Zeile aendern" on couple_members;
create policy "members: eigene Zeile aendern" on couple_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Delta 2026-08-06: Hintergrundverarbeitung für Beziehungsbild
-- und Spiegel. Die Zeile entsteht sofort mit status 'running',
-- der Inhalt wird nachgetragen, sobald die KI fertig ist.
-- ─────────────────────────────────────────────────────────────

alter table reports add column if not exists status text not null default 'running';
alter table reports add column if not exists error_msg text;
alter table mirrors add column if not exists status text not null default 'running';
alter table mirrors add column if not exists error_msg text;

-- Der Inhalt ist beim Anlegen noch leer und wird später gefüllt.
alter table reports alter column content drop not null;
alter table mirrors alter column content drop not null;

-- Aufräumen: Läufe, die von der Laufzeitumgebung abgeräumt wurden, bleiben
-- ohne Zutun für immer auf 'running' — die Oberfläche wartet dann endlos.
-- Die Edge Function erledigt das ab Version 2026-08-06c beim nächsten Anlauf
-- selbst; dieses Skript räumt einmalig die Altlasten weg.
update reports set status = 'error',
       error_msg = 'Der Lauf wurde von der Laufzeitumgebung abgebrochen (Zeitlimit ueberschritten).'
 where status = 'running' and coalesce(content, '') = ''
   and created_at < now() - interval '15 minutes';

update mirrors set status = 'error',
       error_msg = 'Der Lauf wurde von der Laufzeitumgebung abgebrochen (Zeitlimit ueberschritten).'
 where status = 'running' and coalesce(content, '') = ''
   and created_at < now() - interval '15 minutes';

-- ─────────────────────────────────────────────────────────────
-- Delta 2026-08-06d: Beziehungsbild/Spiegel ueber OpenAIs
-- Responses-API mit background:true statt synchroner Chat-
-- Completion in EdgeRuntime.waitUntil. Grund: die Supabase-
-- Laufzeit hat Hintergrund-Taks beobachtbar mitten im Lauf
-- abgeraeumt (ohne dass der eigene catch-Zweig noch griff),
-- weil die Denkzeit tiefer Analysen die Lebensdauer der Edge
-- Function ueberschritten hat. Jetzt startet die Funktion den
-- Modell-Lauf nur noch und kehrt sofort zurueck; ein separater
-- Poll-Aufruf (vom Frontend alle 5s) fragt den Fortschritt ab
-- und stoesst die naechste Stufe an. Keine Denktiefe wird mehr
-- beschnitten, weil kein Funktionsaufruf mehr laenger als ein
-- paar Sekunden laufen muss.
-- ─────────────────────────────────────────────────────────────

alter table reports add column if not exists stage text not null default 'notizen';
alter table reports add column if not exists openai_response_id text;
alter table reports add column if not exists notizen text;
alter table reports add column if not exists requested_by uuid references auth.users(id) on delete set null;

alter table mirrors add column if not exists stage text not null default 'notizen';
alter table mirrors add column if not exists openai_response_id text;
alter table mirrors add column if not exists notizen text;

-- ─────────────────────────────────────────────────────────────
-- Delta 2026-08-07: Verankerte Gespraeche zu Beziehungsbild und
-- Spiegel (KONZEPT.md Abschnitt 7.1). Beide Gespraechstypen in
-- einer Tabelle, weil beide privat und personenbezogen sind und
-- deshalb dieselbe RLS-Regel gilt. Bewusst keine insert-Policy:
-- nur die Edge Function (Service Role) schreibt, der Client liest.
-- ─────────────────────────────────────────────────────────────

create table if not exists doc_chats (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('report', 'mirror')),
  doc_id uuid not null,
  sender text not null check (sender in ('user', 'ai')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists doc_chats_doc_idx on doc_chats (doc_id, created_at);

alter table doc_chats enable row level security;

drop policy if exists "doc_chats: nur eigene lesen" on doc_chats;
create policy "doc_chats: nur eigene lesen" on doc_chats
  for select using (user_id = auth.uid());

-- Herkunft einer KI-Eroeffnung im gemeinsamen Raum sichtbar machen
-- (Uebergangsmoment 3 in KONZEPT.md). NULL = normale Moderation.
alter table chat_messages add column if not exists origin text;

-- ─────────────────────────────────────────────────────────────
-- Delta 2026-08-07b: Wiedereinstiegs-Schutz fuer "Dein Raum"
-- (CLAUDE.md Backlog Punkt 6). Ein echter Geraete-PIN-Schutz,
-- kein Beruhigungs-UI: der PIN-Hash verlaesst die Edge Function
-- NIE -- auch nicht als Select fuer den eigenen Client. Grund:
-- couple_members ist per RLS couple-weit lesbar (is_member), ein
-- Hash dort waere fuer die Partnerin/den Partner direkt lesbar
-- und bei einem 4-6-stelligen PIN offline leicht zu brechen.
-- Deshalb eine eigene Tabelle OHNE jede Client-Policy -- weder
-- select noch insert. Nur die Edge Function (Service Role) greift
-- zu, Pruefung und Verwaltung laufen ausschliesslich ueber sie.
-- ─────────────────────────────────────────────────────────────

create table if not exists device_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null,
  updated_at timestamptz not null default now()
);

alter table device_locks enable row level security;
-- Bewusst keine Policies. RLS ist damit "deny all" fuer jeden Client.

-- Rueckstetzung eines vergessenen PIN per Mail: Token-Hash + Ablauf,
-- gepflegt ausschliesslich von der Edge Function (siehe lock_reset_request/
-- lock_reset_confirm). Kein eigenes Feld fuer "angefordert am" noetig, der
-- Ablaufzeitpunkt reicht als Signal.
alter table device_locks add column if not exists reset_token_hash text;
alter table device_locks add column if not exists reset_expires timestamptz;

-- ─────────────────────────────────────────────────────────────
-- Delta 2026-08-07c: reports.notizen / mirrors.notizen vor
-- Client-Zugriff schuetzen.
--
-- Befund: Die Policy "reports: Mitglieder lesen" gilt fuer die
-- GANZE Zeile (is_member(couple_id)), und Supabase erteilt per
-- Default ein tabellenweites Leserecht. Damit konnte die
-- Partnerin/der Partner die internen Analysenotizen abrufen
-- (supabase.from("reports").select("notizen")) -- also genau den
-- Text, dessen Prompt ausdruecklich sagt "niemand ausser dir liest
-- sie" und der KEINE Zitierverbots-Regeln hat, anders als der
-- fertige Bericht. Ein direkter Bruch der Rohtext-Trennung.
-- Dass Report.jsx die Spalte nicht abfragt, war reiner Zufall,
-- kein Schutz.
--
-- WICHTIG: Ein spaltenweises "revoke select (notizen)" ist hier
-- WIRKUNGSLOS -- Postgres wendet das nur an, wenn das Recht auch
-- spaltenweise erteilt wurde. Bei einem tabellenweiten Grant muss
-- man das Tabellenrecht entziehen und die erlaubten Spalten
-- einzeln neu gewaehren. Die Listen unten sind bewusst
-- vollstaendig (alles ausser notizen) -- beim Hinzufuegen einer
-- neuen Spalte muss sie hier ergaenzt werden, sonst ist sie fuer
-- Clients unsichtbar.
--
-- RLS bleibt davon unberuehrt und filtert die Zeilen wie bisher.
-- Die Edge Function (Service Role) hat weiterhin vollen Zugriff.
-- ─────────────────────────────────────────────────────────────

revoke select on public.reports from authenticated, anon;
grant select (id, couple_id, content, created_at, status, error_msg,
              stage, openai_response_id, requested_by)
  on public.reports to authenticated, anon;

revoke select on public.mirrors from authenticated, anon;
grant select (id, couple_id, user_id, content, created_at, status,
              error_msg, stage, openai_response_id)
  on public.mirrors to authenticated, anon;
