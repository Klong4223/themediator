import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
export async function callAI(body) {
  const { data, error } = await supabase.functions.invoke("ai", { body });
  if (error) {
    let detail = error.message || String(error);
    try {
      const ctx = error.context;
      if (ctx && typeof ctx.text === "function") {
        const t = await ctx.text();
        if (t) detail += " — " + t.slice(0, 300);
      }
    } catch { /* ignorieren */ }
    throw new Error(detail);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

// Frontend-Version, hier statt in .env, damit sie im Build landet und ohne
// Serverkontakt anzeigbar ist. Bei jedem Ausliefern mitziehen.
export const FRONTEND_VERSION = "2026-08-07";

// Fragt die tatsaechlich deployte Edge-Function-Version ab (Backlog-Punkt 2)
// -- so ist im Frontend sichtbar, ob ein Update dort schon angekommen ist.
export async function pingAI() {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai?ping=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Ping fehlgeschlagen (${res.status}).`);
  return res.json();
}
