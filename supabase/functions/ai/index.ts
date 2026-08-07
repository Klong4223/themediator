// Zwischenraum — KI-Logik (Supabase Edge Function, Deno)
// Kapselt alle KI-Aufrufe serverseitig. API-Keys liegen nur hier, nie im Browser.
// Kern-Prinzipien, in jeden Prompt eingebaut:
//  - Epistemik: jede Schilderung ist PERSPEKTIVE, nie Faktum. Nur unabhängig
//    von beiden Berichtetes gilt als gesichertes Muster. Keine Parteinahme.
//  - Abstraktion: Cross-Partner-Hinweise nur aus verdichteten Profilen,
//    nie aus Rohtext. Keine Zitate, keine rückverfolgbaren Formulierungen.
//  - Offenheit: Beschönigungen und Diskrepanzen wohlwollend, aber klar benennen.
//  - Sicherheit: bei Gewalt/Gefährdung Neutralität verlassen, auf Hilfe verweisen.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Anbieter-Umschalter ─────────────────────────────────────
// "openai" oder "anthropic". Beim Wechsel: nur diese Zeile aendern
// und das passende Secret setzen (OPENAI_API_KEY bzw. ANTHROPIC_API_KEY).
const PROVIDER = "openai";
const OPENAI_MODEL = "gpt-5.6";              // Standard: bewusst das starke Modell (Qualitaet vor Kosten)
const OPENAI_MODEL_STRONG = "gpt-5.6";       // Tiefenanalyse (Beziehungsbild)
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_MODEL_STRONG = "claude-opus-4-8";

const GRUNDREGELN = `Du bist "Zwischenraum", eine neutrale, allparteiliche Begleitinstanz fuer Paare. Regeln, die immer gelten:
1. EPISTEMIK: Alles, was eine Person schreibt, ist ihre Perspektive, kein Faktum. Uebernimm nie die Deutung einer Seite als Wahrheit. Formuliere entsprechend ("du beschreibst", "aus deiner Sicht"). Nur was beide unabhaengig berichten, darfst du als gemeinsames Muster behandeln.
2. NEUTRALITAET: Keine Schuldzuweisung, keine Parteinahme, kein Vorurteil. Wenn du bei einer Person nachbohrst, tue es bei der anderen mit gleichem Massstab.
3. ABSTRAKTION — NUTZEN, ABER NICHT DURCHREICHEN: Wenn dir ein verdichtetes Verstaendnis der anderen Person vorliegt, NUTZE ES AKTIV UND SUBSTANZIELL. Genau daraus entsteht der Wert dieser Begleitung: Du bist der einzige Ort, an dem beide Perspektiven zusammenkommen. Sprich Beduerfnisse, Muster und Wirkungen der anderen Seite an, rege Perspektivwechsel an, benenne, wo zwei Menschen offenbar aneinander vorbeireden.
   Die Grenze ist NICHT das Thema, sondern die Quelle: Du zitierst nie, gibst nie konkrete Formulierungen oder erzaehlte Einzelereignisse wieder und offenbarst nichts, was die andere Person erkennbar nur im Vertrauen geschrieben hat (ihre Zweifel, Plaene, Geheimnisse, intime Details). Formuliere als Beobachtung oder offene Frage ("Wie glaubst du, kommt dein Rueckzug bei ihr an?"), nie als Bericht ueber die andere Person ("sie hat geschrieben, dass...").
4. GRENZEN: Du bist Beziehungsbegleitung, keine Therapie. Keine Diagnosen, keine tiefenpsychologischen Deutungen. Bleibe auf der Ebene von Verhalten, Beduerfnissen und Mustern.
5. SICHERHEIT: Bei Hinweisen auf koerperliche Gewalt, Missbrauch, Selbst- oder Fremdgefaehrdung verlaesst du die Neutralitaet, benennst das klar und fuersorglich und verweist auf professionelle Hilfe (in DE: Hilfetelefon Gewalt gegen Frauen 116 016, Telefonseelsorge 0800 111 0 111, Notruf 112).
6. SPRACHE: Antworte in der Sprache der Person (Deutsch oder Englisch), sprich sie mit "du" an. Kompakt und konkret, kein Therapeuten-Jargon.`;

// Zeitbudget fuer die kurzen, synchronen Modellaufrufe (probe/gate/chat/...).
// Beziehungsbild und Spiegel laufen NICHT mehr darueber — siehe
// starteHintergrundantwort/holeHintergrundantwort weiter unten: die
// Supabase-Laufzeit raeumt Hintergrund-Tasks nach rund 400 Sekunden hart ab,
// und am 06.08.2026 hat sich gezeigt, dass selbst ein eigenes AbortController-
// Limit das nicht zuverlaessig auffaengt (der Prozess wird mitten im Lauf
// abgeraeumt, ohne dass der catch-Zweig je zum Zug kommt). Fuer alles, was
// laenger als ein, zwei Modell-Antworten dauern kann, entkoppelt die
// Responses-API mit background:true die Denkzeit des Modells vollstaendig
// von der Lebensdauer der Edge Function.
const AUFRUF_FRIST_MS = 150_000;

async function claude(
  prompt: string, maxTokens = 2500, strong = false, fristMs = AUFRUF_FRIST_MS,
): Promise<string> {
  const abbruch = new AbortController();
  const wecker = setTimeout(() => abbruch.abort(), fristMs);
  try {
    return await modellAufruf(prompt, maxTokens, strong, abbruch.signal);
  } catch (e) {
    if (abbruch.signal.aborted) {
      throw new Error(
        `Das Modell hat innerhalb von ${Math.round(fristMs / 1000)} Sekunden nicht geantwortet. ` +
        `Der Vorgang wurde abgebrochen, damit er nicht stillschweigend haengen bleibt.`,
      );
    }
    throw e;
  } finally {
    clearTimeout(wecker);
  }
}

async function modellAufruf(
  prompt: string, maxTokens: number, strong: boolean, signal: AbortSignal,
): Promise<string> {
  if (PROVIDER === "openai") {
    if (!Deno.env.get("OPENAI_API_KEY")) {
      throw new Error("Secret OPENAI_API_KEY ist nicht gesetzt (Supabase > Edge Functions > Secrets).");
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}`,
      },
      body: JSON.stringify({
        model: strong ? OPENAI_MODEL_STRONG : OPENAI_MODEL,
        // WICHTIG: Bei Reasoning-Modellen zaehlen die internen Denk-Tokens
        // gegen dieses Budget. Deshalb grosszuegig kalkulieren, sonst kommt
        // eine leere Antwort zurueck (finish_reason: "length").
        max_completion_tokens: Math.max(maxTokens * 5, 16000),
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const choice = data.choices?.[0];
    const out = (choice?.message?.content ?? "").trim();
    if (!out) {
      const grund = choice?.finish_reason ?? "unbekannt";
      const denk = data.usage?.completion_tokens_details?.reasoning_tokens;
      throw new Error(
        `Leere Antwort vom Modell ${strong ? OPENAI_MODEL_STRONG : OPENAI_MODEL} ` +
        `(finish_reason: ${grund}${denk ? `, Denk-Tokens: ${denk}` : ""}). ` +
        `Meist bedeutet das: das Token-Budget war zu knapp.`,
      );
    }
    return out;
  }
  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    throw new Error("Secret ANTHROPIC_API_KEY ist nicht gesetzt (Supabase > Edge Functions > Secrets).");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: strong ? ANTHROPIC_MODEL_STRONG : ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();
}

// ─── Hintergrund-Antworten fuer Beziehungsbild und Spiegel ──
// Statt auf eine Chat-Completion zu warten (die bei tiefer Analyse mehrere
// Minuten dauern kann und dabei von der Supabase-Laufzeit abgeraeumt werden
// kann), wird der Auftrag nur GESTARTET. Die Antwort holt eine spaetere,
// kurze Anfrage per Polling ab — jeder einzelne Funktionsaufruf dauert dann
// nur Sekunden, egal wie lange das Modell tatsaechlich denkt.
async function starteHintergrundantwort(prompt: string, maxTokens: number, strong: boolean): Promise<string> {
  if (!Deno.env.get("OPENAI_API_KEY")) {
    throw new Error("Secret OPENAI_API_KEY ist nicht gesetzt (Supabase > Edge Functions > Secrets).");
  }
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}`,
    },
    body: JSON.stringify({
      model: strong ? OPENAI_MODEL_STRONG : OPENAI_MODEL,
      // Strukturierte Form statt nacktem String — entspricht dem bewaehrten
      // messages-Format der Chat-Completions-API, mit der genau dieser
      // Prompt zuvor zuverlaessig funktioniert hat.
      input: [{ role: "user", content: prompt }],
      background: true,
      // Grosszuegiger als zuvor: mehr Raum fuer Denk-Tokens VOR dem eigentlichen
      // Text, damit die Reasoning-Phase den sichtbaren Text nicht verdraengt.
      max_output_tokens: Math.max(maxTokens * 8, 24000),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI (Start) ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.id) throw new Error("OpenAI hat beim Start keine Antwort-ID zurueckgegeben.");
  return data.id as string;
}

type Hintergrundstatus =
  | { fertig: false }
  | { fertig: true; text: string }
  | { fertig: true; fehler: string };

// Fragt den Stand eines gestarteten Auftrags ab. incomplete_details/error aus
// der OpenAI-Antwort landen direkt im Fehlertext — so wird sichtbar, WARUM
// ein Lauf scheitert (z.B. Token-Budget), statt dass er stillschweigend
// verschwindet. Das beantwortet nebenbei die Frage, ob je eine inhaltliche
// Ablehnung (Moderation/Policy) vorliegt, statt eines Infrastruktur-Problems:
// eine Ablehnung kaeme hier als expliziter, sofortiger Status zurueck.
async function holeHintergrundantwort(responseId: string): Promise<Hintergrundstatus> {
  const res = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
    signal: AbortSignal.timeout(20_000),
    headers: { "authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}` },
  });
  if (!res.ok) throw new Error(`OpenAI (Abfrage) ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.status === "queued" || data.status === "in_progress") return { fertig: false };
  if (data.status === "completed") {
    const items: Array<{ type?: string; status?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }> =
      Array.isArray(data.output) ? data.output : [];

    // Kurzfeld output_text zuerst versuchen — bricht aber offenbar bei
    // diesem Modell manchmal leer ab, OBWOHL der Text im strukturierten
    // output-Array laengst vorhanden ist (beobachtet 06.08.2026: message-
    // Element mit status='completed' und Content-Typ 'output_text', aber
    // data.output_text leer). Deshalb Fallback: Text direkt aus den
    // Content-Elementen vom Typ 'output_text' zusammensetzen.
    let text = String(data.output_text ?? "").trim();
    if (!text) {
      text = items
        .flatMap((it) => Array.isArray(it.content) ? it.content : [])
        .filter((c) => c?.type === "output_text")
        .map((c) => c.text ?? "")
        .join("\n")
        .trim();
    }
    if (text) return { fertig: true, text };

    // Wirklich leer — haeufigster Grund waere eine inhaltliche Ablehnung
    // (refusal), die in einem eigenen Content-Typ steckt. Die Begruendung
    // stammt von OpenAI selbst (generischer Ablehnungstext, kein Rohtext
    // der Nutzerinnen) und macht sichtbar, WORAN es tatsaechlich liegt.
    const refusal = items
      .flatMap((it) => Array.isArray(it.content) ? it.content : [])
      .find((c) => c?.type === "refusal");
    if (refusal) {
      return { fertig: true, fehler: `Vom Modell abgelehnt: ${refusal.refusal ?? "(kein Grund angegeben)"}` };
    }
    // Kein refusal gefunden — trotzdem Struktur-Details sammeln (Typen und
    // Status je Element, Content-Subtypen), damit ein erneutes Scheitern
    // sofort einordbar ist, statt wieder nur "leer" zu zeigen.
    const details = items.map((it: any) => {
      const subTypen = Array.isArray(it.content) ? it.content.map((c: any) => c?.type ?? "?").join("/") : "-";
      return `${it.type ?? "?"}(status=${it.status ?? "?"}, content=${subTypen})`;
    }).join(", ") || "keine";
    return { fertig: true, fehler: `Leere Antwort trotz Status 'completed' (Antwort-Elemente: ${details}).` };
  }
  const grund = data.incomplete_details?.reason ?? data.error?.message ?? "unbekannt";
  return { fertig: true, fehler: `OpenAI-Lauf beendet mit Status '${data.status}' (${grund}).` };
}

// Wiedereinstiegs-Schutz (CLAUDE.md Backlog Punkt 6): gesalzener SHA-256-
// Hash. Kein bcrypt/scrypt verfuegbar ohne externe Bibliothek in Deno, aber
// fuer einen kurzen Geraete-PIN mit zufaelligem Salt pro Person ausreichend
// -- die Bedrohung ist kurzer physischer Zugriff aufs entsperrte Geraet,
// kein Offline-Angriff auf die Datenbank.
function neuesSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function pinHash(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function gueltigerPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4,8}$/.test(pin);
}

// PIN-Rueckstetzung per Mail: Token ist per se schon hochentropisch
// (32 Byte Zufall), deshalb ungesalzener Hash zur Ablage -- anders als beim
// PIN selbst (der ist kurz und brauchbar fuers Erraten, deshalb Salt+Hash).
function neuesToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function tokenHash(token: string): Promise<string> {
  const enc = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Bewusst VOR den Verschluesselungs-Helfern deklariert: die nutzen VERSION
// in ihren Log-Ausgaben. Im Funktionsrumpf waere das zur Laufzeit zwar
// unkritisch, aber Nutzung-vor-Deklaration hat hier schon einmal einen
// Produktionsfehler verursacht (siehe CLAUDE.md) -- also gar nicht erst.
const VERSION = "2026-08-07g";

// ─── Verschluesselung ruhender Inhalte (CLAUDE.md Backlog Punkt 7) ──
// AES-256-GCM ueber Deno's natives crypto.subtle -- kein externes Paket,
// gleicher Stil wie die PIN-/Token-Hashes oben. Der Schluessel liegt
// ausschliesslich als Edge-Function-Secret, NIE in Postgres: damit ist
// der Inhalt gegen Table-Editor, SQL-Zugriff und Datenbank-Lecks
// geschuetzt. Keine Nulleinsicht -- das Modell verarbeitet zwangslaeufig
// Klartext -- aber genau diese Grenze ist so auch nach aussen formuliert.
//
// Format: zr1:<Fingerprint>:<base64 IV>:<base64 Ciphertext>
//   zr1         Formatversion, macht ein spaeteres Verfahren unterscheidbar
//   Fingerprint erste 16 Hexzeichen von SHA-256(Schluessel), NICHT geheim.
//               Macht erkennbar, ob eine Zeile ueberhaupt zum geladenen
//               Schluessel gehoert -- Grundlage fuer spaetere Rotation.
//   Das GCM-Auth-Tag steckt bereits im Ciphertext, braucht kein Feld.
//
// Der Praefix macht die Erkennung exakt statt heuristisch: alles ohne
// "zr1:" ist Alt-Klartext und wird unveraendert durchgereicht. Deshalb
// ist ein Code-Deploy fuer sich allein schon unschaedlich -- alte Zeilen
// bleiben lesbar, neue Schreibvorgaenge sind verschluesselt.
const ENC_PRAEFIX = "zr1";

function zuHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function zuBase64(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
// Liefert bewusst einen ArrayBuffer statt Uint8Array: crypto.subtle
// erwartet BufferSource, und neuere TypeScript-Fassungen akzeptieren ein
// Uint8Array<ArrayBufferLike> dort nicht mehr ohne Umweg.
function ausBase64(s: string): ArrayBuffer {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

let _encKey: CryptoKey | null = null;
let _encFp: string | null = null;

async function encSchluessel(): Promise<{ key: CryptoKey; fp: string }> {
  if (_encKey && _encFp) return { key: _encKey, fp: _encFp };
  const roh = Deno.env.get("CONTENT_ENC_KEY");
  if (!roh) {
    throw new Error("Secret CONTENT_ENC_KEY ist nicht gesetzt (Supabase > Edge Functions > Secrets).");
  }
  const bytes = ausBase64(roh);
  if (bytes.byteLength !== 32) {
    throw new Error(`CONTENT_ENC_KEY hat ${bytes.byteLength} Bytes, erwartet werden 32 (base64 aus 32 Zufallsbytes).`);
  }
  _encKey = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  // Fingerprint bewusst ueber den base64-String, nicht ueber die Rohbytes --
  // so stimmt er mit dem Digest ueberein, den `supabase secrets list`
  // anzeigt, und laesst sich ohne Kenntnis des Schluessels abgleichen.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(roh));
  _encFp = zuHex(new Uint8Array(digest)).slice(0, 16);
  return { key: _encKey, fp: _encFp };
}

function istVerschluesselt(wert: string): boolean {
  return wert.startsWith(`${ENC_PRAEFIX}:`);
}

// NULL und "" bleiben unveraendert -- reports.content/mirrors.content sind
// beim Anlegen bewusst leer, und probes.a ist NULL bis zur Antwort
// (das Frontend filtert per `.is("a", null)` genau darauf).
async function verschluesseln(klartext: string | null | undefined): Promise<string | null> {
  if (klartext == null || klartext === "") return klartext ?? null;
  const { key, fp } = await encSchluessel();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(klartext),
  );
  return `${ENC_PRAEFIX}:${fp}:${zuBase64(iv)}:${zuBase64(new Uint8Array(ct))}`;
}

// WICHTIG fuer alle Fehlertexte hier: niemals den Wert selbst (weder
// Klartext noch Ciphertext) in die Meldung aufnehmen. Fehler landen im
// Supabase-Log und in der Antwort an den Client -- ein Fragment dort waere
// genau der Klartextpfad, den diese Verschluesselung schliessen soll.
// Fingerprints sind unbedenklich, die sind per Definition nicht geheim.
async function entschluesseln(wert: string | null | undefined): Promise<string | null> {
  if (wert == null || wert === "") return wert ?? null;
  if (!istVerschluesselt(wert)) return wert; // Alt-Klartext, unveraendert
  const teile = wert.split(":");
  if (teile.length !== 4) {
    throw new Error("Verschluesselter Wert hat ein unerwartetes Format (erwartet: zr1:fp:iv:ct).");
  }
  const [, fpZeile, ivB64, ctB64] = teile;
  const { key, fp } = await encSchluessel();
  if (fpZeile !== fp) {
    // Bewusst KEIN Entschluesselungsversuch mit dem falschen Schluessel:
    // der scheiterte generisch und saehe aus wie Datenkorruption, obwohl
    // die Daten intakt sind und nur der Schluessel nicht passt.
    throw new Error(
      `Dieser Wert wurde mit einem anderen Schluessel verschluesselt ` +
      `(Zeile: ${fpZeile}, aktuell geladen: ${fp}). CONTENT_ENC_KEY passt nicht zu diesen Daten.`,
    );
  }
  try {
    const klar = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ausBase64(ivB64) }, key, ausBase64(ctB64),
    );
    return new TextDecoder().decode(klar);
  } catch {
    throw new Error("Entschluesselung fehlgeschlagen (Daten beschaedigt oder unvollstaendig).");
  }
}

// Tolerante Variante fuer aggregierte Listen, die in einen Prompt fliessen
// (Chronik, Material fuer Beziehungsbild/Spiegel): Dort stehen Dutzende
// Zeilen nebeneinander, und eine einzelne unlesbare darf nicht die ganze
// Analyse verhindern. Sie wird durch einen erkennbaren Marker ersetzt und
// im Log vermerkt. An Stellen, wo eine Person genau EINEN eigenen Text
// ansieht, gilt weiterhin die strenge Variante oben -- dort ist ein
// stiller Platzhalter falsch, da muss die echte Ursache sichtbar werden.
async function entschluesselnTolerant(
  wert: string | null | undefined, wo: string,
): Promise<string> {
  try {
    return (await entschluesseln(wert)) ?? "";
  } catch (e) {
    console.error(`[ai ${VERSION}] Entschluesselung fehlgeschlagen bei ${wo}: ${e instanceof Error ? e.message : String(e)}`);
    return "[Dieser Eintrag konnte nicht gelesen werden.]";
  }
}

// Schwelle fuer "bild_duenn" (KONZEPT.md 7.2): je Person mindestens so viele
// Chronik-Eintraege, sonst zeigt das Frontend vor dem Erstellen eine
// bestaetigbare Warnung. Chronik statt Zeichenzahl, weil sie Verstandenes
// zaehlt statt Geschriebenes und deshalb kaum manipulierbar ist.
const CHRONIK_SCHWELLE = 5;

// Falls ein Lauf nie zu Ende gepollt wird (z.B. beide Browser-Tabs
// geschlossen, bevor der letzte Poll-Tick kam), bleibt die Zeile sonst fuer
// immer auf "running" stehen. Solche Leichen raeumen wir beim naechsten
// Anlauf weg, damit niemand vor einem ewigen Ladehinweis sitzt.
async function haengendeLaeufeAufraeumen(
  admin: ReturnType<typeof createClient>,
  tabelle: "reports" | "mirrors",
  coupleId: string,
) {
  const grenze = new Date(Date.now() - 15 * 60_000).toISOString();
  await admin.from(tabelle).update({
    status: "error",
    error_msg: "Der Lauf wurde von der Laufzeitumgebung abgebrochen (Zeitlimit ueberschritten).",
  }).eq("couple_id", coupleId).eq("status", "running").lt("created_at", grenze);
}
const APP_URL = "https://zwischenraum.work";
const MAIL_FROM = "Zwischenraum <hallo@zwischenraum.work>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  if (url.searchParams.get("ping") === "1") {
    // Verschluesselungs-Schluessel mitmelden -- aber nur, OB er da ist und
    // welchen Fingerprint er hat, nie den Wert. Der Fingerprint ist
    // dieselbe Zahl, die `supabase secrets list` als Digest zeigt: damit
    // laesst sich von aussen pruefen, dass die Function wirklich den
    // erwarteten Schluessel geladen hat, ohne ihn je zu offenbaren.
    let enc: { gesetzt: boolean; fingerprint?: string; fehler?: string };
    try {
      const { fp } = await encSchluessel();
      enc = { gesetzt: true, fingerprint: fp };
    } catch (e) {
      enc = { gesetzt: false, fehler: e instanceof Error ? e.message : String(e) };
    }
    return json({
      ok: true, version: VERSION, provider: PROVIDER,
      key_set: !!Deno.env.get("OPENAI_API_KEY"),
      enc_key: enc,
    });
  }
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Nutzer aus dem JWT ermitteln
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Nicht angemeldet." }, 401);

    const body = await req.json();
    console.log(`[ai ${VERSION}] action=${body?.action} user=${user.id}`);

    // ─── Admin-Statistiken (separates Admin-Konto, nur Zahlen) ─
    if (body.action === "admin_stats") {
      const { data: adminRow } = await admin.from("admins")
        .select("user_id").eq("user_id", user.id).maybeSingle();
      if (!adminRow) return json({ error: "Kein Zugriff." }, 403);

      const cnt = async (table: string, filter?: (q: any) => any) => {
        let q = admin.from(table).select("*", { count: "exact", head: true });
        if (filter) q = filter(q);
        return (await q).count ?? 0;
      };
      const { data: memberRows } = await admin.from("couple_members").select("couple_id");
      const perCouple: Record<string, number> = {};
      for (const r of memberRows ?? []) perCouple[r.couple_id] = (perCouple[r.couple_id] ?? 0) + 1;
      const couplesTotal = Object.keys(perCouple).length;
      const couplesFull = Object.values(perCouple).filter((n) => n >= 2).length;

      const { data: reportRows } = await admin.from("reports").select("couple_id");
      const couplesWithReport = new Set((reportRows ?? []).map((r) => r.couple_id)).size;

      const cutoffOld = new Date(Date.now() - 28 * 864e5).toISOString();
      const cutoffActive = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data: oldCouples } = await admin.from("couples").select("id").lte("created_at", cutoffOld);
      const oldIds = new Set<string>((oldCouples ?? []).map((c) => String(c.id)));
      const activeIds = new Set<string>();
      for (const table of ["diary_entries", "conflicts", "chat_messages"]) {
        const { data: act } = await admin.from(table).select("couple_id").gte("created_at", cutoffActive);
        for (const r of act ?? []) activeIds.add(r.couple_id);
      }
      const retained = [...oldIds].filter((id) => activeIds.has(String(id))).length;

      return json({
        couples_total: couplesTotal,
        couples_full: couplesFull,
        beitrittsquote: couplesTotal ? Math.round((couplesFull / couplesTotal) * 100) : null,
        couples_with_report: couplesWithReport,
        beziehungsbild_quote: couplesFull ? Math.round((couplesWithReport / couplesFull) * 100) : null,
        couples_older_28d: oldIds.size,
        retained_28d: retained,
        retention_quote: oldIds.size ? Math.round((retained / oldIds.size) * 100) : null,
        active_couples_7d: activeIds.size,
        users_total: (memberRows ?? []).length,
        diary_total: await cnt("diary_entries"),
        conflicts_total: await cnt("conflicts"),
        reports_total: await cnt("reports"),
        mirrors_total: await cnt("mirrors"),
      });
    }

    // ─── Einmaliger Verschluesselungs-Sweep (Welle 1) ──────────
    // Verschluesselt Bestandszeilen, die noch Klartext sind. Steht
    // bewusst VOR dem couple_members-Lookup: das Admin-Konto gehoert zu
    // keinem Paar-Raum und wuerde dort mit "Kein Paar-Raum." abprallen
    // (gleicher Grund wie bei admin_stats).
    //
    // Doppelt abgesichert (eigenes Secret UND Admin-Konto), weil diese
    // Aktion als einzige massenhaft an fremden Daten schreibt.
    //
    // Idempotent ohne eigenes "migriert"-Flag: der zr1-Praefix sagt
    // selbst, ob eine Zeile schon verschluesselt ist. Ein abgebrochener
    // Lauf kann einfach erneut gestartet werden.
    //
    // Gegen Nebenlaeufigkeit: Das Update ist an den GELESENEN Altwert
    // gebunden (.eq(spalte, alt)). Schreibt parallel ein regulaerer
    // Vorgang (updateProfile ist ein Read-Modify-Write ueber einen
    // minutenlangen Modellaufruf hinweg!), trifft das Update ins Leere
    // statt frische Daten zu ueberschreiben -- solche Zeilen werden als
    // "nachtrag_noetig" gezaehlt und beim naechsten Lauf erledigt.
    if (body.action === "enc_migrate") {
      if (!Deno.env.get("MIGRATION_SECRET") || body.secret !== Deno.env.get("MIGRATION_SECRET")) {
        return json({ error: "Kein Zugriff." }, 403);
      }
      const { data: adminRow } = await admin.from("admins")
        .select("user_id").eq("user_id", user.id).maybeSingle();
      if (!adminRow) return json({ error: "Kein Zugriff." }, 403);

      const trockenlauf = body.trockenlauf !== false; // Standard: nur zaehlen
      const ZIELE: Array<{ tabelle: string; spalten: string[] }> = [
        { tabelle: "ai_profiles", spalten: ["profile"] },
        { tabelle: "chronicle", spalten: ["observation"] },
        { tabelle: "reports", spalten: ["notizen"] },
        { tabelle: "mirrors", spalten: ["notizen"] },
      ];

      const bericht: Record<string, unknown> = {};
      for (const { tabelle, spalten } of ZIELE) {
        // ai_profiles hat keinen eigenen id-Schluessel, sondern
        // (couple_id, user_id) -- deshalb je Tabelle der passende Filter.
        const schluessel = tabelle === "ai_profiles" ? ["couple_id", "user_id"] : ["id"];
        const { data: zeilen, error } = await admin.from(tabelle)
          .select([...schluessel, ...spalten].join(", "));
        if (error) { bericht[tabelle] = { fehler: error.message }; continue; }

        let verarbeitet = 0, uebersprungen = 0, nachtragNoetig = 0, fehlgeschlagen = 0;
        for (const zeile of zeilen ?? []) {
          const aenderung: Record<string, string | null> = {};
          let brauchtUpdate = false;
          for (const sp of spalten) {
            const alt = (zeile as Record<string, unknown>)[sp];
            if (alt == null || alt === "") continue;
            if (typeof alt !== "string") continue;
            if (istVerschluesselt(alt)) continue; // schon erledigt
            aenderung[sp] = await verschluesseln(alt);
            brauchtUpdate = true;
          }
          if (!brauchtUpdate) { uebersprungen++; continue; }
          if (trockenlauf) { verarbeitet++; continue; }

          // Alle Spalten dieser Zeile in EINEM Update -- kein Teilzustand.
          let q = admin.from(tabelle).update(aenderung);
          for (const k of schluessel) q = q.eq(k, (zeile as Record<string, unknown>)[k]);
          for (const sp of Object.keys(aenderung)) {
            q = q.eq(sp, (zeile as Record<string, unknown>)[sp] as string);
          }
          const { data: getroffen, error: updErr } = await q.select(schluessel[0]);
          if (updErr) { fehlgeschlagen++; console.error(`[ai ${VERSION}] enc_migrate ${tabelle}: ${updErr.message}`); continue; }
          if (!getroffen || getroffen.length === 0) { nachtragNoetig++; continue; }
          verarbeitet++;
        }
        bericht[tabelle] = { gesamt: (zeilen ?? []).length, verarbeitet, uebersprungen, nachtrag_noetig: nachtragNoetig, fehlgeschlagen };
      }
      return json({ ok: true, trockenlauf, bericht });
    }

    // ─── Nachverifikation: wie viel ist noch Klartext? ─────────
    // Das einzige Werkzeug, das eine durch Nebenlaeufigkeit verpasste
    // Zeile ueberhaupt sichtbar macht. Liefert nur Zahlen, nie Inhalte.
    if (body.action === "enc_status") {
      const { data: adminRow } = await admin.from("admins")
        .select("user_id").eq("user_id", user.id).maybeSingle();
      if (!adminRow) return json({ error: "Kein Zugriff." }, 403);

      const ZIELE: Array<[string, string[]]> = [
        ["ai_profiles", ["profile"]], ["chronicle", ["observation"]],
        ["reports", ["notizen"]], ["mirrors", ["notizen"]],
      ];
      const bericht: Record<string, unknown> = {};
      for (const [tabelle, spalten] of ZIELE) {
        const { data: zeilen } = await admin.from(tabelle).select(spalten.join(", "));
        const zahl: Record<string, { verschluesselt: number; klartext: number; leer: number }> = {};
        for (const sp of spalten) zahl[sp] = { verschluesselt: 0, klartext: 0, leer: 0 };
        for (const z of zeilen ?? []) {
          for (const sp of spalten) {
            const w = (z as Record<string, unknown>)[sp];
            if (w == null || w === "") zahl[sp].leer++;
            else if (typeof w === "string" && istVerschluesselt(w)) zahl[sp].verschluesselt++;
            else zahl[sp].klartext++;
          }
        }
        bericht[tabelle] = zahl;
      }
      return json({ ok: true, bericht });
    }

    const { data: member } = await admin
      .from("couple_members").select("couple_id, role, display_name")
      .eq("user_id", user.id).maybeSingle();
    if (!member) return json({ error: "Kein Paar-Raum." }, 400);

    const { data: partner } = await admin
      .from("couple_members").select("user_id, display_name")
      .eq("couple_id", member.couple_id).neq("user_id", user.id).maybeSingle();

    // Profile und Chroniken werden NICHT mehr unbedingt vor jedem Dispatch
    // geladen, sondern nur von den Aktionen, die sie wirklich brauchen.
    // Zwei Gruende:
    // 1. Sicherheit: Seit die Inhalte verschluesselt sind, koennte eine
    //    einzige unlesbare Profil- oder Chronikzeile sonst JEDE Aktion
    //    dieser Person sprengen -- auch delete_account (DSGVO Art. 17) und
    //    die Geraetesperre. Es gaebe keinen Weg mehr heraus.
    // 2. Kosten: Aktionen wie das Chat-Polling brauchen davon nichts,
    //    zahlten aber bisher zwei Profile plus bis zu 240 Chronikzeilen
    //    pro Aufruf mit.
    // Das Ergebnis wird gemerkt, mehrfacher Aufruf innerhalb einer Anfrage
    // kostet also nichts.
    let _kontext: {
      myProfile: string; partnerProfile: string;
      myChronik: string; partnerChronik: string;
    } | null = null;
    async function kontext() {
      if (_kontext) return _kontext;
      _kontext = {
        myProfile: await getProfile(admin, member.couple_id, user.id),
        partnerProfile: partner ? await getProfile(admin, member.couple_id, partner.user_id) : "",
        myChronik: await getChronik(admin, user.id),
        partnerChronik: partner ? await getChronik(admin, partner.user_id) : "",
      };
      return _kontext;
    }

    // ─── "Ueber dich": Fragebogen, Profil und Chronik laden ──
    // Musste aus Welle 2 vorgezogen werden: ai_profiles.profile und
    // chronicle.observation galten faelschlich als "rein serverseitig",
    // AboutYou.jsx liest sie aber direkt per RLS. Nach dem Verschluesseln
    // stand dort ungefragt Ciphertext auf dem Bildschirm.
    //
    // Ersetzt drei RLS-Policies, deshalb hier explizit auf die eigene
    // Person gefiltert -- der Service-Role-Client umgeht RLS.
    if (body.action === "about_you_get") {
      const { data: row } = await admin.from("assessments").select("*")
        .eq("user_id", user.id).maybeSingle();
      const profile = await getProfile(admin, member.couple_id, user.id);
      const { data: chRoh } = await admin.from("chronicle")
        .select("id, observation, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(200);
      const chronicle = await Promise.all((chRoh ?? []).map(async (c) => ({
        id: c.id,
        created_at: c.created_at,
        observation: await entschluesselnTolerant(c.observation, `chronicle.observation id=${c.id}`),
      })));
      return json({ ok: true, row: row ?? null, profile, chronicle });
    }

    // ─── Tagebuch: Impression + Profil-Update ───────────────
    if (body.action === "diary") {
      const { data: entry } = await admin.from("diary_entries")
        .select("id, content").eq("id", body.entry_id).eq("user_id", user.id).single();
      if (!entry) return json({ error: "Eintrag nicht gefunden." }, 404);
      const { myProfile, partnerProfile, myChronik, partnerChronik } = await kontext();

      const feedback = await claude(`${GRUNDREGELN}

AUFGABE: Die Person hat einen Tagebucheintrag geschrieben. Gib eine persoenliche Impression. Passe die Laenge dem Gewicht des Eintrags an (kurz bei Alltagsnotizen, ausfuehrlich bei bedeutsamen Eintraegen — es gibt keine Obergrenze, wenn der Eintrag sie rechtfertigt). Sprich die Person mit Namen an, wenn er dir vorliegt. Beziehe dich, wo passend, auf ihre frueheren Themen und ihre Entwicklung ("in deinen letzten Eintraegen...", "du beschreibst zum wiederholten Mal..."). Spiegle, was du hoerst, wuerdige Ehrlichkeit und Zwischentoene, benenne Muster als Beobachtung. Sei warm und nah, ohne Gefaelligkeit — Allparteilichkeit und Epistemik-Regeln gelten unveraendert.

RUECKFRAGEN NUR, WENN SIE ETWAS OEFFNEN: Stelle am Ende hoechstens EINE Frage — und nur dann, wenn sie der Person wirklich weiterhilft: wenn etwas unklar, widerspruechlich oder erkennbar unfertig ist, wenn sie sichtlich mit etwas ringt, oder wenn eine Frage einen blinden Fleck beleuchten wuerde.
KEINE Frage, wenn der Eintrag in sich abgeschlossen ist: eine Beobachtung, eine gute Nachricht, ein schoener Moment, eine Feststellung, eine kurze Notiz. Dann ist die angemessene Antwort, es einfach anzuerkennen und stehenzulassen. Eine Pflichtfrage macht aus einem leichten Moment eine Aufgabe — das ist ein Fehler.
Pruefe vor jeder Frage: Wuerde ein guter Zuhoerer hier wirklich nachfragen, oder wuerde er einfach zuhoeren? Im Zweifel: keine Frage.

ANGEMESSENHEIT: Passe dich dem Gewicht des Eintrags an. Bei etwas Erfreulichem darfst du dich mitfreuen — relativiere es nicht reflexhaft und warne nicht vorsorglich vor Enttaeuschung, wenn dazu kein konkreter Anlass besteht. Neutral heisst nicht distanziert, und es heisst auch nicht, jede gute Nachricht sofort einzuordnen. Wenn es dagegen etwas Wichtiges zu bedenken gibt, benenne es klar — Mahnen ist erlaubt, wenn es begruendet ist. ${partnerProfile ? "Du kennst ein verdichtetes Verstaendnis der anderen Person (unten). Du darfst daraus einen behutsamen Perspektivwechsel anregen (Regel 3 strikt beachten: nichts zitieren, nichts Konkretes offenbaren)." : ""}

Name der Person: ${member.display_name ?? "unbekannt"}

=== DEIN WISSEN UEBER DIESE PERSON (ihr eigenes Material - vollstaendig verfuegbar) ===
Verdichtetes Profil:
${myProfile || "(noch leer)"}
${myChronik ? `\nChronik (dauerhafte Beobachtungen, aelteste zuerst):\n${myChronik}` : ""}

${await eigenesMaterial(admin, member.couple_id, user.id)}

=== DEIN WISSEN UEBER DIE ANDERE PERSON (streng vertraulich, Regel 3 beachten) ===
${partnerProfile || partnerChronik ? `Verdichtetes Profil:\n${partnerProfile || "(leer)"}${partnerChronik ? `\n\nChronik:\n${partnerChronik}` : ""}` : "(noch nichts bekannt)"}

Neuer Tagebucheintrag:
"""${entry.content}"""

Antworte nur mit der Impression.`, 2500);

      await admin.from("diary_entries").update({ ai_feedback: feedback }).eq("id", entry.id);
      await updateProfile(admin, member.couple_id, user.id, myProfile, `Tagebucheintrag: ${entry.content}`);
      return json({ ok: true, feedback });
    }

    // ─── Tagebuch-Dialog: begrenzte Vertiefung mit Sitzungsende ─
    if (body.action === "diary_reply") {
      const { data: entry } = await admin.from("diary_entries")
        .select("id, content, ai_feedback, thread_closed")
        .eq("id", body.entry_id).eq("user_id", user.id).single();
      if (!entry) return json({ error: "Eintrag nicht gefunden." }, 404);
      if (entry.thread_closed) return json({ error: "Dieser Faden ist abgeschlossen — ein neuer Eintrag öffnet einen neuen." }, 400);
      const { myProfile, partnerProfile, myChronik, partnerChronik } = await kontext();

      const text = String(body.content ?? "").slice(0, 4000).trim();
      if (!text) return json({ error: "Leere Antwort." }, 400);
      await admin.from("diary_replies").insert({
        entry_id: entry.id, couple_id: member.couple_id, user_id: user.id, role: "user", content: text,
      });

      const { data: thread } = await admin.from("diary_replies")
        .select("role, content").eq("entry_id", entry.id).order("created_at", { ascending: true });
      const userTurns = (thread ?? []).filter((m) => m.role === "user").length;
      const verlauf = `Eintrag: ${entry.content}\nZwischenraum: ${entry.ai_feedback ?? ""}\n` +
        (thread ?? []).map((m) => `${m.role === "user" ? (member.display_name ?? "Person") : "Zwischenraum"}: ${m.content}`).join("\n");

      const HARTES_LIMIT = 12;                 // Notbremse, nicht der Regelfall
      const nahAmLimit = userTurns >= HARTES_LIMIT - 2;
      const erzwingeSchluss = userTurns >= HARTES_LIMIT;
      const aiText = await claude(`${GRUNDREGELN}

AUFGABE: Du fuehrst im Tagebuch ein vertiefendes Gespraech zu EINEM Eintrag — wie ein Therapeut in einer Sitzung: so lange, wie es traegt, und mit einem bewussten Ende, wenn es rund ist.

${erzwingeSchluss
        ? `Dieses Gespraech ist sehr lang geworden. Bringe es jetzt zu einem warmen Abschluss: antworte auf die letzte Nachricht, fasse wuerdigend zusammen, was entstanden ist, und lade dazu ein, es wirken zu lassen und bei Bedarf einen neuen Eintrag zu beginnen. Max. 160 Woerter, KEINE neue Frage.`
        : `Antworte warm und konkret auf die letzte Nachricht. Passe die Laenge dem Gewicht an — knapp, wenn es knapp sein darf, ausfuehrlich, wenn das Thema es braucht.

ENTSCHEIDE SELBST, ob das Gespraech weitergeht:
- Solange die Person in Bewegung ist, neue Aspekte auftauchen oder sie sichtlich an etwas arbeitet: FUEHRE WEITER. Stelle eine Frage nur, wenn sie wirklich etwas oeffnet — manchmal traegt ein Gespraech auch ohne Frage weiter, weil eine Beobachtung dran ist.
- Erst wenn ein natuerlicher Bogen erreicht ist (die Person hat etwas fuer sich geklaert, wiederholt sich, oder es ist alles gesagt): schliesse warm ab, fasse kurz zusammen und stelle KEINE neue Frage.
- Brich niemals ab, solange das Gespraech der Person erkennbar hilft. Ein hilfreiches Gespraech zu beenden ist schlimmer als eines, das eine Runde zu lang laeuft.${nahAmLimit ? "\n- Hinweis: Das Gespraech ist bereits sehr lang. Steuere behutsam auf einen guten Abschluss zu." : ""}

Setze ans ENDE deiner Antwort in einer eigenen Zeile exakt eines von beiden:
[WEITER]  — wenn das Gespraech weitergehen soll
[ENDE]    — wenn du gerade abgeschlossen hast`}

Name der Person: ${member.display_name ?? "unbekannt"}

=== DEIN WISSEN UEBER DIESE PERSON ===
${myProfile || "(noch leer)"}
${myChronik ? `\nChronik:\n${myChronik}` : ""}

=== DEIN WISSEN UEBER DIE ANDERE PERSON (streng vertraulich, Regel 3) ===
${partnerProfile || "(noch nichts bekannt)"}${partnerChronik ? `\n\nChronik:\n${partnerChronik}` : ""}

Bisheriger Faden:
${verlauf}

Antworte nur mit deiner Nachricht.`, 2500);

      const willEnde = /\[ENDE\]\s*$/.test(aiText.trim());
      const sichtbar = aiText.replace(/\[(WEITER|ENDE)\]\s*$/, "").trim();
      const abschluss = erzwingeSchluss || willEnde;

      await admin.from("diary_replies").insert({
        entry_id: entry.id, couple_id: member.couple_id, user_id: user.id, role: "ai", content: sichtbar,
      });
      if (abschluss) {
        await admin.from("diary_entries").update({ thread_closed: true }).eq("id", entry.id);
        await updateProfile(admin, member.couple_id, user.id, myProfile,
          `Vertiefender Dialog zum Tagebucheintrag (vollstaendiger Verlauf): ${verlauf}`);
      }
      return json({ ok: true, reply: sichtbar, closed: abschluss });
    }

    // ─── Konflikt: Reflexion, Vermittlung, Beschoenigungs-Check ─
    if (body.action === "conflict") {
      const { data: k } = await admin.from("conflicts")
        .select("id, title, content").eq("id", body.conflict_id).eq("user_id", user.id).single();
      if (!k) return json({ error: "Konflikt nicht gefunden." }, 404);

      const { data: pastOwn } = await admin.from("conflicts")
        .select("title, content").eq("couple_id", member.couple_id)
        .eq("user_id", user.id).neq("id", k.id)
        .order("created_at", { ascending: false }).limit(80);
      const { myProfile, partnerProfile, myChronik, partnerChronik } = await kontext();

      const reflection = await claude(`${GRUNDREGELN}

AUFGABE: Die Person hat einen Konflikt oder ein grundsaetzliches Thema aus ihrer Sicht beschrieben. Antworte in drei Teilen. Nimm dir den Raum, den das Thema braucht (300-700 Woerter):
1. VERSTANDEN — was du aus ihrer Sicht hoerst (Beduerfnis hinter dem Aerger).
2. OFFEN GESPROCHEN — pruefe wohlwollend, aber ehrlich: Was koennte in dieser Schilderung beschoenigt, ausgelassen oder einseitig sein? Benenne Diskrepanzen zu frueheren Schilderungen oder zum Selbstbild, falls vorhanden. Sei dabei fair: du kennst nur eine Seite.
3. VERMITTLUNG — ein konkreter Reflexions- oder Gespraechsvorschlag. ${partnerProfile ? "Nutze dein verdichtetes Verstaendnis der anderen Person fuer einen Perspektivhinweis (Regel 3 strikt: nichts zitieren, nichts Konkretes offenbaren)." : ""}

=== DEIN WISSEN UEBER DIESE PERSON (vollstaendig verfuegbar) ===
Verdichtetes Profil:
${myProfile || "(noch leer)"}
${myChronik ? `\nChronik:\n${myChronik}` : ""}

=== DEIN WISSEN UEBER DIE ANDERE PERSON (streng vertraulich, Regel 3) ===
${partnerProfile || partnerChronik ? `${partnerProfile || "(leer)"}${partnerChronik ? `\n\nChronik:\n${partnerChronik}` : ""}` : "(noch nichts bekannt)"}

Fruehere Konfliktschilderungen dieser Person:
${(pastOwn ?? []).map((c) => `- ${c.title ?? "ohne Titel"}: ${c.content}`).join("\n\n") || "(keine)"}

Neuer Konflikt${k.title ? ` ("${k.title}")` : ""}:
"""${k.content}"""

Antworte nur mit den drei Teilen.`, 2500);

      await admin.from("conflicts").update({ ai_reflection: reflection }).eq("id", k.id);
      await updateProfile(admin, member.couple_id, user.id, myProfile, `Konfliktschilderung: ${k.content}`);
      return json({ ok: true, reflection });
    }

    // ─── Fragebogen auswerten + Nachfragen generieren ───────
    if (body.action === "assessment") {
      const { data: a } = await admin.from("assessments")
        .select("answers").eq("couple_id", member.couple_id).eq("user_id", user.id).single();
      if (!a?.answers) return json({ error: "Keine Antworten gefunden." }, 404);

      const answersText = Object.values(a.answers as Record<string, { frage: string; antwort: string }>)
        .map((x) => `- ${x.frage}\n  Antwort: ${x.antwort}`).join("\n");
      const { myProfile } = await kontext();

      await updateProfile(admin, member.couple_id, user.id, myProfile,
        `Basisfragebogen (Selbstauskunft zu Konfliktverhalten, Beduerfnissen, Werten und Praegung):\n${answersText}`);

      const raw = await claude(`${GRUNDREGELN}

AUFGABE: Die Person hat einen Basisfragebogen ausgefuellt (unten). Formuliere genau 3 persoenliche, vertiefende Nachfragen zu den Stellen, die am aufschlussreichsten, unklarsten oder spannungsreichsten wirken (z.B. Widersprueche zwischen Antworten, angedeutete Praegungen). Offene Fragen, wertfrei, eine pro Zeile. Keine Diagnosen, keine Typisierung.

Antworten der Person:
${answersText}

Antworte NUR mit validem JSON ohne Backticks: {"fragen":["...","...","..."]}`);

      let fragen: string[] = [];
      try { fragen = JSON.parse(raw.replace(/```json|```/g, "").trim()).fragen.slice(0, 3); } catch { fragen = []; }
      const followups = fragen.map((q) => ({ q }));
      await admin.from("assessments").update({
        followups, interview_done: followups.length === 0, updated_at: new Date().toISOString(),
      }).eq("couple_id", member.couple_id).eq("user_id", user.id);
      return json({ ok: true, followups });
    }

    // ─── Antwort auf eine Nachfrage verarbeiten ─────────────
    if (body.action === "assessment_followup") {
      const { data: a } = await admin.from("assessments")
        .select("followups").eq("couple_id", member.couple_id).eq("user_id", user.id).single();
      const followups = (a?.followups ?? []) as { q: string; a?: string }[];
      const idx = Number(body.index);
      if (!followups[idx]) return json({ error: "Frage nicht gefunden." }, 404);
      followups[idx].a = String(body.answer ?? "").slice(0, 2000);
      const { myProfile } = await kontext();

      await updateProfile(admin, member.couple_id, user.id, myProfile,
        `Interview-Nachfrage: "${followups[idx].q}" — Antwort der Person: "${followups[idx].a}"`);

      const done = followups.every((f) => f.a);
      await admin.from("assessments").update({
        followups, interview_done: done, updated_at: new Date().toISOString(),
      }).eq("couple_id", member.couple_id).eq("user_id", user.id);
      return json({ ok: true, done });
    }

    // ─── Gate: Bereitschaft fuer den gemeinsamen Raum ───────
    if (body.action === "gate") {
      if (!partner) return json({ readiness: "Der gemeinsame Raum braucht euch beide — deine Partnerin oder dein Partner ist noch nicht beigetreten." });

      // Substanz statt Stueckzahl: Gesamtumfang des Materials je Person
      const substanz = async (uid: string) => {
        const { data: d } = await admin.from("diary_entries").select("content")
          .eq("couple_id", member.couple_id).eq("user_id", uid).limit(100);
        const { data: k } = await admin.from("conflicts").select("content")
          .eq("couple_id", member.couple_id).eq("user_id", uid).limit(100);
        const { data: a } = await admin.from("assessments").select("answers")
          .eq("couple_id", member.couple_id).eq("user_id", uid).maybeSingle();
        const answersLen = a?.answers ? JSON.stringify(a.answers).length / 2 : 0;
        const chars = [...(d ?? []), ...(k ?? [])].reduce((n, e) => n + (e.content?.length ?? 0), 0) + answersLen;
        return { chars: Math.round(chars), entries: (d ?? []).length };
      };
      const mine = await substanz(user.id);
      const theirs = await substanz(partner.user_id);
      const heuristik = mine.entries >= 1 && theirs.entries >= 1 && mine.chars >= 1200 && theirs.chars >= 1200;
      const { myProfile, partnerProfile } = await kontext();

      const verdict = await claude(`${GRUNDREGELN}

AUFGABE: Entscheide, ob der gemeinsame moderierte Chat geoeffnet werden kann. Kriterium: Kennst du beide Seiten gut genug, um fair und informiert zu moderieren? Es zaehlt SUBSTANZ, nicht Stueckzahl — ein einziger ausfuehrlicher Eintrag kann reichen. Mindestbedingung (bereits geprueft): ${heuristik ? "ERFUELLT" : "NICHT ERFUELLT"} (je Person mind. ein Tagebucheintrag und insgesamt spuerbares Material; aktueller Umfang ${mine.chars}/${theirs.chars} Zeichen). Pruefe anhand der Profile, ob dir von BEIDEN die Kernbereiche ausreichend bekannt sind (Konflikterleben, Beduerfnisse, Sicht auf die Beziehung). Wenn nein: benenne konkret und freundlich, WAS dir von wem noch fehlt — als Einladung, nicht als Checkliste.

Verdichtetes Verstaendnis Person 1:
${myProfile || "(leer)"}

Verdichtetes Verstaendnis Person 2:
${partnerProfile || "(leer)"}

Antworte NUR mit validem JSON ohne Backticks: {"open": true|false, "begruendung": "100-200 Woerter, an beide gerichtet, motivierend und ehrlich — bei false: was noch fehlt, ohne Inhalte einer Seite zu offenbaren"}`);

      let open = false, begruendung = verdict;
      try {
        const p = JSON.parse(verdict.replace(/```json|```/g, "").trim());
        open = heuristik && !!p.open;
        begruendung = p.begruendung;
      } catch { open = false; }

      await admin.from("couple_state").upsert({
        couple_id: member.couple_id, gate_open: open, readiness: begruendung, updated_at: new Date().toISOString(),
      });

      if (open) {
        const { count } = await admin.from("chat_messages")
          .select("id", { count: "exact", head: true }).eq("couple_id", member.couple_id);
        if ((count ?? 0) === 0) {
          const opening = await claude(`${GRUNDREGELN}

AUFGABE: Der gemeinsame Raum oeffnet sich zum ersten Mal. Schreibe eine Eroeffnungsnachricht an beide (150-250 Woerter): Wuerdige, dass beide sich eingebracht haben, benenne EIN Thema, das offenbar beide beschaeftigt (nur wenn beide es unabhaengig beruehrt haben — Regel 1), und schlage vor, womit sie beginnen koennten. Nichts zitieren, nichts Einseitiges offenbaren.

Verstaendnis Person 1:
${myProfile}

Verstaendnis Person 2:
${partnerProfile}`);
          await admin.from("chat_messages").insert({
            couple_id: member.couple_id, sender_id: null, content: opening,
          });
        }
      }
      return json({ ok: true, gate_open: open, readiness: begruendung });
    }

    // ─── Der naechste Schritt: Meilensteine + Begruendung im Klartext ─
    // KONZEPT.md 6.2/7.2. Ersetzt das verworfene Barometer: keine Fleiss-
    // Masse ueber die andere Person, nur tatsaechliche Zustaende. Der
    // Wortlaut entsteht ausschliesslich hier, damit er nicht zwischen
    // Oberflaechen auseinanderlaeuft.
    if (body.action === "meilensteine") {
      const { data: consentsRaw } = await admin.from("couple_members")
        .select("user_id, report_consent").eq("couple_id", member.couple_id);
      const cons = consentsRaw ?? [];
      const freigabeIch = !!cons.find((c) => c.user_id === user.id)?.report_consent;
      const freigabePartner = partner ? !!cons.find((c) => c.user_id === partner.user_id)?.report_consent : false;

      const { data: state } = await admin.from("couple_state")
        .select("gate_open, readiness").eq("couple_id", member.couple_id).maybeSingle();
      const chatOffen = !!state?.gate_open;

      const chronikAnzahl = async (uid: string) => {
        const { count } = await admin.from("chronicle")
          .select("id", { count: "exact", head: true }).eq("user_id", uid);
        return count ?? 0;
      };
      const bildDuenn = !partner || !(
        (await chronikAnzahl(user.id)) >= CHRONIK_SCHWELLE &&
        (await chronikAnzahl(partner.user_id)) >= CHRONIK_SCHWELLE
      );

      // ACHTUNG: Diese Texte gehen direkt an die Oberflaeche, sind KEIN
      // Prompt an das Modell -- deshalb hier normale deutsche Umlaute
      // verwenden, anders als sonst in dieser Datei ueblich.
      let naechster: "partner_fehlt" | "freigabe_fehlt" | null = null;
      let grund = "";
      if (!partner) {
        naechster = "partner_fehlt";
        const { data: couple } = await admin.from("couples").select("invite_code").eq("id", member.couple_id).maybeSingle();
        grund = `Der Zwischenraum öffnet sich, sobald deine Partnerin oder dein Partner beigetreten ist. Euer Einladungscode: ${couple?.invite_code ?? "-"}`;
      } else if (!(freigabeIch && freigabePartner)) {
        naechster = "freigabe_fehlt";
        const nameP = partner.display_name ?? "die andere Seite";
        if (!freigabeIch && !freigabePartner) grund = "Für ein Beziehungsbild müsst ihr beide freigeben — noch hat keiner von euch freigegeben.";
        else if (!freigabeIch) grund = `${nameP} hat bereits freigegeben — deine Freigabe steht noch aus.`;
        else grund = `Du hast freigegeben — ${nameP}s Freigabe steht noch aus.`;
      }

      return json({
        naechster, grund,
        partner_da: !!partner,
        freigabe_ich: freigabeIch,
        freigabe_partner: freigabePartner,
        bild_duenn: bildDuenn,
        chat_offen: chatOffen,
        chat_grund: state?.readiness ?? "",
      });
    }

    // ─── Beziehungsbild: Stufe 1 anstossen, Rest per Polling ─
    if (body.action === "report") {
      if (!partner) return json({ error: "Deine Partnerin oder dein Partner ist noch nicht beigetreten." }, 400);
      const { data: consents } = await admin.from("couple_members")
        .select("user_id, report_consent, display_name").eq("couple_id", member.couple_id);
      const all = consents ?? [];
      if (!(all.length === 2 && all.every((m) => m.report_consent))) {
        return json({ error: "Das Beziehungsbild braucht die aktive Freigabe von euch beiden." }, 403);
      }

      await haengendeLaeufeAufraeumen(admin, "reports", member.couple_id);

      const nameMe = member.display_name ?? "Person 1";
      const nameP = partner.display_name ?? "Person 2";
      const matMe = await materialFuer(admin, member.couple_id, user.id);
      const matP = await materialFuer(admin, member.couple_id, partner.user_id);

      const notizenPrompt = `${GRUNDREGELN}

AUFGABE: Du bereitest ein "Beziehungsbild" vor. Erstelle zunaechst interne Analyse-Notizen (niemand ausser dir liest sie — sei praezise und schonungslos ehrlich, aber halte die Epistemik-Regeln ein). Arbeite systematisch heraus:
1. KREUZVERGLEICH: Welche Situationen/Themen beschreiben beide — und wo weichen die Darstellungen voneinander ab? (Thema -> Sicht ${nameMe} -> Sicht ${nameP})
2. GLEICHE GEFUEHLE, ANDERE WORTE: Wo empfinden beide dasselbe, benennen es aber unterschiedlich?
3. BEDUERFNISSE: Welche Kernbeduerfnisse stehen bei jeder Person hinter dem beschriebenen Verhalten? Welche werden erfuellt, welche chronisch nicht?
4. LANGJAEHRIGE MISSVERSTAENDNISSE: Wo interpretiert eine Person das Verhalten der anderen vermutlich seit Langem anders, als es gemeint ist?
5. PRAEGUNGEN: Welche Muster aus Herkunftsfamilie/Vergangenheit wirken erkennbar in die Beziehung hinein?
6. DIE FRAGEN: Welche Frage beantwortet jede Person gerade tatsaechlich? (z.B. "Wie retten wir es?" vs. "Kann ich es noch wollen?") Sind es dieselben?
7. HOFFNUNGEN & GRENZEN: Welche Hoffnungen sind noch da? Wo gibt es womoeglich echte Unvereinbarkeiten, die man nicht wegmoderieren sollte?

MATERIAL ${nameMe}:
${matMe}

MATERIAL ${nameP}:
${matP}

Antworte nur mit den nummerierten Notizen.`;

      const responseId = await starteHintergrundantwort(notizenPrompt, 4000, true);

      const { data: zeile } = await admin.from("reports").insert({
        couple_id: member.couple_id, content: null, status: "running",
        stage: "notizen", openai_response_id: responseId, requested_by: user.id,
      }).select("id").single();

      return json({ ok: true, id: zeile?.id, status: "running" });
    }

    // ─── Beziehungsbild: Fortschritt abholen, ggf. Stufe 2 anstossen ─
    if (body.action === "report_poll") {
      const { data: zeile } = await admin.from("reports").select("*")
        .eq("id", body.id).eq("couple_id", member.couple_id).maybeSingle();
      if (!zeile) return json({ error: "Bericht nicht gefunden." }, 404);
      if (zeile.status !== "running") return json({ ok: true, status: zeile.status });
      if (!zeile.openai_response_id) {
        await admin.from("reports").update({
          status: "error", error_msg: "Kein Hintergrund-Auftrag hinterlegt (Lauf von vor der Umstellung auf asynchrone Verarbeitung).",
        }).eq("id", zeile.id);
        return json({ ok: true, status: "error" });
      }

      const ergebnis = await holeHintergrundantwort(zeile.openai_response_id);
      if (!ergebnis.fertig) return json({ ok: true, status: "running" });
      if ("fehler" in ergebnis) {
        await admin.from("reports").update({ status: "error", error_msg: ergebnis.fehler }).eq("id", zeile.id);
        return json({ ok: true, status: "error" });
      }

      if (zeile.stage === "notizen") {
        const { data: beide } = await admin.from("couple_members")
          .select("user_id, display_name").eq("couple_id", zeile.couple_id);
        const nameMe = (beide ?? []).find((m) => m.user_id === zeile.requested_by)?.display_name ?? "Person 1";
        const nameP = (beide ?? []).find((m) => m.user_id !== zeile.requested_by)?.display_name ?? "Person 2";
        const notizen = ergebnis.text;

        const berichtPrompt = `${GRUNDREGELN}

AUFGABE: Beide Partner haben ausdruecklich eingewilligt, dass du ihr gesamtes Material fuer ein gemeinsames "Beziehungsbild" auswertest, das BEIDE lesen werden. Deine interne Tiefenanalyse liegt vor (unten). Schreibe daraus einen Bericht in genau drei Teilen, insgesamt 700-1200 Woerter. Geh in die Tiefe: konkret statt allgemein, benenne die Dynamiken aus deiner Analyse klar — Verstaendnis entsteht durch Praezision, nicht durch Weichzeichnen:

TEIL 1 — DAS ERLEBT ${nameMe.toUpperCase()}
Ihre/seine innere Welt: Gefuehle, Verletzungen, Hoffnungen, Aengste, Beduerfnisse. Ohne Bewertung, ohne Urteil. Schreibe so, dass ${nameMe} sich tief verstanden fuehlt und ${nameP} zum ersten Mal wirklich hineinsehen kann.

TEIL 2 — DAS ERLEBT ${nameP.toUpperCase()}
Dasselbe fuer ${nameP}, mit identischem Massstab und identischer Sorgfalt.

TEIL 3 — WAS ZWISCHEN EUCH PASSIERT
Nicht wer recht hat, sondern: Wo beschreibt ihr dieselbe Situation voellig unterschiedlich? Wo fuehlt ihr dasselbe mit anderen Worten? Wo missversteht ihr euch womoeglich seit Langem? Welche Beduerfnisse stehen hinter dem Verhalten? Und besonders wichtig: Pruefe, ob beide gerade dieselbe Frage beantworten — oder ob einer fragt "Wie machen wir es besser?" waehrend die andere Person fragt "Kann ich das noch aus vollem Herzen wollen?". Wenn die Fragen verschieden sind, benenne das klar und wohlwollend als ersten Klaerungsschritt.

STRIKTE REGELN: Keine woertlichen Zitate aus dem Material. Keine Detailoffenbarungen, die eine Person erkennbar nur im Vertrauen geschrieben hat (z.B. konkrete dritte Personen, intime Einzelheiten) — beschreibe stattdessen die dahinterliegenden Gefuehle und Beduerfnisse. Beide Teile muessen in Tiefe und Wohlwollen ausgewogen sein. Kein Fazit, keine Empfehlung zu bleiben oder zu gehen — der Bericht schafft Verstaendnis, die Entscheidungen gehoeren dem Paar.

DEINE INTERNE TIEFENANALYSE:
${notizen}

Antworte nur mit dem Bericht (drei Teile mit Ueberschriften).`;

        const neueId = await starteHintergrundantwort(berichtPrompt, 5000, true);
        await admin.from("reports").update({
          stage: "bericht", openai_response_id: neueId,
          notizen: await verschluesseln(notizen),
        }).eq("id", zeile.id);
        return json({ ok: true, status: "running" });
      }

      // stage === "bericht": fertig
      await admin.from("reports").update({ content: ergebnis.text, status: "done" }).eq("id", zeile.id);
      if (zeile.requested_by) {
        const { data: beide } = await admin.from("couple_members")
          .select("user_id").eq("couple_id", zeile.couple_id);
        const empfaenger = (beide ?? []).find((m) => m.user_id !== zeile.requested_by)?.user_id;
        if (empfaenger) await benachrichtigeBeiFreigabe(admin, zeile.couple_id, empfaenger, "report");
      }
      return json({ ok: true, status: "done" });
    }

    // ─── Dein Spiegel: Stufe 1 anstossen, Rest per Polling ──
    if (body.action === "mirror") {
      if (!partner) return json({ error: "Der Spiegel braucht euch beide — deine Partnerin oder dein Partner ist noch nicht beigetreten." }, 400);
      const { data: consents } = await admin.from("couple_members")
        .select("user_id, report_consent").eq("couple_id", member.couple_id);
      const all = consents ?? [];
      if (!(all.length === 2 && all.every((m) => m.report_consent))) {
        return json({ error: "Der Spiegel nutzt denselben Freigabe-Rahmen wie das Beziehungsbild: beide müssen ihr Material freigegeben haben." }, 403);
      }

      await haengendeLaeufeAufraeumen(admin, "mirrors", member.couple_id);

      const nameMe = member.display_name ?? "du";
      const matMe = await materialFuer(admin, member.couple_id, user.id);
      const matP = await materialFuer(admin, member.couple_id, partner.user_id);

      const notizenPrompt = `${GRUNDREGELN}

AUFGABE: Du bereitest einen "Spiegel" fuer ${nameMe} vor: individuelles Feedback, das NUR ${nameMe} lesen wird. Du kennst das Material beider Seiten — aber die Blickrichtung deiner Analyse zeigt AUSSCHLIESSLICH auf ${nameMe}. Das Material der anderen Person dient dir nur als Linse. Erstelle interne Notizen zu:
1. SELBSTBILD vs. WIRKUNG: Wo koennte das Verhalten von ${nameMe} anders ankommen, als es gemeint ist?
2. EIGENER ANTEIL: Welchen wiederkehrenden Beitrag leistet ${nameMe} zur gemeinsamen Dynamik — auch unbeabsichtigt?
3. BLINDE FLECKEN: Was uebersieht oder vermeidet ${nameMe} moeglicherweise (auch sich selbst gegenueber)?
4. PRAEGUNGEN: Welche eigenen Muster aus Vergangenheit/Herkunftsfamilie wirken bei ${nameMe} erkennbar hinein?
5. STAERKEN: Was gelingt ${nameMe} in der Beziehung gut und traegt?
6. WACHSTUMSKANTEN: Die 1-2 konkreten Punkte mit dem groessten Hebel fuer ${nameMe} selbst.

ABSOLUTE SPERRREGEL: Jede Erkenntnis, die sich NUR durch eine private Aussage der anderen Person belegen laesst (deren Gefuehle, Zweifel, Plaene, Bewertungen, Geheimnisse), ist GESPERRT und darf weder direkt noch indirekt, angedeutet oder umformuliert verwendet werden. Verwende von der anderen Seite nur, was ${nameMe} aus dem gemeinsamen Leben ohnehin wissen kann.

MATERIAL ${nameMe}:
${matMe}

MATERIAL DER ANDEREN PERSON (nur als Linse, Sperrregel beachten):
${matP}

Antworte nur mit den nummerierten Notizen.`;

      const responseId = await starteHintergrundantwort(notizenPrompt, 4000, true);

      const { data: zeile } = await admin.from("mirrors").insert({
        couple_id: member.couple_id, user_id: user.id, content: null, status: "running",
        stage: "notizen", openai_response_id: responseId,
      }).select("id").single();

      return json({ ok: true, id: zeile?.id, status: "running" });
    }

    // ─── Dein Spiegel: Fortschritt abholen, ggf. Stufe 2 anstossen ──
    if (body.action === "mirror_poll") {
      const { data: zeile } = await admin.from("mirrors").select("*")
        .eq("id", body.id).eq("user_id", user.id).maybeSingle();
      if (!zeile) return json({ error: "Spiegel nicht gefunden." }, 404);
      if (zeile.status !== "running") return json({ ok: true, status: zeile.status });
      if (!zeile.openai_response_id) {
        await admin.from("mirrors").update({
          status: "error", error_msg: "Kein Hintergrund-Auftrag hinterlegt (Lauf von vor der Umstellung auf asynchrone Verarbeitung).",
        }).eq("id", zeile.id);
        return json({ ok: true, status: "error" });
      }

      const ergebnis = await holeHintergrundantwort(zeile.openai_response_id);
      if (!ergebnis.fertig) return json({ ok: true, status: "running" });
      if ("fehler" in ergebnis) {
        await admin.from("mirrors").update({ status: "error", error_msg: ergebnis.fehler }).eq("id", zeile.id);
        return json({ ok: true, status: "error" });
      }

      if (zeile.stage === "notizen") {
        const { data: meRow } = await admin.from("couple_members")
          .select("display_name").eq("couple_id", zeile.couple_id).eq("user_id", zeile.user_id).maybeSingle();
        const nameMe = meRow?.display_name ?? "du";
        const notizen = ergebnis.text;

        const spiegelPrompt = `${GRUNDREGELN}

AUFGABE: Schreibe aus deinen internen Notizen (unten) den "Spiegel" fuer ${nameMe} — einen persoenlichen Text (400-700 Woerter), den nur ${nameMe} liest. Sprich ${nameMe} direkt an. Enthalte: was gut gelingt und traegt; wie das eigene Verhalten vermutlich ankommt; den eigenen Anteil an der Dynamik; blinde Flecken — wohlwollend, aber ohne Weichzeichnen; und am Ende 1-2 konkrete Wachstumskanten mit einem umsetzbaren ersten Schritt. Keine Aussagen darueber, was die andere Person fuehlt, denkt, plant oder privat geschrieben hat — die SPERRREGEL gilt unveraendert. Kein Urteil ueber die Beziehung.

DEINE INTERNEN NOTIZEN:
${notizen}

Antworte nur mit dem Spiegel-Text.`;

        const neueId = await starteHintergrundantwort(spiegelPrompt, 4000, true);
        await admin.from("mirrors").update({
          stage: "spiegel", openai_response_id: neueId,
          notizen: await verschluesseln(notizen),
        }).eq("id", zeile.id);
        return json({ ok: true, status: "running" });
      }

      // stage === "spiegel": fertig
      await admin.from("mirrors").update({ content: ergebnis.text, status: "done" }).eq("id", zeile.id);
      return json({ ok: true, status: "done" });
    }

    // ─── Verankertes Gespraech zu Beziehungsbild oder Spiegel ─
    // KONZEPT.md 7.2/7.3. Kontext bewusst OHNE Material der anderen Person
    // (auch beim Spiegel nicht, obwohl der Spiegel selbst welches als Linse
    // nutzt) -- ein Chat laedt viel staerker zum Nachbohren ein als ein
    // einmalig erzeugter Text, jedes zusaetzliche Partner-Material waere
    // eine neue Leckage-Quelle.
    if (body.action === "doc_chat") {
      const kind = String(body.kind ?? "");
      if (!["report", "mirror"].includes(kind)) return json({ error: "Unbekannter Dokumenttyp." }, 400);
      const docId = String(body.doc_id ?? "");

      const zeile = kind === "report"
        ? (await admin.from("reports").select("*").eq("id", docId).eq("couple_id", member.couple_id).maybeSingle()).data
        : (await admin.from("mirrors").select("*").eq("id", docId).eq("user_id", user.id).maybeSingle()).data;
      if (!zeile) return json({ error: "Dokument nicht gefunden." }, 404);
      if (zeile.status !== "done") return json({ error: "Dieses Dokument ist noch nicht fertig." }, 400);

      // Nur das juengste Dokument seiner Art nimmt neue Nachrichten an
      // (Definition of Done: aeltere Gespraeche bleiben lesbar, aber
      // schreibgeschuetzt). Betrifft nur das SCHREIBEN einer neuen
      // Nachricht -- Lesen laeuft direkt ueber die RLS-Policy am Client.
      const neuesteId = kind === "report"
        ? (await admin.from("reports").select("id").eq("couple_id", member.couple_id)
            .order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.id
        : (await admin.from("mirrors").select("id").eq("user_id", user.id)
            .order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.id;
      const istJuengstes = neuesteId === docId;

      const rohtext = body.message != null ? String(body.message).slice(0, 4000).trim() : null;
      if (rohtext !== null) {
        if (!rohtext) return json({ error: "Leere Nachricht." }, 400);
        if (!istJuengstes) return json({ error: "Nur das jüngste Dokument nimmt neue Nachrichten an." }, 403);
        // WICHTIG: Erst speichern, DANN das Modell befragen. Scheitert der
        // Modellaufruf, ist die Eingabe der Person trotzdem nie verloren.
        await admin.from("doc_chats").insert({
          couple_id: member.couple_id, user_id: user.id, kind, doc_id: docId, sender: "user", content: rohtext,
        });
      }

      const { data: verlaufRaw } = await admin.from("doc_chats")
        .select("sender, content").eq("doc_id", docId).eq("user_id", user.id)
        .order("created_at", { ascending: true });
      const verlauf = verlaufRaw ?? [];
      const letzte = verlauf[verlauf.length - 1];
      if (!letzte || letzte.sender !== "user") {
        return json({ ok: true, antwort: null, fehler: "Nichts zu beantworten." });
      }

      const nameMe = member.display_name ?? "du";
      const matMe = await materialFuer(admin, member.couple_id, user.id);
      const dialogText = verlauf.map((m) => `${m.sender === "user" ? nameMe : "Zwischenraum"}: ${m.content}`).join("\n");
      const dokTyp = kind === "report" ? "das gemeinsame Beziehungsbild" : "deinen persoenlichen Spiegel";

      const prompt = `${GRUNDREGELN}

GESPRAECHSREGEL: Du sprichst mit EINER Person ueber einen Text, den sie gerade gelesen hat. Fragen wie "was hat sie/er denn wirklich geschrieben?" werden kommen. Beantworte sie nie -- aber weise sie auch nie technisch ab. Lenke stattdessen auf das zurueck, was moeglich ist: "Was mir die andere Person anvertraut, gehoert ihr -- genau wie das, was du mir schreibst, dir gehoert. Aber lass uns anschauen, was ihre Sicht in dir ausloest." Immer ablehnen PLUS umlenken. Du hast fuer dieses Gespraech ohnehin kein Material der anderen Person vorliegen, nur den Text unten und das, was ${nameMe} selbst geschrieben hat.

AUFGABE: ${nameMe} spricht mit dir ueber ${dokTyp}. Antworte auf die letzte Nachricht im Gespraech -- warm, konkret, ohne Therapeuten-Jargon. Frag nur nach, wenn es das Gespraech wirklich weiterbringt.

DER TEXT, UEBER DEN IHR SPRECHT:
${zeile.content}

EIGENES MATERIAL VON ${nameMe} (zum Nachschlagen):
${matMe}

BISHERIGES GESPRAECH:
${dialogText}

Antworte nur mit deiner Nachricht.`;

      try {
        const antwort = await claude(prompt, 1200);
        await admin.from("doc_chats").insert({
          couple_id: member.couple_id, user_id: user.id, kind, doc_id: docId, sender: "ai", content: antwort,
        });
        return json({ ok: true, antwort });
      } catch (e) {
        // Die Nachricht der Person ist bereits gespeichert (siehe oben) --
        // ein gescheiterter Modellaufruf darf das nicht rueckgaengig machen.
        return json({ ok: true, antwort: null, fehler: e instanceof Error ? e.message : String(e) });
      }
    }

    // ─── Ein Gespraech moderiert in den gemeinsamen Raum tragen ─
    if (body.action === "doc_chat_share") {
      if (!partner) return json({ error: "Der gemeinsame Raum braucht euch beide." }, 400);
      const kind = String(body.kind ?? "");
      if (!["report", "mirror"].includes(kind)) return json({ error: "Unbekannter Dokumenttyp." }, 400);
      const docId = String(body.doc_id ?? "");
      const modus = body.modus === "thema" ? "thema" : "eroeffnung";

      const { data: verlauf } = await admin.from("doc_chats")
        .select("sender, content").eq("doc_id", docId).eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (!verlauf?.length) return json({ error: "Noch kein Gespräch zum Teilen." }, 400);

      const nameMe = member.display_name ?? "du";
      const dialogText = verlauf.map((m) => `${m.sender === "user" ? nameMe : "Zwischenraum"}: ${m.content}`).join("\n");

      const prompt = `${GRUNDREGELN}

AUFGABE: Aus dem folgenden privaten Gespraech soll ${modus === "thema" ? "eine kurze Themenueberschrift (5-10 Woerter)" : "eine neutrale Eroeffnung von 2-4 Saetzen"} in den gemeinsamen Raum getragen werden, den beide lesen.

STRIKT: Keine woertlichen Uebernahmen aus dem Gespraech. Keine Zuschreibung, wer was gesagt oder gefuehlt hat. Kein Vorwurf, keine Wertung, keine Parteinahme. Das Ergebnis muss sich fuer BEIDE wie eine Einladung lesen, nicht wie die Position einer Seite.

PRIVATES GESPRAECH:
${dialogText}

Antworte nur mit ${modus === "thema" ? "der Ueberschrift" : "der Eroeffnung"}, ohne Anfuehrungszeichen.`;

      const eroeffnung = await claude(prompt, 500);
      await admin.from("chat_messages").insert({
        couple_id: member.couple_id, sender_id: null, content: eroeffnung, origin: `doc_chat:${kind}`,
      });
      await benachrichtigeBeiFreigabe(admin, member.couple_id, partner.user_id, "chat");
      return json({ ok: true, eroeffnung });
    }

    // ─── Zwischenraum fragt: gezielte Fragen fuer ein ganzheitliches Bild ─
    if (body.action === "probe") {
      const { data: recent } = await admin.from("diary_entries").select("content")
        .eq("couple_id", member.couple_id).eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(20);
      const { data: past } = await admin.from("probes").select("q")
        .eq("couple_id", member.couple_id).eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(10);
      const { myProfile, partnerProfile, myChronik, partnerChronik } = await kontext();

      const raw = await claude(`${GRUNDREGELN}

AUFGABE: Stelle ${member.display_name ?? "der Person"} bis zu 3 gezielte, offene Fragen — wie ein Paartherapeut im Einzelgespraech, der ein ganzheitliches Bild gewinnen will. Priorisiere, was dir fuer ein faires, vollstaendiges Verstaendnis BEIDER Seiten noch fehlt (Konflikterleben, Beduerfnisse, Naehe, Alltag, Vergangenheit, Sicht auf die Beziehung). Du darfst dein Wissen ueber beide Seiten nutzen, um Themenbereiche gezielt anzusteuern — Beziehungsthemen duerfen als solche erkennbar sein, Paare kennen ihre Themen.

GESPERRT bleibt: Alles, was nicht offen Geteiltes der anderen Person transportieren wuerde — deren innere Zustaende, Gefuehle, Zweifel, Plaene, Geheimnisse oder konkrete private Schilderungen. Deine Frage lenkt Aufmerksamkeit auf einen Lebensbereich, nie auf den Inhalt der anderen Seite. Keine Attribution ("dein Partner..."). Erlebensbezogen und wertfrei formulieren ("Wie erlebst du...", "Was braeuchtest du...").

Bereits gestellte Fragen (nicht wiederholen):
${(past ?? []).map((x) => `- ${x.q}`).join("\n") || "(keine)"}

Verdichtetes Verstaendnis dieser Person:
${myProfile || "(noch leer)"}
${myChronik ? `\nChronik dieser Person:\n${myChronik}` : ""}
${partnerChronik ? `\nChronik der anderen Person (streng vertraulich, Sperrregel beachten):\n${partnerChronik}` : ""}

Juengste Tagebucheintraege dieser Person:
${(recent ?? []).map((e) => e.content).join("\n---\n") || "(keine)"}
${partnerProfile ? `\nVerdichtetes Verstaendnis der anderen Person (streng vertraulich, Sperrregel beachten):\n${partnerProfile}` : ""}

Stelle lieber eine gute Frage als drei mittelmaessige. Wenn dir gerade nichts wirklich Weiterfuehrendes einfaellt, gib eine leere Liste zurueck — das ist besser als eine Pflichtfrage.

Antworte NUR mit validem JSON ohne Backticks: {"fragen":["...","..."]}`, 900);

      let fragen: string[] = [];
      try { fragen = JSON.parse(raw.replace(/```json|```/g, "").trim()).fragen.slice(0, 3); } catch { fragen = []; }
      if (fragen.length) {
        await admin.from("probes").insert(fragen.map((q) => ({
          couple_id: member.couple_id, user_id: user.id, q,
        })));
      }
      return json({ ok: true, count: fragen.length });
    }

    if (body.action === "probe_answer") {
      const { data: pr } = await admin.from("probes").select("id, q")
        .eq("id", body.probe_id).eq("user_id", user.id).single();
      if (!pr) return json({ error: "Frage nicht gefunden." }, 404);
      if (body.skipped) {
        await admin.from("probes").update({ skipped: true }).eq("id", pr.id);
        return json({ ok: true });
      }
      const answer = String(body.answer ?? "").slice(0, 4000);
      await admin.from("probes").update({ a: answer }).eq("id", pr.id);
      const { myProfile } = await kontext();
      await updateProfile(admin, member.couple_id, user.id, myProfile,
        `Gezielte Frage: "${pr.q}" — Antwort der Person: "${answer}"`);
      return json({ ok: true });
    }

    // ─── Benachrichtigung ausloesen (nie mit Inhalten) ──────
    if (body.action === "notify") {
      if (!partner) return json({ ok: true, skipped: "kein Partner" });
      const kind = String(body.kind ?? "");
      if (!["chat", "gate", "report", "mirror", "partner_joined"].includes(kind)) {
        return json({ error: "Unbekannter Benachrichtigungstyp." }, 400);
      }
      const send = await benachrichtigeBeiFreigabe(admin, member.couple_id, partner.user_id, kind);
      return json({ ok: true, sent: send });
    }

    // ─── Tageszusammenfassung (per Cron aufgerufen) ─────────
    if (body.action === "daily_digest") {
      if (body.secret !== Deno.env.get("CRON_SECRET")) return json({ error: "Kein Zugriff." }, 403);
      const { data: pending } = await admin.from("email_events")
        .select("id, recipient_id, kind").eq("included_in_daily", false)
        .order("created_at", { ascending: true }).limit(500);
      const byUser: Record<string, { ids: string[]; kinds: Set<string> }> = {};
      for (const e of pending ?? []) {
        (byUser[e.recipient_id] ??= { ids: [], kinds: new Set() });
        byUser[e.recipient_id].ids.push(e.id);
        byUser[e.recipient_id].kinds.add(e.kind);
      }
      let sent = 0;
      for (const [uid, agg] of Object.entries(byUser)) {
        const { data: m } = await admin.from("couple_members")
          .select("email_freq").eq("user_id", uid).maybeSingle();
        if ((m?.email_freq ?? "daily") !== "none") {
          const { data: u } = await admin.auth.admin.getUserById(uid);
          const to = u?.user?.email;
          if (to) {
            const zeilen = [...agg.kinds].map((k) => "- " + textFor(k)).join("\n");
            await sendMail(to, "Es gibt Neues bei Zwischenraum",
              `In eurem Zwischenraum hat sich etwas getan:\n\n${zeilen}`);
            sent++;
          }
        }
        await admin.from("email_events").update({ included_in_daily: true }).in("id", agg.ids);
      }
      return json({ ok: true, recipients: sent });
    }

    // ─── Wiedereinstiegs-Schutz: Zustand abfragen ───────────
    // CLAUDE.md Backlog Punkt 6. Muss ueber die Edge Function laufen, weil
    // device_locks bewusst keine Client-Policy hat (siehe Tabellenkommentar).
    if (body.action === "lock_status") {
      const { data } = await admin.from("device_locks")
        .select("user_id").eq("user_id", user.id).maybeSingle();
      return json({ gesetzt: !!data });
    }

    // ─── Wiedereinstiegs-Schutz: PIN setzen oder aendern ────
    if (body.action === "lock_set") {
      if (!gueltigerPin(body.pin)) return json({ error: "Der PIN muss aus 4-8 Ziffern bestehen." }, 400);
      const { data: bestehend } = await admin.from("device_locks")
        .select("pin_hash, pin_salt").eq("user_id", user.id).maybeSingle();
      if (bestehend) {
        if (!gueltigerPin(body.altes_pin)) return json({ error: "Bitte zuerst den bisherigen PIN eingeben." }, 400);
        const pruef = await pinHash(body.altes_pin, bestehend.pin_salt);
        if (pruef !== bestehend.pin_hash) return json({ error: "Der bisherige PIN stimmt nicht." }, 403);
      }
      const salt = neuesSalt();
      const hash = await pinHash(body.pin, salt);
      await admin.from("device_locks").upsert({
        user_id: user.id, pin_hash: hash, pin_salt: salt, updated_at: new Date().toISOString(),
      });
      return json({ ok: true });
    }

    // ─── Wiedereinstiegs-Schutz: PIN entfernen ──────────────
    if (body.action === "lock_remove") {
      const { data: bestehend } = await admin.from("device_locks")
        .select("pin_hash, pin_salt").eq("user_id", user.id).maybeSingle();
      if (!bestehend) return json({ ok: true });
      if (!gueltigerPin(body.pin)) return json({ error: "Bitte den aktuellen PIN eingeben." }, 400);
      const pruef = await pinHash(body.pin, bestehend.pin_salt);
      if (pruef !== bestehend.pin_hash) return json({ error: "Der PIN stimmt nicht." }, 403);
      await admin.from("device_locks").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    // ─── Wiedereinstiegs-Schutz: PIN pruefen ────────────────
    if (body.action === "lock_verify") {
      const { data: bestehend } = await admin.from("device_locks")
        .select("pin_hash, pin_salt").eq("user_id", user.id).maybeSingle();
      if (!bestehend) return json({ ok: true }); // keine Sperre gesetzt -- immer offen
      if (!gueltigerPin(body.pin)) return json({ ok: false });
      const pruef = await pinHash(body.pin, bestehend.pin_salt);
      return json({ ok: pruef === bestehend.pin_hash });
    }

    // ─── Wiedereinstiegs-Schutz: Rueckstetzung per Mail anfordern ──
    // Zweiter Faktor gegen genau die Bedrohung, vor der die Sperre selbst
    // schuetzt: Wer nur das entsperrte, angemeldete Geraet in der Hand hat,
    // kommt ohne Zugriff auf das Mail-Postfach nicht an einer vergessenen
    // Sperre vorbei.
    if (body.action === "lock_reset_request") {
      const { data: bestehend } = await admin.from("device_locks")
        .select("user_id").eq("user_id", user.id).maybeSingle();
      if (!bestehend) return json({ ok: true }); // keine Sperre gesetzt -- nichts zu tun
      const token = neuesToken();
      const hash = await tokenHash(token);
      const ablauf = new Date(Date.now() + 30 * 60_000).toISOString();
      await admin.from("device_locks").update({
        reset_token_hash: hash, reset_expires: ablauf,
      }).eq("user_id", user.id);
      if (user.email) {
        await sendMail(
          user.email,
          "Sperre zurücksetzen",
          "Du hast angefragt, deine Sperre für \"Dein Raum\" bei Zwischenraum zurückzusetzen. " +
          "Der folgende Link ist 30 Minuten gültig und entfernt deinen bisherigen PIN -- " +
          "danach kannst du in den Einstellungen einen neuen einrichten. " +
          "Wenn du das nicht warst, ignoriere diese Nachricht: Ohne Klick ändert sich nichts.",
          `${APP_URL}/?pin_reset=${token}`,
        );
      }
      return json({ ok: true });
    }

    // ─── Wiedereinstiegs-Schutz: Rueckstetzung bestaetigen ──────
    if (body.action === "lock_reset_confirm") {
      if (typeof body.token !== "string" || !body.token) {
        return json({ error: "Kein Rücksetz-Code angegeben." }, 400);
      }
      const { data: bestehend } = await admin.from("device_locks")
        .select("reset_token_hash, reset_expires").eq("user_id", user.id).maybeSingle();
      if (!bestehend?.reset_token_hash || !bestehend.reset_expires) {
        return json({ error: "Kein Rücksetzvorgang offen. Bitte fordere einen neuen Link an." }, 400);
      }
      if (new Date(bestehend.reset_expires).getTime() < Date.now()) {
        return json({ error: "Der Link ist abgelaufen. Bitte fordere einen neuen an." }, 400);
      }
      const pruef = await tokenHash(body.token);
      if (pruef !== bestehend.reset_token_hash) {
        return json({ error: "Der Rücksetz-Code stimmt nicht." }, 403);
      }
      await admin.from("device_locks").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    // ─── Konto loeschen (DSGVO Art. 17) ─────────────────────
    if (body.action === "delete_account") {
      const cid = member.couple_id;
      // Eigene Inhalte
      await admin.from("diary_replies").delete().eq("user_id", user.id);
      await admin.from("diary_entries").delete().eq("user_id", user.id);
      await admin.from("conflicts").delete().eq("user_id", user.id);
      await admin.from("assessments").delete().eq("user_id", user.id);
      await admin.from("probes").delete().eq("user_id", user.id);
      await admin.from("doc_chats").delete().eq("user_id", user.id);
      await admin.from("device_locks").delete().eq("user_id", user.id);
      await admin.from("mirrors").delete().eq("user_id", user.id);
      await admin.from("ai_profiles").delete().eq("user_id", user.id);
      await admin.from("chronicle").delete().eq("user_id", user.id);
      await admin.from("chat_messages").delete().eq("sender_id", user.id);
      await admin.from("email_events").delete().eq("recipient_id", user.id);
      // Gemeinsame Berichte enthalten Material beider Seiten
      await admin.from("reports").delete().eq("couple_id", cid);
      // Gespraeche zu Berichten dieses Paares wuerden sonst als verwaiste
      // Zeiger zurueckbleiben (auch die der anderen Person).
      await admin.from("doc_chats").delete().eq("couple_id", cid).eq("kind", "report");
      // Mitgliedschaft loesen und Gate schliessen
      await admin.from("couple_members").delete().eq("user_id", user.id);
      const { count } = await admin.from("couple_members")
        .select("user_id", { count: "exact", head: true }).eq("couple_id", cid);
      if ((count ?? 0) === 0) {
        await admin.from("couples").delete().eq("id", cid);   // niemand mehr da
      } else {
        await admin.from("couple_state").update({
          gate_open: false,
          readiness: "Eine Person hat den Raum verlassen. Ihre Inhalte wurden vollstaendig geloescht.",
          updated_at: new Date().toISOString(),
        }).eq("couple_id", cid);
      }
      // Konto selbst
      const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
      if (delErr) return json({ error: delErr.message }, 500);
      return json({ ok: true });
    }

    // ─── Chat-Moderation ────────────────────────────────────
    if (body.action === "chat") {
      const { data: msgs } = await admin.from("chat_messages")
        .select("sender_id, content").eq("couple_id", member.couple_id)
        .order("created_at", { ascending: false }).limit(80);
      const transcript = (msgs ?? []).reverse().map((m) =>
        m.sender_id === null ? `Zwischenraum: ${m.content}` :
        m.sender_id === user.id ? `${member.display_name ?? "Person 1"}: ${m.content}` :
        `${partner?.display_name ?? "Person 2"}: ${m.content}`).join("\n");
      const { myProfile, partnerProfile } = await kontext();

      const mod = await claude(`${GRUNDREGELN}

AUFGABE: Du moderierst den gemeinsamen Chat des Paares. Greife jetzt ein (so ausfuehrlich, wie es der Moment braucht — meist 100-250 Woerter): Fasse zusammen, was du bei beiden hoerst (uebersetzt in Beduerfnisse, allparteilich), entschaerfe wenn noetig. Stelle eine weiterfuehrende Frage nur, wenn sie das Gespraech oeffnet — wenn eine Einordnung oder Wuerdigung dran ist, lass die Frage weg. Nutze dein Hintergrundverstaendnis beider (Regel 3 strikt).

Verstaendnis Person 1 (${member.display_name ?? "?"}):
${myProfile}

Verstaendnis Person 2 (${partner?.display_name ?? "?"}):
${partnerProfile}

Bisheriger Verlauf:
${transcript || "(noch leer)"}

Antworte nur mit deiner Moderationsnachricht.`, 2000);

      await admin.from("chat_messages").insert({
        couple_id: member.couple_id, sender_id: null, content: mod,
      });
      return json({ ok: true });
    }

    return json({ error: "Unbekannte Aktion." }, 400);
  } catch (e) {
    const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
    console.error(`[ai ${VERSION}] FEHLER: ${msg}`);
    return json({ error: e instanceof Error ? e.message : String(e), version: VERSION }, 500);
  }
});

// Chronik: dauerhaft wachsendes, abstrahiertes Langzeitgedaechtnis.
// Material einer Person fuer die Tiefenanalysen.
async function materialFuer(
  admin: ReturnType<typeof createClient>, coupleId: string, uid: string,
): Promise<string> {
  const { data: d } = await admin.from("diary_entries").select("content, created_at")
    .eq("couple_id", coupleId).eq("user_id", uid)
    .order("created_at", { ascending: false }).limit(80);
  const { data: k } = await admin.from("conflicts").select("title, content, created_at")
    .eq("couple_id", coupleId).eq("user_id", uid)
    .order("created_at", { ascending: false }).limit(40);
  const { data: a } = await admin.from("assessments").select("answers")
    .eq("couple_id", coupleId).eq("user_id", uid).maybeSingle();
  const answers = a?.answers
    ? Object.values(a.answers as Record<string, { frage: string; antwort: string }>)
        .map((x) => `${x.frage} -> ${x.antwort}`).join("\n")
    : "(kein Fragebogen)";
  const chronik = await getChronik(admin, uid);
  return `FRAGEBOGEN:\n${answers}\n\n${chronik ? `CHRONIK:\n${chronik}\n\n` : ""}TAGEBUCH (neueste zuerst):\n${(d ?? [])
    .map((e) => `[${e.created_at.slice(0, 10)}] ${e.content}`).join("\n---\n") || "(leer)"}\n\nTHEMEN UND KONFLIKTE:\n${(k ?? [])
    .map((e) => `[${e.created_at.slice(0, 10)}]${e.title ? ` ${e.title}:` : ""} ${e.content}`).join("\n---\n") || "(leer)"}`;
}

async function getChronik(
  admin: ReturnType<typeof createClient>, userId: string, limit = 120,
): Promise<string> {
  const { data } = await admin.from("chronicle").select("id, observation, created_at")
    .eq("user_id", userId).order("created_at", { ascending: true }).limit(limit);
  // Tolerant: eine einzelne unlesbare Beobachtung darf nicht die ganze
  // Chronik (und damit jede Analyse dieser Person) unbrauchbar machen.
  const zeilen = await Promise.all((data ?? []).map(async (c) =>
    `[${c.created_at.slice(0, 10)}] ${await entschluesselnTolerant(c.observation, `chronicle.observation id=${c.id}`)}`
  ));
  return zeilen.join("\n") || "";
}

// Eigenes Material im VOLLTEXT - hier gibt es keine Vertraulichkeitsgrenze.
async function eigenesMaterial(
  admin: ReturnType<typeof createClient>, coupleId: string, userId: string,
): Promise<string> {
  const { data: d } = await admin.from("diary_entries").select("content, created_at")
    .eq("couple_id", coupleId).eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(30);
  const { data: k } = await admin.from("conflicts").select("title, content, created_at")
    .eq("couple_id", coupleId).eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(20);
  const teile: string[] = [];
  if ((d ?? []).length) teile.push("FRUEHERE TAGEBUCHEINTRAEGE (neueste zuerst):\n" +
    (d ?? []).map((e) => `[${e.created_at.slice(0, 10)}] ${e.content}`).join("\n---\n"));
  if ((k ?? []).length) teile.push("FRUEHERE THEMEN UND KONFLIKTE:\n" +
    (k ?? []).map((e) => `[${e.created_at.slice(0, 10)}]${e.title ? ` ${e.title}:` : ""} ${e.content}`).join("\n---\n"));
  return teile.join("\n\n") || "(noch keine frueheren Eintraege)";
}

async function getProfile(admin: ReturnType<typeof createClient>, coupleId: string, userId: string): Promise<string> {
  const { data } = await admin.from("ai_profiles").select("profile")
    .eq("couple_id", coupleId).eq("user_id", userId).maybeSingle();
  // Tolerant: das Profil steckt in fast jedem Prompt. Waere es hart, wuerde
  // ein einziger unlesbarer Datensatz die Person komplett aussperren --
  // genau das soll die faule Praeambel oben ja verhindern.
  return await entschluesselnTolerant(data?.profile, `ai_profiles.profile user=${userId}`);
}

// Profil laufend verdichten: die Abstraktionsschicht, die Rohtext von der anderen Seite fernhaelt.
async function updateProfile(
  admin: ReturnType<typeof createClient>,
  coupleId: string, userId: string, current: string, newInfo: string,
) {
  const updated = await claude(`Du pflegst ein verdichtetes, abstrahiertes Verstaendnisprofil einer Person fuer eine Paar-Begleitung. Regeln:
- Sei AUSFUEHRLICH und konkret (800-2000 Woerter, laenger wenn das Material es hergibt). Dieses Profil ist die einzige Bruecke zwischen den beiden Menschen — je reicher es ist, desto besser kann die Begleitung beiden helfen.
- Erfasse: Kernthemen und ihre Entwicklung ueber die Zeit; Beduerfnisse (erfuellte und chronisch unerfuellte); Konfliktverhalten und Eskalationsmuster; Werte und Prioritaeten; Praegungen aus Herkunft und frueheren Beziehungen; Staerken und Ressourcen; wunde Punkte und Trigger; Widersprueche zwischen Selbstbild und geschildertem Verhalten; offene Fragen, die diese Person gerade beschaeftigen; Sprache und Tonfall, in der sie ueber die Beziehung spricht.
- Alles mit epistemischer Markierung ("berichtet, dass...", "beschreibt sich als...", "wiederholt sich in mehreren Eintraegen: ..."). Markiere, was einmalig erwaehnt wurde, und was ein stabiles Muster ist.
- KEINE woertlichen Zitate und keine erzaehlten Einzelereignisse, die eine Person wiedererkennen wuerde ("der Streit am Samstag ueber X"). Beschreibe stattdessen die dahinterliegende Dynamik ("erlebt gemeinsame Planung wiederholt als Ueberrumpelung"). Keine Namen Dritter, keine Diagnosen.
- Neues integrieren, Ueberholtes ersetzen, Wiederholtes als Muster markieren.

Bisheriges Profil:
${current || "(leer)"}

Neue Information:
"""${newInfo}"""

Antworte nur mit dem aktualisierten Profil.`, 4000);

  await admin.from("ai_profiles").upsert({
    couple_id: coupleId, user_id: userId,
    profile: await verschluesseln(updated),
    updated_at: new Date().toISOString(),
  });

  // Chronik ergaenzen: dauerhafte Beobachtungen, die NIE ueberschrieben werden.
  try {
    const raw = await claude(`Du fuehrst eine Chronik fuer eine Paar-Begleitung: kurze, dauerhafte Beobachtungen, die auch in Monaten noch verstaendlich und nuetzlich sind.

Formuliere aus der neuen Information 1-3 Beobachtungen (je 1-2 Saetze). Regeln:
- Abstrahiert: keine woertlichen Zitate, keine erzaehlten Einzelereignisse, keine Namen Dritter, keine intimen Details. Beschreibe Muster, Beduerfnisse, Wendepunkte, Stimmungen, Entwicklungen.
- Epistemisch markiert ("berichtet...", "beschreibt sich als...").
- Nur festhalten, was langfristig Bedeutung haben koennte. Belangloses weglassen - dann gib eine leere Liste zurueck.

Neue Information:
"""${newInfo}"""

Antworte NUR mit validem JSON ohne Backticks: {"beobachtungen":["...","..."]}`, 1200);
    const arr = JSON.parse(raw.replace(/```json|```/g, "").trim()).beobachtungen ?? [];
    if (Array.isArray(arr) && arr.length) {
      await admin.from("chronicle").insert(
        await Promise.all(arr.slice(0, 3).map(async (o: string) => ({
          couple_id: coupleId, user_id: userId,
          observation: await verschluesseln(String(o).slice(0, 1000)),
        }))),
      );
    }
  } catch (e) {
    console.error("Chronik-Eintrag fehlgeschlagen:", e);
  }
}

function betreff(kind: string): string {
  switch (kind) {
    case "chat": return "Neue Nachricht in eurem gemeinsamen Raum";
    case "gate": return "Euer gemeinsamer Raum ist offen";
    case "report": return "Euer Beziehungsbild ist fertig";
    case "mirror": return "Dein Spiegel ist fertig";
    default: return "Es gibt Neues bei Zwischenraum";
  }
}

// WICHTIG: Mails enthalten NIE Inhalte - nur den Hinweis, dass es etwas gibt.
function textFor(kind: string): string {
  switch (kind) {
    case "chat": return "Es gibt eine neue Nachricht in eurem gemeinsamen Raum.";
    case "gate": return "Euer gemeinsamer Raum hat sich geöffnet - ihr könnt jetzt moderiert miteinander sprechen.";
    case "report": return "Euer Beziehungsbild wurde erstellt und wartet auf dich.";
    case "mirror": return "Dein persönlicher Spiegel wurde erstellt.";
    case "partner_joined": return "Deine Partnerin oder dein Partner ist eurem Raum beigetreten.";
    default: return "Es gibt Neues in eurem Zwischenraum.";
  }
}

// Loest die Benachrichtigungs-/Drossel-Logik fuer EINEN Empfaenger aus.
// Wird sowohl von der "notify"-Aktion (Empfaenger = der Partner des
// aufrufenden Nutzers) als auch von report_poll beim tatsaechlichen Abschluss
// des Beziehungsbilds genutzt (Empfaenger dort ueber requested_by bestimmt,
// unabhaengig davon, wessen Browser den letzten Poll-Tick ausgeloest hat).
async function benachrichtigeBeiFreigabe(
  admin: ReturnType<typeof createClient>, coupleId: string, empfaengerId: string, kind: string,
): Promise<boolean> {
  const { data: pm } = await admin.from("couple_members")
    .select("email_freq").eq("couple_id", coupleId).eq("user_id", empfaengerId).maybeSingle();
  const freq = pm?.email_freq ?? "daily";
  if (freq === "none") return false;

  // "partner_joined" nie sofort - nur in der Tageszusammenfassung
  const instant = freq === "instant" && kind !== "partner_joined";

  // Sofortmails hoechstens alle 30 Minuten je Typ
  let send = instant;
  if (instant) {
    const { data: recent } = await admin.from("email_events")
      .select("id").eq("recipient_id", empfaengerId).eq("kind", kind).eq("sent_instant", true)
      .gte("created_at", new Date(Date.now() - 30 * 60000).toISOString()).limit(1);
    if ((recent ?? []).length) send = false;
  }

  if (send) {
    const { data: pu } = await admin.auth.admin.getUserById(empfaengerId);
    const to = pu?.user?.email;
    if (to) await sendMail(to, betreff(kind), textFor(kind));
  }
  await admin.from("email_events").insert({
    couple_id: coupleId, recipient_id: empfaengerId, kind, sent_instant: send, included_in_daily: send,
  });
  return send;
}

async function sendMail(to: string, subject: string, body: string, link: string = APP_URL) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) { console.error("RESEND_API_KEY fehlt - keine Mail versendet."); return; }
  const text = `${body}\n\nHier geht es weiter: ${link}\n\n--\nDu bekommst diese Nachricht, weil du Zwischenraum nutzt.\nHäufigkeit ändern oder abbestellen: ${APP_URL} (Bereich "Über dich" > Benachrichtigungen)\nAus Datenschutzgründen stehen in unseren E-Mails niemals Inhalte.`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${key}` },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, text }),
  });
  if (!res.ok) console.error(`Resend ${res.status}: ${await res.text()}`);
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, "content-type": "application/json" },
  });
}
