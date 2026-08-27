# Bulk Clock

An offline-first Android app for running a training and nutrition block: guided setup that
calculates your calorie and macro targets from your own biometrics, meal logging against a
222-food database, custom meal building, a 26-week training block with set logging, weight
tracking with automatic verdicts, streaks and challenges — plus device-local reminders that
fire with no server and no internet.

Built with Vite + React + Capacitor on the **Neon-Nature** design system. No account, no
backend, no analytics. Everything you log stays in the app's own storage on your phone.

---

## Getting the APK

You do not need Android Studio or the Android SDK — GitHub builds it for you.

Push to `main` and the **Build APK** workflow runs. When it finishes, the repo's **Releases**
page has a `latest` release with `bulk-clock-<n>.apk` attached. Open that page on your phone,
tap the APK, and allow installing from this source the first time.

```bash
git add . && git commit -m "Neon-Nature redesign" && git push
```

To rebuild without changing code: **Actions → Build APK → Run workflow**.

---

## First run

The app opens into a four-step setup:

1. **Welcome** — what the app does and where your data lives.
2. **Your numbers** — sex, age, weight, height, physique archetype, primary objective
   (build muscle / lose fat / maintain).
3. **Your week** — daily activity level, training days, goal weight, wake time and meals per
   day. Meal times are generated three hours apart from your wake time.
4. **Your targets** — calories, protein, carbs and fat calculated with Mifflin–St Jeor,
   shown alongside your resting burn and maintenance, and **editable before you confirm**.

Then it generates your programme: your meal schedule, a training block starting the coming
Monday, and reminders for every meal and session.

After setup, check two things:

- **Reminders** — Settings (avatar, top left) → **Test**. A notification should arrive within
  ten seconds. If not, check Android Settings → Apps → Bulk Clock → Notifications.
- **Battery** — Settings → Apps → Bulk Clock → Battery → **Unrestricted**. Android delays
  background alarms aggressively; without this, meal reminders drift once the phone idles.
  Xiaomi, Huawei, Samsung and Oppo are the usual offenders.

You can redo setup any time from Settings → *Reset app and redo setup* (this erases
everything — copy a backup first).

---

## Screens

**Home** — today's read (a computed insight), a daily energy ring against your calorie
target, protein progress, a live countdown to your next meal, and a timeline of every meal
slot. Tap a slot to log a saved meal in one tap, search the food database, scan a barcode,
or type a quick entry.

**Diet** — two views. *My meals* is your recipe book: build a meal out of database foods
once, then log it forever in a tap. Seven are pre-built. *Database* browses all 222 foods by
category with full per-100 g macros and common portions.

**Training** — the split driven by a 26-week block: adaptation → accumulation → deload →
intensification → deload → consolidate. Deload weeks halve the sets automatically. Log
weight × reps per set; the line under each exercise is your last session. Rest timer toggles
90 s / 2:30 / 3:00.

**Stats** — daily weigh-in, 7-day rolling average against your target trajectory, a 30-day
consistency grid, and challenges you define ("30 days on target", "never miss a session").

**Coach** — see below.

**Settings** — reached from the avatar. Reminder toggles and times, meal schedule, targets,
backup and restore, reset.

---

## The Coach tab is not AI

The design this app was built from included an "AI Coach" chat and "Daily AI Insight" cards.
There is no model and no server behind this app, so shipping a chatbot would have meant
faking one.

Instead, `src/lib/insights.js` computes every line from data you actually logged: your 7-day
weight average against the rate your objective implies, your protein average against your
target, top sets across recent sessions to spot a stalled lift, yesterday's calories as a
readiness signal, and streak risk late in the day. Each rule returns nothing when it has
nothing honest to say — silence beats filler. The tab says so on the card at the top.

If you later want a real conversational coach, `getInsights()` is the seam: swap that module
for an API call and the UI does not change.

---

## The design system

**Neon-Nature** — emerald neon over near-black, glassmorphic layering, hyper-rounded shapes,
pill buttons. Tokens live at the top of `src/styles.css`:

| Role | Value |
|---|---|
| Background | `#141218` |
| Surfaces | `#0f0d13` → `#36343a`, tonal layering |
| Accent | `#34d399` (emerald-400), bright `#6ee7b7`, deep `#10b981` |
| Glass | `rgba(20,18,24,.6)` + `blur(20px)` + `1px` accent border at 10% |
| Glow | `0 0 15px rgba(52,211,153,.2)` |
| Headings | Lexend Variable |
| Body | Inter Variable |
| Radii | 8 / 16 / 24 / 32 / 48 px, buttons fully rounded |
| Rhythm | 4 px baseline |

Two notes on the source design, since they'll trip you up if you go back to the Stitch export:

1. **The export contradicted itself on colour.** Its `tailwind.config` token block was
   Material 3's default *purple* (`primary: #cfbcff`) while the prose described "Matrix Green
   neon". Three of the ten screens (custom meal builder, scheduler, training tracker) render
   lavender as a result. This app unifies everything on the green.
2. **Fonts and icons were all remote.** Lexend, Inter and Material Symbols loaded from
   `fonts.googleapis.com`, which in an offline APK means system fallbacks and icons rendering
   as literal words like `arrow_back_ios_new`. Here, Lexend and Inter are bundled from
   `@fontsource-variable` (latin subset only, 88 KB total) and icons come from `lucide-react`
   as inline SVG. Nothing loads over the network.

---

## The food database

222 foods, all per 100 g, in `src/data/foods.js`, one pipe-delimited line each:

```
id|name|category|kcal|protein|carbs|fat|unit:grams,unit:grams
```

Adding your own is a one-line edit; categories are derived automatically. Values come from
standard composition references, and Moroccan dishes (tagine, harira, msemen, bissara,
rfissa, zaalouk, khobz, raib, lben, smen, amlou) use typical home-cooked averages — good
estimates, not label accuracy.

**Barcode scanning** uses the browser's `BarcodeDetector` and looks products up in
[Open Food Facts](https://world.openfoodfacts.org). It is the only feature that needs
internet; it falls back to typing the number, then to a manual entry.

---

## How the targets are calculated

`src/lib/targets.js`. Mifflin–St Jeor for resting metabolic rate, multiplied by a daily
activity factor (1.25–1.7) and a training bump of 4% per session day. Then:

- **Build muscle** — `+15%` of maintenance, clamped to 300–500 kcal, ±60 for archetype.
  Protein 2.0 g/kg of goal weight.
- **Lose fat** — `−20%`, clamped to 400–750 kcal. Protein 2.2 g/kg.
- **Maintain** — maintenance. Protein 1.8 g/kg.

Fat is 25% of calories with a floor of 0.8 g/kg; carbs take the remainder.

These are estimates. Mifflin–St Jeor lands within roughly ±10% for most people and activity
multipliers are cruder still, which is why the Coach tab compares your real weight trend
against the expected rate and tells you to hold, add 200 kcal or cut 200 kcal.

---

## Your data

No account, no server. Everything lives in the app's local storage, which means **nothing is
backed up for you**. Settings → *Copy backup* puts the whole state on your clipboard as JSON.
*Restore backup* takes it back. Uninstalling deletes everything; installing a newer APK over
the top does not.

---

## Developing

```bash
npm install
npm run dev        # http://localhost:5173
```

Notifications are a no-op in the browser (Settings says so), but everything else works, which
makes the browser the fastest way to iterate.

```bash
npm run apk        # build + sync + assembleDebug, needs the Android SDK locally
```

Requires **JDK 17**. JDK 21 fails against Android Gradle Plugin 8.2.

```
src/
  data/foods.js        222-food database, search and portion maths
  data/program.js      training split, phases, seed meals
  lib/store.js         state, persistence, mutations, derived values
  lib/targets.js       Mifflin–St Jeor, objectives, meal scheduling
  lib/insights.js      the rule engine behind the Coach tab
  lib/notify.js        Capacitor local notifications
  components/          AddSheet (log / search / scan / quick), Ring
  screens/             Onboarding, Dashboard, Nutrition, Training, Stats, Coach, Profile
android/               native project — committed so CI builds without scaffolding
```

Macros are **snapshotted at log time**, so editing a food or a saved meal never rewrites days
you already logged.

Two traps worth knowing if you extend this:

- **Never call a hook inside a loop over exercises.** The upper sessions have 7 and 8
  movements; hook order would change between days and React would throw. `Training.jsx`
  subscribes once at the top and indexes in.
- **Store selectors must return a stable reference.** `useStore(s => s.lifts[key])`, never
  `useStore(s => s.lifts[key] || {})` — a fresh object each call makes
  `useSyncExternalStore` loop forever.

---

## Known constraints

- **`USE_EXACT_ALARM`** is declared so reminders land on the minute. Google Play restricts it
  to alarm and calendar apps, so this build is for sideloading.
- The APK is **debug-signed** — fine for your own phone, not for Play.
- **`compileSdk` 34 / `minSdk` 22** — Android 5.1 and up.
- The app is **dark-only**. Neon-Nature is committed to a single visual world; there is no
  light theme and the palette is painted explicitly rather than inherited.

---

## Not medical advice

Calorie and macro figures are general nutrition information, and the Coach rules assume
you're healthy and training normally. If something feels wrong — persistent fatigue,
unexplained weight change, pain that isn't soreness — that's a conversation with a doctor,
not an app.

---

## Running it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # writes dist/
npm test           # 74 tests over the calculations
npm run clean      # clears Vite's caches and leftover temp files
```

---

## If `npm run dev` fails with EPERM

```
Error: EPERM: operation not permitted, rmdir
'…\bulkclock\node_modules\.vite\deps'
```

**This is OneDrive, not Vite.**

Vite rebuilds its dependency cache by writing a fresh `node_modules/.vite/deps_temp_*`,
deleting the old `deps`, and renaming the new one into place. OneDrive starts uploading files
the instant they appear, and while it holds a handle on one, Windows refuses the delete. Vite
treats that as fatal and the dev server never starts.

The same mechanism produces the pile of `vite.config.js.timestamp-*.mjs` files in the project
root. Vite writes one every time it loads the config and deletes it a moment later — when that
delete fails, the file stays. They are harmless, just noise.

### The quick fix

```bash
npm run clean
npm run dev
```

`vite.config.js` now keeps Vite's cache in the OS temp directory rather than
`node_modules/.vite`, so OneDrive cannot lock it. That alone resolves the EPERM.

### The proper fix: get the project out of OneDrive

Source code — and `node_modules` in particular — does not belong in a synced folder. It is
tens of thousands of small files being continuously uploaded, which is slow, burns your
storage quota, and causes exactly this class of file-locking failure. Move it:

```powershell
# in PowerShell
robocopy "$env:USERPROFILE\OneDrive\Documents\Claude\Projects\Chouaib Profile\bulk-clock2\bulkclock" `
         "C:\dev\bulkclock" /E /XD node_modules dist .vite
cd C:\dev\bulkclock
npm install
npm run dev
```

`/XD node_modules dist .vite` skips the folders worth rebuilding rather than copying. Once it
works from `C:\dev`, delete the OneDrive copy.

If you would rather keep it where it is, exclude the folder from syncing:
**OneDrive → Settings → Account → Choose folders**, and untick this project.

### Still stuck?

Something has a file open. In order:

1. Close every terminal running `vite`, and close VS Code.
2. Pause OneDrive from the taskbar (Pause syncing → 2 hours).
3. `npm run clean`
4. `npm run dev`

If it persists, Windows Defender real-time scanning can hold files too — add the project
folder to its exclusions.

