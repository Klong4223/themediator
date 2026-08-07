# Zwischenraum — UX-Konzept

Stand 07.08.2026. Beschreibt den durchgängigen Nutzerweg von „eine Person
allein" bis „gemeinsames Gespräch über das Beziehungsbild" — inklusive
Startseite und Einladungsansicht.

**Abschnitte 1–4** beschreiben das Konzept, **Abschnitt 6** die getroffenen
Entscheidungen samt Begründung, **Abschnitt 7** die technische Umsetzung
(Schema, Aktionen, Prompts, Abnahmekriterien). Das Dokument ist so
geschrieben, dass es allein ausreicht — ohne den Gesprächsverlauf, aus dem
es entstanden ist.

Was heute schon im Code existiert, ist jeweils vermerkt; ebenso die Stellen,
an denen Konzept und Code auseinanderlaufen.

---

## 1. Das mentale Modell: drei Räume

Die stärkste Leistung der Oberfläche ist ein Bild, das man einmal versteht
und das danach alles erklärt. Zwischenraum besteht aus drei Räumen, und jede
Funktion gehört sichtbar zu genau einem davon:

| Raum | Was darin liegt | Wer sieht es |
|---|---|---|
| **Dein Raum** | Tagebuch, Konflikte, Fragebogen, Profil, **dein Spiegel**, deine Gespräche mit Zwischenraum | nur du |
| **Der Zwischenraum** | das Beziehungsbild, die Zeitleiste, der nächste Schritt | beide — aber nur als neu formulierter Text, nie als Rohtext |
| **Euer Raum** | der moderierte gemeinsame Chat | beide, alles offen |

Jede Karte, jeder Chat, jede Benachrichtigung trägt eine dezente
Raum-Markierung (Farbe/Icon). Damit beantwortet sich die wichtigste
Nutzerfrage — *„Wer sieht das?"* — dauerhaft von selbst, ohne Erklärtext.

Der mittlere Raum trägt den Namen der App. Das darf die Oberfläche
aussprechen: *„Hier entsteht, was keiner von euch allein sehen kann."*

### Navigation

| Heute | Vorschlag |
|---|---|
| Über dich · Tagebuch · Themen & Konflikte · Gemeinsam · Beziehungsbild | **Dein Raum** · **Zwischenraum** · **Euer Raum** |

Drei Räume statt fünf Tabs — die Struktur *ist* dann das
Vertraulichkeitsversprechen. Zwei Verschiebungen fallen dabei an:

- Der **Spiegel wandert zu „Dein Raum"**. Er ist privates Feedback und
  gehört neben Profil und Chronik, nicht neben das Beziehungsbild.
- Der **Zwischenraum-Tab gehört allein dem Beziehungsbild**. Ein Tab = ein
  Konzept = ein Raum.

---

## 2. Die Reise in fünf Stufen

### Stufe 0 — Eine Person allein

Der heikelste Zustand: Der Wert entsteht erst zu zweit, aber die erste
Person muss allein schon einen Grund haben zu bleiben — sonst kommt die
zweite nie.

- **„Dein Raum" funktioniert sofort und vollständig:** Tagebuch mit
  KI-Antworten, Konflikte, Fragebogen, „Zwischenraum fragt". Die App ist
  allein schon ein reflektierendes Tagebuch mit Gegenüber.
- **Die anderen Räume sind sichtbar, aber verschlossen** — nicht versteckt.
  Eine ruhige Karte: *„Der Zwischenraum öffnet sich, wenn ihr beide da
  seid."* Sichtbare verschlossene Türen erzeugen Sog; unsichtbare Features
  erzeugen nichts.
- **„Der nächste Schritt" beginnt hier**, nicht erst zu zweit. Statt eines
  Füllstands eine einzige Karte, die den nächsten noch nicht erreichten
  Meilenstein benennt — und **warum** er es noch nicht ist: *„Der
  Zwischenraum öffnet sich, sobald Kathrin beigetreten ist. Ihr
  Einladungscode: ABC123."* Konkret und handlungsleitend statt einer Zahl,
  die man interpretieren muss.

### Stufe 1 — Beide da, getrennt

- Der Beitritt ist ein Moment, kein Statuswechsel: *„Markus ist da. Ihr
  schreibt weiterhin getrennt und vertraulich — Zwischenraum lernt euch
  jetzt beide kennen."*
- **„Der nächste Schritt" wird zweiseitig — aber ohne Vergleich.** Die Karte
  benennt weiterhin nur den nächsten Meilenstein und seinen Grund, jetzt mit
  Bezug auf beide: *„Für ein Beziehungsbild müsst ihr beide freigeben. Du
  hast freigegeben — Kathrins Freigabe steht noch aus."*
- **Kein Füllstand der anderen Person, in keiner Form.** Weder Zahl noch
  Stufe noch Balken. Bei einem Paar in der Krise würde ein sichtbarer
  Rückstand mit hoher Wahrscheinlichkeit zum Vorwurf — das Produkt darf
  keine Munition liefern. Zulässig sind nur *tatsächliche Zustände*
  (beigetreten, freigegeben), nie Fleiß-Maße.

> #### Übergangsmoment 1 — Die Freischaltung darf nicht mehr behaupten, als geprüft wird
>
> Eine Checkliste der Art „sobald ihr beide **genug geteilt** habt und beide
> freigebt" klingt nach inhaltlicher Substanzprüfung. Die gibt es für das
> Beziehungsbild heute aber nicht: `report` und `mirror` prüfen ausschließlich
> die beiden Freigabe-Häkchen
> ([index.ts:602](supabase/functions/ai/index.ts:602) und
> [:713](supabase/functions/ai/index.ts:713)). Ein Paar könnte nach je einem
> Satz ein Beziehungsbild anfordern und bekäme etwas erkennbar Dünnes —
> obwohl die Oberfläche vorher „ihr seid bereit" suggeriert hätte.
>
> Der Baustein existiert bereits, nur an anderer Stelle: Die `gate`-Aktion
> prüft Substanz über eine Heuristik (je Person mindestens ein Eintrag und
> 1200 Zeichen) kombiniert mit einem KI-Urteil
> ([index.ts:550](supabase/functions/ai/index.ts:550)).
>
> **Entschieden (07.08.2026): warnen statt blockieren.** Kein Gate — aber bei
> dünnem Material ein ehrlicher Hinweis direkt vor dem Klick:
> *„Ihr habt bisher wenig geteilt — das Bild wird entsprechend vorsichtig
> ausfallen. Trotzdem erstellen?"*
>
> Begründung: Beim gemeinsamen Chat ist zu wenig Wissen *gefährlich* (die KI
> moderiert dann blind) — beim Beziehungsbild ist es nur *enttäuschend*. Ein
> Gate würde den ersten Erfolgsmoment blockieren, den ein neues Paar
> dringend braucht. Die doppelte Freigabe ist bereits eine bewusste Hürde.

### Stufe 2 — Spiegel und Beziehungsbild

- Die **doppelte Freigabe** wird als das inszeniert, was sie ist: ein
  bewusster gemeinsamer Schritt, fast ein kleines Ritual. Beide Häkchen
  sichtbar — *„Du hast freigegeben · Kathrin hat freigegeben"* — dann erst
  öffnet sich der Erstellen-Knopf.
- **Wartezeit ehrlich gestalten:** Phasenanzeige *„Zwischenraum liest euch
  beide … vergleicht eure Perspektiven … schreibt euer Bild."* Das bildet
  die echten Stufen ab, die seit der Umstellung auf die asynchrone
  Verarbeitung technisch wirklich existieren (`stage`: `notizen` →
  `bericht`). Dazu die ehrliche Erwartung: *„Das kann 10–20 Minuten dauern,
  weil Zwischenraum gründlich nachdenkt. Du bekommst eine Nachricht."*
  Gründlichkeit als Qualitätsmerkmal zeigen, nicht als Ladebalken
  verstecken.

### Stufe 3 — Mit den Ergebnissen sprechen (individuell)

Der Kern: **Der Chat ist keine neue Funktion, sondern die natürliche
Fortsetzung des Lesens.**

- Unter jedem Spiegel und jedem Beziehungsbild steht ein Eingabefeld,
  beschriftet nicht mit „Chat", sondern als Einladung: *„Was löst das in dir
  aus?"* Man antwortet auf einen Text, der einen gerade bewegt hat — der
  intuitivste Gesprächseinstieg, den es gibt.
- **Jedes Gespräch ist am Dokument verankert** — ein Faden pro Spiegel bzw.
  Bericht, aufklappbar direkt darunter. Das Muster existiert mit den
  Tagebuch-Dialogfäden (`diary_replies`) bereits. Kein freischwebender
  Chatbot-Tab. Dadurch bleibt immer klar, *worüber* gesprochen wird, und
  alte Berichte behalten ihre Gespräche als Verlauf.
- **Raumzugehörigkeit explizit machen:** Auch das Gespräch über das
  *gemeinsame* Beziehungsbild ist ein **privates** Gespräch. Das ist die
  eine Stelle, an der Intuition allein nicht reicht — hier muss es
  dastehen: *„Dieses Gespräch ist nur deins. Kathrin sieht weder deine
  Fragen noch die Antworten."*
- **Die Grenze als Charakter, nicht als Fehlermeldung.** Im Dialog wird
  „Was hat sie denn wirklich geschrieben?" kommen — garantiert, und viel
  häufiger als bei einem statischen Bericht. Die Antwort darf nie technisch
  klingen, sondern gehört zur Haltung der Figur: *„Was Kathrin mir
  anvertraut, gehört ihr — genau wie das, was du mir schreibst, dir gehört.
  Aber lass uns anschauen, was ihre Sicht in dir auslöst."* Immer ablehnen
  **plus** umlenken. Gehört als eigene Regel in den Chat-Prompt.

> #### Übergangsmoment 2 — Der Chat-Einstieg darf nicht wie ein Kommentarfeld aussehen
>
> Ein Eingabefeld unter dem Bericht hält man ohne weitere Signale für ein
> einmaliges Notizfeld, nicht für den Beginn eines Dialogs. Die Überraschung
> „oh, es antwortet mir ja" ist dann nett, aber zufällig — nicht intuitiv.
>
> **Fix:** Der Gesprächscharakter muss sichtbar sein, *bevor* die erste
> Nachricht abgeschickt ist. Entweder ein Chat-Rahmen von Anfang an
> (Sprechblasen-Anmutung statt Formularfeld), oder eine Zeile
> Platzhaltertext, die es ausspricht: *„Schreib, was dir dazu durch den Kopf
> geht — Zwischenraum antwortet."*

### Stufe 4 — Gemeinsam darüber sprechen

- **Die Nutzerin initiiert, nicht die KI.** Unter dem privaten Gespräch
  liegt ein Knopf: *„Das gehört in unseren Raum."* Damit ist die Zustimmung
  per Design gegeben, und es braucht keine Bewertung in jeder einzelnen
  Chat-Antwort (weniger Prompt-Komplexität, keine Vorschläge zur Unzeit).
- **Was hinübergeht, ist nie der Rohtext.** Der Knopf löst einen eigenen
  Modellaufruf aus, der aus dem Gesprächsverlauf **eine neutral formulierte
  Eröffnung** erzeugt — oder wahlweise nur eine Themenüberschrift. Was die
  Person selbst geschrieben hat, verlässt ihren Raum nie im Original. Damit
  gilt Regel 1 auch an dieser neuen Stelle unverändert.
- Nach einem neuen Beziehungsbild eröffnet die KI im gemeinsamen Raum
  ohnehin von sich aus mit einem Gesprächsangebot dazu.

> #### Übergangsmoment 3 — Die Brücke ins Gemeinsame braucht sichtbare Herkunft
>
> Der kritischste Punkt des ganzen Konzepts. Stimmt eine Person zu, taucht im
> gemeinsamen Chat plötzlich eine Eröffnung auf. **Aus Sicht der Partnerin,
> die diesen Moment nicht miterlebt hat, kommt das aus dem Nichts** — sie hat
> dem Beziehungsbild zugestimmt, nicht diesem konkreten Gesprächsanstoß. Das
> untergräbt genau das Vertrauen, das der Rest des Produkts aufbaut.
>
> **Fix:** Jede getragene Eröffnung macht ihre Herkunft strukturell sichtbar
> — nicht nur inhaltlich neutral formuliert (das ist ohnehin Regel), sondern
> gekennzeichnet: *„Diese Eröffnung ist aus einem Gespräch über euer
> Beziehungsbild entstanden."* Ohne diesen Satz ist der Übergang nicht
> intuitiv, sondern mysteriös.

### Der Kreis schließt sich — ein neues Beziehungsbild

- Eine dezente **Zeitleiste** im Zwischenraum-Tab: *Bild vom 6. August ·
  Bild vom 20. September*. Die Berichte werden von Momentaufnahmen zu einer
  gemeinsamen Geschichte — und genau daraus entsteht der Grund, weiter zu
  schreiben: damit das nächste Bild tiefer wird.
- Der Kreislauf: Schreiben macht das Bild tragfähig → das Bild eröffnet die
  Gespräche → die Gespräche bringen Neues zutage → das motiviert zum
  Schreiben. Zurück zu Stufe 0.

> #### Übergangsmoment 4 — Der Anstoß braucht einen sichtbaren Auslöser
>
> „Wenn erkennbar Bewegung ist, schlägt Zwischenraum ein neues Bild vor" ist
> als Konzept klar, für eine Nutzerin aber unsichtbar begründet. Ohne
> sichtbares Kriterium wirkt der Vorschlag beliebig getimt — *„warum fragt es
> mich ausgerechnet heute?"*
>
> **Fix:** An die Zeitleiste koppeln, nicht an ein Gefühl der KI. Eine
> Markierung an der Zeitleiste selbst — *„Seit eurem letzten Bild: 8 neue
> Einträge"* — und der Vorschlag im Chat verweist genau darauf. Dann ist der
> Auslöser nachvollziehbar statt orakelhaft.

---

## 3. Die Startseite

Zwei strategische Lücken der heutigen [Landing.jsx](src/Landing.jsx) — die
Struktur (Problem, Schritte, Vertraulichkeit, Features) ist solide, aber:

### Lücke 1: Die Seite spricht zu „euch" — es liest sie eine Person, allein

Wer die Seite findet, ist fast nie ein Paar am gemeinsamen Bildschirm,
sondern **eine Person, nachts am Handy, nach einem Streit.** Ihre größte
Hürde ist nicht „verstehe ich das Produkt?", sondern: *„Was, wenn ich
anfange und mein Partner nie mitmacht?"* Heute beantwortet die Seite das
nirgends — genau dort verliert man Leute.

Das Stufenkonzept liefert die Antwort gratis:

> **„Du musst nicht auf deinen Partner warten."**
> Fang allein an — schreib, ordne, versteh dich selbst besser. Zwischenraum
> ist schon allein mit dir wertvoll. Und wenn deine Partnerin oder dein
> Partner bereit ist, ist der Raum schon da.

Aus „wir müssten uns beide committen" wird „ich probier das mal für mich" —
eine viel kleinere Schwelle, und der reale Funnel läuft ohnehin so.

### Lücke 2: Die Seite behauptet, statt zu zeigen

Alles ist beschrieben, nichts erlebbar. Bei einem Produkt, dessen Wert im
**Ton** liegt, ist das die größte verschenkte Chance. Niemand kauft „KI hört
beiden zu" — aber viele bleiben an einem echten Austausch hängen.

Deshalb eine Sektion **„So fühlt es sich an"** mit einem fiktiven, klar als
Beispiel markierten Mini-Dialog:

> *Eintrag (Beispiel):* „Er sagt, ich mache aus allem ein Drama. Vielleicht
> stimmt das ja. Aber wenn ich nichts sage, ändert sich nie was."
>
> *Zwischenraum:* „Da steckt ein echtes Dilemma drin: Wenn du es ansprichst,
> giltst du als anstrengend — wenn nicht, bleibst du allein damit. Was wäre
> das Kleinste, das sich ändern müsste, damit sich das Ansprechen gelohnt
> hätte?"

Dazu ein zweites Beispiel: **drei, vier Zeilen aus einem fiktiven
Beziehungsbild**, denn diesen Moment gibt es sonst nirgends.

**Beide Beispiele müssen erfunden und als solche beschriftet sein** — gerade
weil Vertraulichkeit das Produkt ist, dürfen es nie echte sein.

### Überarbeitete Dramaturgie

1. **Hero** — bleibt fast wie er ist, die Zeile trägt. Ergänzen: „Allein
   anfangen ist okay."
2. **Problem** — bleibt (der Therapie-Vergleich mit Preisen ist mutig und
   ehrlich).
3. **„So fühlt es sich an"** — NEU, das erlebbare Beispiel. Wichtigste neue
   Sektion.
4. **Die drei Räume** — statt der abstrakten drei Schritte. Damit erklärt
   die Startseite dieselbe Struktur, die man in der App wiederfindet;
   Versprechen und Produkt sind dasselbe Bild.
5. **Das Beziehungsbild als Höhepunkt** — eigene Sektion mit dem fiktiven
   Auszug. Der „das gibt es nirgendwo sonst"-Moment.
6. **„Du musst nicht warten"** — die Solo-Start-Erlaubnis, direkt vor dem
   Abschluss.
7. **Vertrauen kompakt** — ein Block statt verstreuter Hinweise: getrennte
   Konten, technisch erzwungen, EU-Server, kein Training mit euren Daten,
   keine Werbung, E-Mails ohne Inhalte, Löschung jederzeit. Sieben kurze
   Zeilen, in fünf Sekunden überfliegbar.
8. **Ehrlichkeit + Abschluss** — bleibt; „Der erste Schritt ist ein Satz"
   ist stark.

---

## 4. Die vergessene zweite Startseite

Der eigentlich kritischste Moment ist nicht die Startseite, sondern der
Augenblick, in dem **die eingeladene Person den Link öffnet.** Diese Person
hat nicht gesucht, ist womöglich skeptisch („mein Partner will mich in eine
Paar-App zerren") und landet heute vermutlich direkt auf
Login/Registrierung. Sie braucht ihre eigene Ansprache:

> **„Kathrin hat einen Raum für euch beide eingerichtet."**
>
> Bevor du dich entscheidest, das Wichtigste: Was du hier schreibst, liest
> Kathrin nie. Du bekommst denselben geschützten, privaten Raum wie sie.
> Zwischenraum ergreift keine Partei — auch nicht ihre. Schau es dir an, du
> kannst jederzeit wieder gehen.

Drei Sätze gegen die drei Ängste der eingeladenen Person: **Überwachung,
Parteinahme, Verpflichtung.** Diese kleine Seite ist vermutlich mehr wert
als jede Optimierung der Hauptseite — ohne die zweite Person gibt es das
Produkt nicht.

---

## 5. Was das Bauen betrifft

Das meiste ist Rekombination von Vorhandenem:

| Baustein | Status |
|---|---|
| Chat-Muster für verankerte Fäden | existiert (`diary_replies`) |
| Gemeinsamer moderierter Raum | existiert (`SharedChat.jsx`, `gate`) |
| Doppelte Freigabe | existiert |
| Phasenanzeige (Notizen → Bericht) | Daten existieren (`stage`), Anzeige fehlt |
| Substanzheuristik | existiert für `gate`, nicht für `report`/`mirror` |
| Begründung in Prosa, warum etwas verschlossen ist | existiert (`gate` → `couple_state.readiness`) |

**Wirklich neu wären:**

1. Zwei verankerte Chat-Threads (je Spiegel/Bericht) mit eigener
   Kontext-Zusammenstellung und der verschärften Sperrregel im Prompt
2. Der „In euren Raum tragen"-Mechanismus mit Zustimmung und sichtbarer
   Herkunftskennzeichnung
3. „Der nächste Schritt" und die Zeitleiste
4. Umsortierung der Navigation auf drei Räume
5. Startseiten-Überarbeitung und Einladungsansicht

**Reihenfolge-Empfehlung:** Einladungsansicht zuerst (kleinster Aufwand,
größter Hebel), dann Startseite, dann die Chat-Threads, zuletzt Navigation
und „Der nächste Schritt".

---

## 6. Getroffene Entscheidungen (07.08.2026)

**1. Substanzprüfung: warnen statt blockieren.** Kein Gate fürs
Beziehungsbild, aber ein ehrlicher Hinweis vor dem Klick, wenn wenig
Material vorliegt. Begründung siehe Übergangsmoment 1.

**2. Kein Barometer — stattdessen „Der nächste Schritt".** Ein Füllstand
wirft mehr Fragen auf, als er beantwortet („was heißt *gut*? was fehlt mir
zu *tief*?") und lädt dazu ein, Menge mit Tiefe zu verwechseln. An seine
Stelle tritt eine einzelne Karte, die immer **den nächsten noch nicht
erreichten Meilenstein** benennt — und im Klartext, **warum** er noch nicht
erreicht ist.

Das Muster existiert bereits: Die `gate`-Aktion erzeugt schon heute eine
Begründung in Prosa und legt sie in `couple_state.readiness` ab, wenn der
gemeinsame Chat noch verschlossen ist. Es wird also nichts erfunden, sondern
ein vorhandenes Prinzip auf alle Meilensteine ausgeweitet.

Die Meilensteine in der Reihenfolge, in der man sie erlebt:

| Meilenstein | Bedingung | Begründung bei Nichterreichen |
|---|---|---|
| Der Zwischenraum öffnet sich | Partner beigetreten | Einladungscode direkt mit anzeigen |
| Beziehungsbild möglich | beide freigegeben | welche der beiden Freigaben fehlt |
| Beziehungsbild wird tragfähig | genug Material auf beiden Seiten | Hinweis, kein Riegel (Entscheidung 1) |
| Euer Raum öffnet sich | `gate_open` | die vorhandene `readiness`-Begründung |

**3. Keine Fleiß-Maße über die andere Person.** Sichtbar sind ausschließlich
*tatsächliche Zustände* — beigetreten, freigegeben —, niemals wie viel
jemand geschrieben hat. Begründung siehe Stufe 1.

**4. Brücke in den gemeinsamen Raum: nutzerinitiiert, KI-formuliert.** Ein
Knopf unter dem privaten Gespräch; hinüber geht nie der Rohtext, sondern
eine neu formulierte, moderierte Eröffnung (oder wahlweise nur eine
Themenüberschrift).

**5. Datenmodell: eine gemeinsame Tabelle** für beide Gesprächstypen. Beide
sind privat und personenbezogen, also greift dieselbe RLS-Regel — eine
Policy statt zwei heißt eine Stelle, an der man sie falsch schreiben kann.

**6. Gespräche zu alten Berichten:** dauerhaft lesbar, aber nur der jüngste
Bericht nimmt neue Nachrichten an. Sonst wird unklar, auf welchen Stand sich
ein Gespräch bezieht.

---

## 7. Technische Spezifikation

Reihenfolge beim Ausliefern immer: **SQL → Edge Function → Frontend.**

### 7.1 Schema-Delta

Idempotent und additiv, wie in `CLAUDE.md` gefordert. Gehört zusätzlich ans
Ende von `supabase/schema.sql`.

```sql
-- Verankerte Gespraeche zu Beziehungsbild und Spiegel.
-- Beide Typen in einer Tabelle: beide sind privat und personenbezogen,
-- also gilt dieselbe RLS-Regel.
create table if not exists doc_chats (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('report', 'mirror')),
  doc_id uuid not null,            -- reports.id bzw. mirrors.id
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
-- (Uebergangsmoment 3). NULL = normale Moderation.
alter table chat_messages add column if not exists origin text;
```

**Bewusst keine `insert`-Policy:** Nachrichten schreibt ausschließlich die
Edge Function mit Service Role. Der Client liest nur.

### 7.2 Neue Aktionen der Edge Function

| Aktion | Eingabe | Rückgabe | Zweck |
|---|---|---|---|
| `doc_chat` | `kind`, `doc_id`, `message` | `{ ok, antwort }` | Nachricht im verankerten Gespräch, KI antwortet |
| `doc_chat_share` | `kind`, `doc_id`, `modus` | `{ ok, eroeffnung }` | Thema moderiert in den gemeinsamen Raum tragen |
| `meilensteine` | — | siehe unten | Zustände + Begründungen, RLS-sicher |

#### `doc_chat`

1. Zeile aus `reports`/`mirrors` laden, Zugehörigkeit prüfen
   (`couple_id` des Mitglieds; bei `mirror` zusätzlich `user_id = user.id`).
2. Ablehnen, wenn `status !== 'done'` oder das Dokument nicht das jüngste
   seiner Art ist (Entscheidung 6).
3. Nutzernachricht in `doc_chats` schreiben (`sender = 'user'`).
4. Kontext zusammenstellen — **das ist die Vertraulichkeitsentscheidung:**

   | Was | `kind = 'mirror'` | `kind = 'report'` |
   |---|---|---|
   | Dokumenttext | ja | ja |
   | Bisheriger Gesprächsverlauf | ja | ja |
   | Eigenes Material (`materialFuer`) | ja | ja |
   | Material der anderen Person | **nein** | **nein** |
   | Profil der anderen Person | nein | nein |

   Beide Dokumente sind bereits abstrahiert erzeugt worden. Für das Gespräch
   darüber braucht es kein zusätzliches Partner-Material — und jedes, das man
   hineingäbe, wäre eine neue Leckage-Quelle. Deshalb: gar keins.
5. Modellaufruf (synchron, kurze Antwort — `claude()` genügt, kein
   Hintergrundlauf nötig).
6. Antwort als `sender = 'ai'` speichern und zurückgeben.

#### `doc_chat_share`

Erzeugt aus dem Gesprächsverlauf eine **neu formulierte** Eröffnung.
`modus` ist `'thema'` (nur eine Überschrift) oder `'eroeffnung'` (kurzer
moderierter Text). Ergebnis geht als `chat_messages`-Zeile mit
`sender_id = NULL` und `origin = 'doc_chat:report'` bzw. `'doc_chat:mirror'`
in den gemeinsamen Raum. Anschließend `benachrichtigeBeiFreigabe(..., 'chat')`
für die andere Person.

**Nicht verhandelbar:** Der Rohtext der Nutzerin wird nie kopiert.

#### `meilensteine`

Braucht die Edge Function, weil ein Client den Zustand der anderen Person
per RLS gar nicht lesen kann.

```
naechster        'partner_fehlt' | 'freigabe_fehlt' | 'bereit' | null
grund            string   – ein Satz im Klartext, direkt anzeigbar
partner_da       boolean
freigabe_ich     boolean
freigabe_partner boolean
bild_duenn       boolean  – nur fuer die Warnung (Entscheidung 1)
chat_offen       boolean
chat_grund       string   – aus couple_state.readiness
```

`grund` wird serverseitig formuliert und im Frontend nur ausgegeben — so
steht der Wortlaut an einer Stelle und kann nicht zwischen Oberflächen
auseinanderlaufen.

**`bild_duenn` ist die einzige mengenbasierte Größe im ganzen System** und
verlässt die Funktion nur als `true`/`false`, nie als Zahl. Sie speist
ausschließlich den Warnhinweis vor dem Erstellen — daraus wird bewusst keine
Fortschrittsanzeige. Schwelle als Konstante am Dateikopf; Startwert: je
Person mindestens 5 Chronik-Einträge. Chronik statt Zeichenzahl, weil sie
*Verstandenes* zählt statt *Geschriebenes* und deshalb kaum manipulierbar
ist: Wer viel schreibt, aber nichts Neues sagt, erzeugt keine neuen
Einträge.

### 7.3 Prompt-Bausteine

Wie alle Prompts in der Edge Function **ohne Umlaute** (ae/oe/ue), weil sie
in Template-Strings stehen.

**Sperrregel für `doc_chat`** — ergänzt `GRUNDREGELN`, ersetzt sie nicht:

```
GESPRAECHSREGEL: Du sprichst mit EINER Person ueber einen Text, den sie
gerade gelesen hat. Fragen wie "was hat sie denn wirklich geschrieben?"
werden kommen. Beantworte sie nie — aber weise sie auch nie technisch ab.
Lenke stattdessen auf das zurueck, was moeglich ist:
"Was mir die andere Person anvertraut, gehoert ihr — genau wie das, was du
mir schreibst, dir gehoert. Aber lass uns anschauen, was ihre Sicht in dir
ausloest."
Immer ablehnen PLUS umlenken. Du hast fuer dieses Gespraech ohnehin kein
Material der anderen Person vorliegen, nur den gemeinsamen Text.
```

**Prompt für `doc_chat_share`:**

```
AUFGABE: Aus dem folgenden privaten Gespraech soll ein Thema in den
gemeinsamen Raum getragen werden, den beide lesen. Formuliere daraus eine
neutrale Eroeffnung von 2-4 Saetzen, die das Thema benennt und zum Gespraech
einlaedt.

STRIKT: Keine woertlichen Uebernahmen aus dem Gespraech. Keine Zuschreibung,
wer was gesagt oder gefuehlt hat. Kein Vorwurf, keine Wertung, keine
Parteinahme. Die Eroeffnung muss sich fuer BEIDE wie eine Einladung lesen,
nicht wie die Position einer Seite.
```

### 7.4 Frontend

| Datei | Änderung |
|---|---|
| `src/App.jsx` | Tabs auf drei Räume; Weiche für `?code=` vor dem Login (existiert bereits als Leseroutine in Zeile 14) |
| `src/sections/DocChat.jsx` | **neu** — wiederverwendbarer Gesprächsfaden, unter Bericht und Spiegel eingebunden |
| `src/sections/NaechsterSchritt.jsx` | **neu** — die Meilenstein-Karte, gespeist aus der `meilensteine`-Aktion |
| `src/sections/Report.jsx` | Spiegel herauslösen; Phasenanzeige aus `stage`; Zeitleiste; Warnhinweis bei dünnem Material |
| `src/sections/AboutYou.jsx` | Spiegel samt Gespräch aufnehmen |
| `src/Landing.jsx` | Dramaturgie nach Abschnitt 3 |
| `src/Invite.jsx` | **neu** — Ansicht für eingeladene Personen nach Abschnitt 4 |

Kein Routing-Paket nötig: Die App liest den Einladungscode bereits über
`URLSearchParams` aus der URL.

### 7.5 Definition of Done je Baustein

**Einladungsansicht** — Ein Aufruf mit `?code=…` zeigt vor dem Login die
Ansprache an die eingeladene Person; ohne Code unverändertes Verhalten.
`npm run build` läuft durch.

**Startseite** — Alle acht Sektionen aus Abschnitt 3 vorhanden; beide
Beispiele sichtbar als erfunden gekennzeichnet.

**Verankerte Gespräche** — Nachricht unter Bericht und Spiegel möglich, KI
antwortet, Verlauf bleibt nach Neuladen erhalten. Ein zweiter Account sieht
die Gespräche des ersten nicht (RLS praktisch geprüft, nicht nur im UI).
Gespräche an älteren Berichten sind lesbar, aber schreibgeschützt.

**Brücke** — Knopf erzeugt eine Eröffnung im gemeinsamen Raum, die
erkennbar neu formuliert ist und die Herkunftskennzeichnung trägt. Der
Rohtext taucht nirgends auf.

**Der nächste Schritt** — In jedem Zustand (allein / Partner da / nichts
freigegeben / eine Freigabe / beide) nennt die Karte den richtigen nächsten
Meilenstein samt Grund im Klartext. Nirgends erscheint ein Maß dafür, wie
viel die andere Person geschrieben hat. Der Warnhinweis bei dünnem Material
erscheint und lässt sich bestätigen.

**Navigation** — Drei Tabs, jede bestehende Funktion wiederfindbar, keine
tote Route.

Für jeden Baustein zusätzlich: `npm run build` grün und die Edge Function
mit `tsc --noEmit` geprüft (esbuild findet keine Nutzung-vor-Deklaration —
das hat hier schon einmal einen Produktionsfehler verursacht).
