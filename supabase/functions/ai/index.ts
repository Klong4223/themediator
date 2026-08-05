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
const OPENAI_MODEL = "gpt-5.6-terra";        // Standard fuer laufende Interaktionen
const OPENAI_MODEL_STRONG = "gpt-5.6";       // Tiefenanalyse (Beziehungsbild)
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_MODEL_STRONG = "claude-opus-4-8";

const GRUNDREGELN = `Du bist "Zwischenraum", eine neutrale, allparteiliche Begleitinstanz fuer Paare. Regeln, die immer gelten:
1. EPISTEMIK: Alles, was eine Person schreibt, ist ihre Perspektive, kein Faktum. Uebernimm nie die Deutung einer Seite als Wahrheit. Formuliere entsprechend ("du beschreibst", "aus deiner Sicht"). Nur was beide unabhaengig berichten, darfst du als gemeinsames Muster behandeln.
2. NEUTRALITAET: Keine Schuldzuweisung, keine Parteinahme, kein Vorurteil. Wenn du bei einer Person nachbohrst, tue es bei der anderen mit gleichem Massstab.
3. ABSTRAKTION: Wenn dir Informationen ueber die andere Person vorliegen, nutze sie nur als verdichtetes Verstaendnis. Zitiere NIE, gib NIE konkrete Formulierungen, Ereignisdetails oder Inhalte wieder, die die andere Person geschrieben hat. Hinweise formulierst du als offene Fragen oder allgemeine Beobachtungen.
4. GRENZEN: Du bist Beziehungsbegleitung, keine Therapie. Keine Diagnosen, keine tiefenpsychologischen Deutungen. Bleibe auf der Ebene von Verhalten, Beduerfnissen und Mustern.
5. SICHERHEIT: Bei Hinweisen auf koerperliche Gewalt, Missbrauch, Selbst- oder Fremdgefaehrdung verlaesst du die Neutralitaet, benennst das klar und fuersorglich und verweist auf professionelle Hilfe (in DE: Hilfetelefon Gewalt gegen Frauen 116 016, Telefonseelsorge 0800 111 0 111, Notruf 112).
6. SPRACHE: Antworte in der Sprache der Person (Deutsch oder Englisch), sprich sie mit "du" an. Kompakt und konkret, kein Therapeuten-Jargon.`;

async function claude(prompt: string, maxTokens = 900, strong = false): Promise<string> {
  if (PROVIDER === "openai") {
    if (!Deno.env.get("OPENAI_API_KEY")) {
      throw new Error("Secret OPENAI_API_KEY ist nicht gesetzt (Supabase > Edge Functions > Secrets).");
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}`,
      },
      body: JSON.stringify({
        model: strong ? OPENAI_MODEL_STRONG : OPENAI_MODEL,
        max_completion_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const out = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!out) throw new Error(`OpenAI lieferte eine leere Antwort (Modell: ${strong ? OPENAI_MODEL_STRONG : OPENAI_MODEL}).`);
    return out;
  }
  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    throw new Error("Secret ANTHROPIC_API_KEY ist nicht gesetzt (Supabase > Edge Functions > Secrets).");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
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

const VERSION = "2026-08-05";
const APP_URL = "https://zwischenraum.work";
const MAIL_FROM = "Zwischenraum <hallo@zwischenraum.work>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  if (url.searchParams.get("ping") === "1") return json({ ok: true, version: VERSION, provider: PROVIDER, key_set: !!Deno.env.get("OPENAI_API_KEY") });
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

    const { data: member } = await admin
      .from("couple_members").select("couple_id, role, display_name")
      .eq("user_id", user.id).maybeSingle();
    if (!member) return json({ error: "Kein Paar-Raum." }, 400);

    const { data: partner } = await admin
      .from("couple_members").select("user_id, display_name")
      .eq("couple_id", member.couple_id).neq("user_id", user.id).maybeSingle();

    const myProfile = await getProfile(admin, member.couple_id, user.id);
    const partnerProfile = partner ? await getProfile(admin, member.couple_id, partner.user_id) : "";



    // ─── Tagebuch: Impression + Profil-Update ───────────────
    if (body.action === "diary") {
      const { data: entry } = await admin.from("diary_entries")
        .select("id, content").eq("id", body.entry_id).eq("user_id", user.id).single();
      if (!entry) return json({ error: "Eintrag nicht gefunden." }, 404);

      const feedback = await claude(`${GRUNDREGELN}

AUFGABE: Die Person hat einen Tagebucheintrag geschrieben. Gib eine persoenliche Impression. Passe die Laenge dem Gewicht des Eintrags an (60 Woerter bei Alltagsnotizen, bis 250 Woerter bei bedeutsamen Eintraegen). Sprich die Person mit Namen an, wenn er dir vorliegt. Beziehe dich, wo passend, auf ihre frueheren Themen und ihre Entwicklung ("in deinen letzten Eintraegen...", "du beschreibst zum wiederholten Mal..."). Spiegle, was du hoerst, wuerdige Ehrlichkeit und Zwischentoene, benenne Muster als Beobachtung oder Frage, und stelle am Ende genau eine weiterfuehrende Rueckfrage zur Selbstreflexion. Sei warm und nah, ohne Gefaelligkeit — Allparteilichkeit und Epistemik-Regeln gelten unveraendert. ${partnerProfile ? "Du kennst ein verdichtetes Verstaendnis der anderen Person (unten). Du darfst daraus einen behutsamen Perspektivwechsel anregen (Regel 3 strikt beachten: nichts zitieren, nichts Konkretes offenbaren)." : ""}

Name der Person: ${member.display_name ?? "unbekannt"}

Verdichtetes Verstaendnis dieser Person bisher:
${myProfile || "(noch leer)"}
${partnerProfile ? `\nVerdichtetes Verstaendnis der anderen Person (nur fuer deinen Blick, streng vertraulich):\n${partnerProfile}` : ""}

Neuer Tagebucheintrag:
"""${entry.content}"""

Antworte nur mit der Impression.`);

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
      if (entry.thread_closed) return json({ error: "Dieser Faden ist abgeschlossen — ein neuer Eintrag oeffnet einen neuen." }, 400);

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

      const abschluss = userTurns >= 3;
      const aiText = await claude(`${GRUNDREGELN}

AUFGABE: Du fuehrst im Tagebuch eine kurze, begrenzte Vertiefung zu EINEM Eintrag — wie eine Therapiesitzung mit klarem Ende, kein offener Chat. ${abschluss
        ? `Dies ist die ABSCHLUSSRUNDE. Antworte auf die letzte Nachricht, fasse in 2-3 Saetzen wuerdigend zusammen, was in diesem Faden entstanden ist, und beende die Sitzung aktiv und warm (z.B. mit der Einladung, es wirken zu lassen und bei Bedarf morgen einen neuen Eintrag zu schreiben). Max. 130 Woerter. Stelle KEINE neue Frage.`
        : `Vertiefe: Antworte warm und konkret auf die letzte Nachricht (max. 110 Woerter). Du darfst genau eine weiterfuehrende Frage stellen. Noch ${3 - userTurns} Runde(n) bis zum Abschluss — arbeite auf einen natuerlichen Bogen hin.`}

Name der Person: ${member.display_name ?? "unbekannt"}

Verdichtetes Verstaendnis dieser Person:
${myProfile || "(noch leer)"}
${partnerProfile ? `\nVerdichtetes Verstaendnis der anderen Person (streng vertraulich, Abstraktionsregel 3 beachten):\n${partnerProfile}` : ""}

Bisheriger Faden:
${verlauf}

Antworte nur mit deiner Nachricht.`);

      await admin.from("diary_replies").insert({
        entry_id: entry.id, couple_id: member.couple_id, user_id: user.id, role: "ai", content: aiText,
      });
      if (abschluss) {
        await admin.from("diary_entries").update({ thread_closed: true }).eq("id", entry.id);
        await updateProfile(admin, member.couple_id, user.id, myProfile,
          `Vertiefender Dialog zum Tagebucheintrag (Verlauf): ${verlauf.slice(0, 3000)}`);
      }
      return json({ ok: true, reply: aiText, closed: abschluss });
    }

    // ─── Konflikt: Reflexion, Vermittlung, Beschoenigungs-Check ─
    if (body.action === "conflict") {
      const { data: k } = await admin.from("conflicts")
        .select("id, title, content").eq("id", body.conflict_id).eq("user_id", user.id).single();
      if (!k) return json({ error: "Konflikt nicht gefunden." }, 404);

      const { data: pastOwn } = await admin.from("conflicts")
        .select("title, content").eq("couple_id", member.couple_id)
        .eq("user_id", user.id).neq("id", k.id)
        .order("created_at", { ascending: false }).limit(5);

      const reflection = await claude(`${GRUNDREGELN}

AUFGABE: Die Person hat einen Konflikt aus ihrer Sicht beschrieben. Antworte in drei kurzen Teilen (gesamt max. 200 Woerter):
1. VERSTANDEN — was du aus ihrer Sicht hoerst (Beduerfnis hinter dem Aerger).
2. OFFEN GESPROCHEN — pruefe wohlwollend, aber ehrlich: Was koennte in dieser Schilderung beschoenigt, ausgelassen oder einseitig sein? Benenne Diskrepanzen zu frueheren Schilderungen oder zum Selbstbild, falls vorhanden. Sei dabei fair: du kennst nur eine Seite.
3. VERMITTLUNG — ein konkreter Reflexions- oder Gespraechsvorschlag. ${partnerProfile ? "Nutze dein verdichtetes Verstaendnis der anderen Person fuer einen Perspektivhinweis (Regel 3 strikt: nichts zitieren, nichts Konkretes offenbaren)." : ""}

Verdichtetes Verstaendnis dieser Person:
${myProfile || "(noch leer)"}
${partnerProfile ? `\nVerdichtetes Verstaendnis der anderen Person (streng vertraulich):\n${partnerProfile}` : ""}

Fruehere Konfliktschilderungen dieser Person (Auszug):
${(pastOwn ?? []).map((c) => `- ${c.title ?? "ohne Titel"}: ${c.content.slice(0, 300)}`).join("\n") || "(keine)"}

Neuer Konflikt${k.title ? ` ("${k.title}")` : ""}:
"""${k.content}"""

Antworte nur mit den drei Teilen.`, 1100);

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

      const verdict = await claude(`${GRUNDREGELN}

AUFGABE: Entscheide, ob der gemeinsame moderierte Chat geoeffnet werden kann. Kriterium: Kennst du beide Seiten gut genug, um fair und informiert zu moderieren? Es zaehlt SUBSTANZ, nicht Stueckzahl — ein einziger ausfuehrlicher Eintrag kann reichen. Mindestbedingung (bereits geprueft): ${heuristik ? "ERFUELLT" : "NICHT ERFUELLT"} (je Person mind. ein Tagebucheintrag und insgesamt spuerbares Material; aktueller Umfang ${mine.chars}/${theirs.chars} Zeichen). Pruefe anhand der Profile, ob dir von BEIDEN die Kernbereiche ausreichend bekannt sind (Konflikterleben, Beduerfnisse, Sicht auf die Beziehung). Wenn nein: benenne konkret und freundlich, WAS dir von wem noch fehlt — als Einladung, nicht als Checkliste.

Verdichtetes Verstaendnis Person 1:
${myProfile || "(leer)"}

Verdichtetes Verstaendnis Person 2:
${partnerProfile || "(leer)"}

Antworte NUR mit validem JSON ohne Backticks: {"open": true|false, "begruendung": "max. 60 Woerter, an beide gerichtet, motivierend und ehrlich — bei false: was noch fehlt, ohne Inhalte einer Seite zu offenbaren"}`);

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

AUFGABE: Der gemeinsame Raum oeffnet sich zum ersten Mal. Schreibe eine Eroeffnungsnachricht an beide (max. 90 Woerter): Wuerdige, dass beide sich eingebracht haben, benenne EIN Thema, das offenbar beide beschaeftigt (nur wenn beide es unabhaengig beruehrt haben — Regel 1), und schlage vor, womit sie beginnen koennten. Nichts zitieren, nichts Einseitiges offenbaren.

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

    // ─── Beziehungsbild: dreiteiliger Bericht (doppeltes Einverstaendnis) ─
    if (body.action === "report") {
      if (!partner) return json({ error: "Deine Partnerin oder dein Partner ist noch nicht beigetreten." }, 400);
      const { data: consents } = await admin.from("couple_members")
        .select("user_id, report_consent, display_name").eq("couple_id", member.couple_id);
      const all = consents ?? [];
      if (!(all.length === 2 && all.every((m) => m.report_consent))) {
        return json({ error: "Das Beziehungsbild braucht die aktive Freigabe von euch beiden." }, 403);
      }

      const material = async (uid: string) => {
        const { data: d } = await admin.from("diary_entries").select("content, created_at")
          .eq("couple_id", member.couple_id).eq("user_id", uid)
          .order("created_at", { ascending: false }).limit(40);
        const { data: k } = await admin.from("conflicts").select("title, content, created_at")
          .eq("couple_id", member.couple_id).eq("user_id", uid)
          .order("created_at", { ascending: false }).limit(20);
        const { data: a } = await admin.from("assessments").select("answers")
          .eq("couple_id", member.couple_id).eq("user_id", uid).maybeSingle();
        const answers = a?.answers
          ? Object.values(a.answers as Record<string, { frage: string; antwort: string }>)
              .map((x) => `${x.frage} -> ${x.antwort}`).join("\n")
          : "(kein Fragebogen)";
        return `FRAGEBOGEN:\n${answers}\n\nTAGEBUCH (neueste zuerst):\n${(d ?? [])
          .map((e) => `[${e.created_at.slice(0, 10)}] ${e.content}`).join("\n---\n") || "(leer)"}\n\nKONFLIKTSCHILDERUNGEN:\n${(k ?? [])
          .map((e) => `[${e.created_at.slice(0, 10)}]${e.title ? ` ${e.title}:` : ""} ${e.content}`).join("\n---\n") || "(leer)"}`;
      };

      const nameMe = member.display_name ?? "Person 1";
      const nameP = partner.display_name ?? "Person 2";
      const matMe = await material(user.id);
      const matP = await material(partner.user_id);

      // Stufe 1: interne Tiefenanalyse (sieht nie jemand — Arbeitsnotizen)
      const notizen = await claude(`${GRUNDREGELN}

AUFGABE: Du bereitest ein "Beziehungsbild" vor. Erstelle zunaechst interne Analyse-Notizen (niemand ausser dir liest sie — sei praezise und schonungslos ehrlich, aber halte die Epistemik-Regeln ein). Arbeite systematisch heraus:
1. KREUZVERGLEICH: Welche Situationen/Themen beschreiben beide — und wo weichen die Darstellungen voneinander ab? (Liste: Thema -> Sicht ${nameMe} -> Sicht ${nameP})
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

Antworte nur mit den nummerierten Notizen.`, 1400, true);

      // Stufe 2: der eigentliche Bericht auf Basis der Analyse
      const report = await claude(`${GRUNDREGELN}

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

MATERIAL ${nameMe} (zum Nachschlagen):
${matMe}

MATERIAL ${nameP} (zum Nachschlagen):
${matP}

Antworte nur mit dem Bericht (drei Teile mit Ueberschriften).`, 2600, true);

      const { data: saved } = await admin.from("reports").insert({
        couple_id: member.couple_id, content: report,
      }).select("id, content, created_at").single();
      return json({ ok: true, report: saved });
    }

    // ─── Dein Spiegel: individuelles Feedback aus beiden Perspektiven ─
    if (body.action === "mirror") {
      if (!partner) return json({ error: "Der Spiegel braucht euch beide — deine Partnerin oder dein Partner ist noch nicht beigetreten." }, 400);
      const { data: consents } = await admin.from("couple_members")
        .select("user_id, report_consent").eq("couple_id", member.couple_id);
      const all = consents ?? [];
      if (!(all.length === 2 && all.every((m) => m.report_consent))) {
        return json({ error: "Der Spiegel nutzt denselben Freigabe-Rahmen wie das Beziehungsbild: beide muessen ihr Material freigegeben haben." }, 403);
      }

      const material = async (uid: string) => {
        const { data: d } = await admin.from("diary_entries").select("content, created_at")
          .eq("couple_id", member.couple_id).eq("user_id", uid)
          .order("created_at", { ascending: false }).limit(40);
        const { data: k } = await admin.from("conflicts").select("title, content, created_at")
          .eq("couple_id", member.couple_id).eq("user_id", uid)
          .order("created_at", { ascending: false }).limit(20);
        const { data: a } = await admin.from("assessments").select("answers")
          .eq("couple_id", member.couple_id).eq("user_id", uid).maybeSingle();
        const answers = a?.answers
          ? Object.values(a.answers as Record<string, { frage: string; antwort: string }>)
              .map((x) => `${x.frage} -> ${x.antwort}`).join("\n")
          : "(kein Fragebogen)";
        return `FRAGEBOGEN:\n${answers}\n\nTAGEBUCH (neueste zuerst):\n${(d ?? [])
          .map((e) => `[${e.created_at.slice(0, 10)}] ${e.content}`).join("\n---\n") || "(leer)"}\n\nKONFLIKTSCHILDERUNGEN:\n${(k ?? [])
          .map((e) => `[${e.created_at.slice(0, 10)}]${e.title ? ` ${e.title}:` : ""} ${e.content}`).join("\n---\n") || "(leer)"}`;
      };

      const nameMe = member.display_name ?? "du";
      const matMe = await material(user.id);
      const matP = await material(partner.user_id);

      // Stufe 1: interne Analyse — Blickrichtung ausschliesslich auf die anfragende Person
      const notizen = await claude(`${GRUNDREGELN}

AUFGABE: Du bereitest einen "Spiegel" fuer ${nameMe} vor: individuelles Feedback, das NUR ${nameMe} lesen wird. Du kennst das Material beider Seiten — aber die Blickrichtung deiner Analyse zeigt AUSSCHLIESSLICH auf ${nameMe}. Das Material der anderen Person dient dir nur als Linse, um ${nameMe} besser zu verstehen. Erstelle interne Notizen zu:
1. SELBSTBILD vs. WIRKUNG: Wo koennte das Verhalten von ${nameMe} anders ankommen, als es gemeint ist?
2. EIGENER ANTEIL: Welchen wiederkehrenden Beitrag leistet ${nameMe} zur gemeinsamen Dynamik — auch unbeabsichtigt?
3. BLINDE FLECKEN: Was uebersieht oder vermeidet ${nameMe} moeglicherweise (auch sich selbst gegenueber)?
4. PRAEGUNGEN: Welche eigenen Muster aus Vergangenheit/Herkunftsfamilie wirken bei ${nameMe} erkennbar hinein?
5. STAERKEN: Was gelingt ${nameMe} in der Beziehung gut und traegt?
6. WACHSTUMSKANTEN: Die 1-2 konkreten Punkte mit dem groessten Hebel fuer ${nameMe} selbst.

ABSOLUTE SPERRREGEL: Jede Erkenntnis, die sich NUR durch eine private Aussage der anderen Person belegen laesst (deren Gefuehle, Zweifel, Plaene, Bewertungen, Geheimnisse), ist GESPERRT und darf weder direkt noch indirekt, angedeutet oder umformuliert verwendet werden. Verwende von der anderen Seite nur, was ${nameMe} aus dem gemeinsamen Leben ohnehin wissen kann (beobachtbares Verhalten, offen Gesagtes, von beiden Berichtetes).

MATERIAL ${nameMe}:
${matMe}

MATERIAL DER ANDEREN PERSON (nur als Linse, Sperrregel beachten):
${matP}

Antworte nur mit den nummerierten Notizen.`, 1400, true);

      // Stufe 2: der Spiegel selbst
      const mirrorText = await claude(`${GRUNDREGELN}

AUFGABE: Schreibe aus deinen internen Notizen (unten) den "Spiegel" fuer ${nameMe} — einen persoenlichen Text (400-700 Woerter), den nur ${nameMe} liest. Sprich ${nameMe} direkt an. Aufbau frei, aber enthalte: was ${nameMe} gut gelingt und traegt; wie das eigene Verhalten vermutlich ankommt (Selbstbild vs. Wirkung); den eigenen Anteil an der Dynamik; blinde Flecken — wohlwollend, aber ohne Weichzeichnen; und am Ende 1-2 konkrete Wachstumskanten mit einem umsetzbaren ersten Schritt. Keine Aussagen darueber, was die andere Person fuehlt, denkt, plant oder privat geschrieben hat — die SPERRREGEL aus den Notizen gilt unveraendert. Kein Urteil ueber die Beziehung, keine Empfehlung zu bleiben oder zu gehen.

DEINE INTERNEN NOTIZEN:
${notizen}

Antworte nur mit dem Spiegel-Text.`, 1600, true);

      const { data: saved } = await admin.from("mirrors").insert({
        couple_id: member.couple_id, user_id: user.id, content: mirrorText,
      }).select("id, content, created_at").single();
      return json({ ok: true, mirror: saved });
    }

    // ─── Zwischenraum fragt: gezielte Fragen fuer ein ganzheitliches Bild ─
    if (body.action === "probe") {
      const { data: recent } = await admin.from("diary_entries").select("content")
        .eq("couple_id", member.couple_id).eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(5);
      const { data: past } = await admin.from("probes").select("q")
        .eq("couple_id", member.couple_id).eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(10);

      const raw = await claude(`${GRUNDREGELN}

AUFGABE: Stelle ${member.display_name ?? "der Person"} bis zu 3 gezielte, offene Fragen — wie ein Paartherapeut im Einzelgespraech, der ein ganzheitliches Bild gewinnen will. Priorisiere, was dir fuer ein faires, vollstaendiges Verstaendnis BEIDER Seiten noch fehlt (Konflikterleben, Beduerfnisse, Naehe, Alltag, Vergangenheit, Sicht auf die Beziehung). Du darfst dein Wissen ueber beide Seiten nutzen, um Themenbereiche gezielt anzusteuern — Beziehungsthemen duerfen als solche erkennbar sein, Paare kennen ihre Themen.

GESPERRT bleibt: Alles, was nicht offen Geteiltes der anderen Person transportieren wuerde — deren innere Zustaende, Gefuehle, Zweifel, Plaene, Geheimnisse oder konkrete private Schilderungen. Deine Frage lenkt Aufmerksamkeit auf einen Lebensbereich, nie auf den Inhalt der anderen Seite. Keine Attribution ("dein Partner..."). Erlebensbezogen und wertfrei formulieren ("Wie erlebst du...", "Was braeuchtest du...").

Bereits gestellte Fragen (nicht wiederholen):
${(past ?? []).map((x) => `- ${x.q}`).join("\n") || "(keine)"}

Verdichtetes Verstaendnis dieser Person:
${myProfile || "(noch leer)"}

Juengste Tagebucheintraege dieser Person:
${(recent ?? []).map((e) => e.content.slice(0, 400)).join("\n---\n") || "(keine)"}
${partnerProfile ? `\nVerdichtetes Verstaendnis der anderen Person (streng vertraulich, Sperrregel beachten):\n${partnerProfile}` : ""}

Antworte NUR mit validem JSON ohne Backticks: {"fragen":["...","..."]}`, 700);

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
      const { data: pm } = await admin.from("couple_members")
        .select("email_freq").eq("couple_id", member.couple_id).eq("user_id", partner.user_id).maybeSingle();
      const freq = pm?.email_freq ?? "daily";
      if (freq === "none") return json({ ok: true, skipped: "abbestellt" });

      // "partner_joined" nie sofort - nur in der Tageszusammenfassung
      const instant = freq === "instant" && kind !== "partner_joined";

      // Sofortmails hoechstens alle 30 Minuten je Typ
      let send = instant;
      if (instant) {
        const { data: recent } = await admin.from("email_events")
          .select("id").eq("recipient_id", partner.user_id).eq("kind", kind).eq("sent_instant", true)
          .gte("created_at", new Date(Date.now() - 30 * 60000).toISOString()).limit(1);
        if ((recent ?? []).length) send = false;
      }

      if (send) {
        const { data: pu } = await admin.auth.admin.getUserById(partner.user_id);
        const to = pu?.user?.email;
        if (to) await sendMail(to, betreff(kind), textFor(kind));
      }
      await admin.from("email_events").insert({
        couple_id: member.couple_id, recipient_id: partner.user_id, kind,
        sent_instant: send, included_in_daily: send,
      });
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

    // ─── Chat-Moderation ────────────────────────────────────
    if (body.action === "chat") {
      const { data: msgs } = await admin.from("chat_messages")
        .select("sender_id, content").eq("couple_id", member.couple_id)
        .order("created_at", { ascending: false }).limit(30);
      const transcript = (msgs ?? []).reverse().map((m) =>
        m.sender_id === null ? `Zwischenraum: ${m.content}` :
        m.sender_id === user.id ? `${member.display_name ?? "Person 1"}: ${m.content}` :
        `${partner?.display_name ?? "Person 2"}: ${m.content}`).join("\n");

      const mod = await claude(`${GRUNDREGELN}

AUFGABE: Du moderierst den gemeinsamen Chat des Paares. Greife jetzt ein (max. 100 Woerter): Fasse zusammen, was du bei beiden hoerst (uebersetzt in Beduerfnisse, allparteilich), entschaerfe wenn noetig, und stelle genau eine weiterfuehrende Frage an einen oder beide. Nutze dein Hintergrundverstaendnis beider (Regel 3 strikt).

Verstaendnis Person 1 (${member.display_name ?? "?"}):
${myProfile}

Verstaendnis Person 2 (${partner?.display_name ?? "?"}):
${partnerProfile}

Bisheriger Verlauf:
${transcript || "(noch leer)"}

Antworte nur mit deiner Moderationsnachricht.`);

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

async function getProfile(admin: ReturnType<typeof createClient>, coupleId: string, userId: string): Promise<string> {
  const { data } = await admin.from("ai_profiles").select("profile")
    .eq("couple_id", coupleId).eq("user_id", userId).maybeSingle();
  return data?.profile ?? "";
}

// Profil laufend verdichten: die Abstraktionsschicht, die Rohtext von der anderen Seite fernhaelt.
async function updateProfile(
  admin: ReturnType<typeof createClient>,
  coupleId: string, userId: string, current: string, newInfo: string,
) {
  const updated = await claude(`Du pflegst ein verdichtetes, abstrahiertes Verstaendnisprofil einer Person fuer eine Paar-Begleitung. Regeln:
- Max. 300 Woerter. Themen, Beduerfnisse, Muster, Werte, relevante Praegungen (z.B. Herkunftsfamilie) — als Beobachtungen mit epistemischer Markierung ("berichtet, dass...", "beschreibt sich als...").
- KEINE woertlichen Zitate, keine Namen Dritter, keine identifizierenden Details, keine Diagnosen.
- Neues integrieren, Ueberholtes ersetzen, Wiederholtes als Muster markieren.

Bisheriges Profil:
${current || "(leer)"}

Neue Information:
"""${newInfo}"""

Antworte nur mit dem aktualisierten Profil.`, 700);

  await admin.from("ai_profiles").upsert({
    couple_id: coupleId, user_id: userId, profile: updated, updated_at: new Date().toISOString(),
  });
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
    case "gate": return "Euer gemeinsamer Raum hat sich geoeffnet - ihr koennt jetzt moderiert miteinander sprechen.";
    case "report": return "Euer Beziehungsbild wurde erstellt und wartet auf dich.";
    case "mirror": return "Dein persoenlicher Spiegel wurde erstellt.";
    case "partner_joined": return "Deine Partnerin oder dein Partner ist eurem Raum beigetreten.";
    default: return "Es gibt Neues in eurem Zwischenraum.";
  }
}

async function sendMail(to: string, subject: string, body: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) { console.error("RESEND_API_KEY fehlt - keine Mail versendet."); return; }
  const text = `${body}\n\nHier geht es weiter: ${APP_URL}\n\n--\nDu bekommst diese Nachricht, weil du Zwischenraum nutzt.\nHaeufigkeit aendern oder abbestellen: ${APP_URL} (Bereich "Ueber dich" > Benachrichtigungen)\nAus Datenschutzgruenden stehen in unseren E-Mails niemals Inhalte.`;
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
