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
