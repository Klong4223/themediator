# Setup: GitHub + Vercel

Einmalig ca. 20 Minuten am Rechner. Danach genügt für jedes Update ein Commit —
Vercel baut und veröffentlicht automatisch.

## 1. GitHub-Repository anlegen

1. Auf [github.com](https://github.com) anmelden (kostenlos).
2. Oben rechts **+ → New repository**.
3. Name z.B. `zwischenraum`, Sichtbarkeit **Private**, sonst nichts ankreuzen
   (kein README, kein .gitignore — ist beides schon im Projekt).
4. **Create repository**.

## 2. Projekt hochladen

**Variante A — im Browser (kein Git nötig):**
Auf der leeren Repo-Seite auf *uploading an existing file* klicken, den **Inhalt**
des entpackten Projektordners hineinziehen (nicht den Ordner selbst), unten
**Commit changes**.

Wichtig: Der Ordner `node_modules` und die Datei `.env` dürfen **nicht** mit
hochgeladen werden. Falls sie im entpackten Ordner liegen, vorher löschen.

**Variante B — mit Git (falls installiert):**

```bash
cd zwischenraum
git init
git add .
git commit -m "Zwischenraum MVP"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/zwischenraum.git
git push -u origin main
```

## 3. Vercel verbinden

1. Auf [vercel.com](https://vercel.com) mit dem GitHub-Konto anmelden.
2. **Add New… → Project** → das Repository `zwischenraum` importieren.
3. Framework wird automatisch als **Vite** erkannt — Voreinstellungen belassen.
4. Unter **Environment Variables** zwei Einträge anlegen:

   | Name | Wert |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://bhdybaonkdvpqlttyihx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | dein `sb_publishable_…`-Key |

5. **Deploy**. Nach ~1 Minute gibt es eine URL wie `zwischenraum.vercel.app`.

## 4. Supabase auf die neue URL zeigen lassen

Supabase → **Authentication → URL Configuration**:
- **Site URL**: die neue Vercel-URL
- unter **Redirect URLs** zusätzlich `https://DEINE-URL.vercel.app/**` eintragen

Die alte Netlify-Seite kannst du danach löschen — oder als Notfall-Fallback
stehen lassen.

## Ab jetzt: So läuft ein Update

1. Geänderte Dateien im GitHub-Repo ersetzen (Browser: Datei öffnen → Stift →
   Inhalt einfügen → Commit; oder per `git push`).
2. Vercel baut automatisch und veröffentlicht.
3. Unter **Deployments** siehst du jeden Stand — bei Problemen auf einen
   früheren gehen und **Promote to Production** klicken (Rollback in Sekunden).

## Was weiterhin manuell bleibt

- **Datenbankänderungen**: SQL-Skript im Supabase SQL Editor ausführen.
- **Edge Function**: Code im Supabase-Dashboard einfügen und deployen.
  (Optional später automatisierbar über GitHub Actions + Supabase CLI.)
