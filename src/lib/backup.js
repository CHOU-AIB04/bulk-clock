/**
 * Getting your data out, and keeping a copy you didn't ask for.
 *
 * Nothing here talks to a server. Exports are written to the device and handed
 * to Android's share sheet, so where they end up — Drive, email, a USB cable —
 * is the user's choice rather than ours.
 *
 * The automatic backup exists because the app has no cloud sync: clearing app
 * data or losing the phone would otherwise take months of logs with it. It runs
 * at most once a week, keeps the last few, and never blocks anything.
 */

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { getState, exportJSON, replaceState, todayKey, addDays } from "./store.js";

const BACKUP_DIR = "bulkclock/backups";
const KEEP = 6;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const isNative = () => Capacitor.isNativePlatform();
const stamp = () => new Date().toISOString().slice(0, 10);

/* ── CSV ─────────────────────────────────────────────────── */

/** RFC-4180 quoting: anything with a comma, quote or newline gets wrapped. */
function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  return rows.map(r => r.map(csvCell).join(",")).join("\n");
}

export function foodLogCsv(state = getState()) {
  const rows = [["date", "meal", "item", "amount", "unit", "grams", "kcal", "protein_g", "carbs_g", "fat_g"]];
  const slotName = id => state.profile.slots.find(s => s.id === id)?.name || id;

  for (const key of Object.keys(state.log).sort()) {
    for (const e of state.log[key].entries || []) {
      rows.push([
        key, slotName(e.slot), e.name, e.amount, e.unit,
        e.grams != null ? Math.round(e.grams) : "",
        Math.round(e.kcal), round1(e.p), round1(e.c), round1(e.f)
      ]);
    }
  }
  return toCsv(rows);
}

export function liftsCsv(state = getState()) {
  const rows = [["date", "exercise", "set", "type", "weight_kg", "reps", "rpe", "completed"]];
  for (const key of Object.keys(state.lifts).sort()) {
    for (const [name, rec] of Object.entries(state.lifts[key].ex || {})) {
      (rec.sets || []).forEach((s, i) => {
        rows.push([key, name, i + 1, s.type || "work", s.w ?? "", s.r ?? "", s.rpe ?? "", s.done ? "yes" : "no"]);
      });
    }
  }
  return toCsv(rows);
}

export function bodyCsv(state = getState()) {
  const fields = ["waist", "chest", "arm", "thigh", "hips", "neck"];
  const rows = [["date", "weight_kg", ...fields.map(f => `${f}_cm`)]];
  const keys = new Set([
    ...Object.keys(state.log).filter(k => state.log[k]?.weight != null),
    ...Object.keys(state.measurements || {})
  ]);
  for (const key of [...keys].sort()) {
    rows.push([
      key,
      state.log[key]?.weight ?? "",
      ...fields.map(f => state.measurements?.[key]?.[f] ?? "")
    ]);
  }
  return toCsv(rows);
}

const round1 = n => (n == null ? "" : Math.round(n * 10) / 10);

/* ── writing and sharing ─────────────────────────────────── */

async function writeToDocuments(name, data) {
  await Filesystem.writeFile({
    path: name,
    directory: Directory.Documents,
    data,
    encoding: Encoding.UTF8,
    recursive: true
  });
  const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Documents });
  return uri;
}

/** Fall back to a browser download when there is no device filesystem. */
function browserDownload(name, data, type = "text/plain") {
  try {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

async function share(uri, title) {
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, url: uri, dialogTitle: title });
    return true;
  } catch {
    return false;   // sharing cancelled, or unavailable — the file is still written
  }
}

/**
 * Write one export and offer it to the share sheet.
 * Returns { ok, path, shared, reason }.
 */
export async function exportFile(kind = "json") {
  const state = getState();
  const date = stamp();

  const files = {
    json: [`bulkclock-backup-${date}.json`, exportJSON(), "application/json"],
    food: [`bulkclock-food-${date}.csv`, foodLogCsv(state), "text/csv"],
    lifts: [`bulkclock-training-${date}.csv`, liftsCsv(state), "text/csv"],
    body: [`bulkclock-body-${date}.csv`, bodyCsv(state), "text/csv"]
  };

  const [name, data, mime] = files[kind] || files.json;

  if (!isNative()) {
    return { ok: browserDownload(name, data, mime), path: name, shared: false, reason: "web" };
  }

  try {
    const uri = await writeToDocuments(name, data);
    const shared = await share(uri, name);
    return { ok: true, path: `Documents/${name}`, shared, reason: null };
  } catch (e) {
    return { ok: false, path: null, shared: false, reason: String(e?.message || e) };
  }
}

/* ── automatic backup ────────────────────────────────────── */

export async function listBackups() {
  if (!isNative()) return [];
  try {
    const { files } = await Filesystem.readdir({ path: BACKUP_DIR, directory: Directory.Data });
    return files
      .map(f => (typeof f === "string" ? { name: f } : f))
      .filter(f => f.name.endsWith(".json"))
      .sort((a, b) => (a.name < b.name ? 1 : -1));
  } catch {
    return [];
  }
}

/**
 * Keep a dated snapshot, at most weekly. Old ones are pruned so a year of
 * backups cannot quietly fill the phone.
 */
export async function autoBackup(force = false) {
  if (!isNative()) return { ok: false, reason: "web" };

  const state = getState();
  const last = state.settings.lastBackupAt || 0;
  if (!force && Date.now() - last < WEEK_MS) return { ok: false, reason: "recent" };

  // Nothing logged yet means nothing worth backing up.
  const hasData = Object.keys(state.log).length > 0 || Object.keys(state.lifts).length > 0;
  if (!force && !hasData) return { ok: false, reason: "empty" };

  try {
    await Filesystem.mkdir({ path: BACKUP_DIR, directory: Directory.Data, recursive: true }).catch(() => {});
    await Filesystem.writeFile({
      path: `${BACKUP_DIR}/backup-${stamp()}.json`,
      directory: Directory.Data,
      data: exportJSON(),
      encoding: Encoding.UTF8
    });

    const existing = await listBackups();
    for (const old of existing.slice(KEEP)) {
      await Filesystem.deleteFile({ path: `${BACKUP_DIR}/${old.name}`, directory: Directory.Data }).catch(() => {});
    }

    const { setSetting } = await import("./store.js");
    setSetting({ lastBackupAt: Date.now() });
    return { ok: true, reason: null };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}

/** Read one automatic backup back into the app. */
export async function restoreBackup(name) {
  if (!isNative()) return { ok: false, reason: "web" };
  try {
    const res = await Filesystem.readFile({
      path: `${BACKUP_DIR}/${name}`,
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });
    const parsed = JSON.parse(res.data);
    if (!parsed?.profile) throw new Error("that file is not a Bulk Clock backup");
    replaceState(parsed);
    return { ok: true, reason: null };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}
