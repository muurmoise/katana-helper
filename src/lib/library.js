// Patch library: stored patches and automatic backups, kept in IndexedDB in the browser.
// Entries hold the patch as offset runs (see serializePatch in patch.js). Entries made from a
// readable preset (preset.js) hold only the bytes the preset sets.

import { fromBase128 } from './sysex.js';
import { nameBytes, parsePatch, patchName, serializePatch } from './patch.js';
import { PRESET_FORMAT, presetToPatch } from './preset.js';

export const LIBRARY_FORMAT = 'katana-helper-library';
const BACKUP_FORMAT = 'katana-helper-backup';

/** In-memory storage, for tests and as fallback when IndexedDB is not available. */
export function memoryBackend() {
  const rows = new Map();
  let next = 1;
  return {
    kind: 'memory',
    async all() {
      return [...rows.values()].map((r) => structuredClone(r));
    },
    async put(entry) {
      const row = structuredClone(entry);
      if (row.id == null) row.id = next++;
      rows.set(row.id, row);
      return row.id;
    },
    async delete(id) {
      rows.delete(id);
    },
  };
}

/** IndexedDB storage: database "katana-helper", object store "patches". */
export function indexedDbBackend(name = 'katana-helper', idb = globalThis.indexedDB) {
  let dbPromise = null;
  const open = () => {
    dbPromise ??= new Promise((resolve, reject) => {
      const req = idb.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('patches', { keyPath: 'id', autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  };
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('patches', mode);
      const req = fn(tx.objectStore('patches'));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  return {
    kind: 'indexeddb',
    all: () => run('readonly', (s) => s.getAll()),
    put: (entry) => {
      const row = { ...entry };
      if (row.id == null) delete row.id;
      return run('readwrite', (s) => s.put(row));
    },
    delete: (id) => run('readwrite', (s) => s.delete(id)),
  };
}

/**
 * kind: 'patch' (kept on purpose) or 'backup' (made automatically before overwriting).
 * origin: where it came from, e.g. "A2", "Aktueller Klang", "Import".
 */
export class PatchLibrary {
  constructor(backend = memoryBackend()) {
    this.backend = backend;
    this.listeners = new Set();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const l of this.listeners) l(this);
  }

  /** Newest first. */
  async list() {
    const rows = await this.backend.all();
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id));
  }

  async get(id) {
    return (await this.backend.all()).find((r) => r.id === id) ?? null;
  }

  /** Store a patch map. Returns the new entry. */
  async add(map, { kind = 'patch', origin = '', note = '', firmware = null, name = null, createdAt = new Date() } = {}) {
    if (!(map instanceof Map) || map.size < 16) throw new Error('Leerer Patch');
    const entry = {
      name: name ?? patchName(map),
      kind,
      origin,
      note,
      firmware,
      createdAt: createdAt.toISOString(),
      size: map.size,
      patch: serializePatch(map),
    };
    entry.id = await this.backend.put(entry);
    this.emit();
    return entry;
  }

  patchOf(entry) {
    return parsePatch(entry.patch);
  }

  /** Rename an entry; the name inside the patch (first 16 bytes) changes with it. */
  async rename(id, name) {
    const entry = await this.get(id);
    if (!entry) return null;
    const map = this.patchOf(entry);
    nameBytes(name).forEach((b, i) => map.set(i, b));
    entry.name = patchName(map);
    entry.patch = serializePatch(map);
    await this.backend.put(entry);
    this.emit();
    return entry;
  }

  /** Turn an automatic backup into a normal patch, so it is not mistaken for clutter. */
  async keep(id) {
    const entry = await this.get(id);
    if (!entry) return null;
    entry.kind = 'patch';
    await this.backend.put(entry);
    this.emit();
    return entry;
  }

  async remove(id) {
    await this.backend.delete(id);
    this.emit();
  }

  /** Export some or all entries as a JSON file text. */
  async exportJson(ids = null) {
    const rows = (await this.list()).filter((r) => !ids || ids.includes(r.id));
    const patches = rows.map(({ id, ...rest }) => rest);
    return JSON.stringify(
      { format: LIBRARY_FORMAT, formatVersion: 1, exported: new Date().toISOString(), device: 'BOSS Katana MkII', patches },
      null,
      2,
    );
  }

  /**
   * Import a library file, a backup file from the editor ("Backup speichern") or readable
   * presets (one, or a JSON array of them; docs/preset-guide.md). Text pasted from a chat
   * may keep its ```json fence. Preset hints go to `onWarning(text)`.
   * Returns the number of added entries.
   */
  async importJson(text, { onWarning = () => {} } = {}) {
    let data;
    try {
      data = JSON.parse(stripFence(text));
    } catch {
      throw new Error('Keine gültige JSON-Datei');
    }
    const items = [];
    const presets = Array.isArray(data) ? data : data?.format === PRESET_FORMAT ? [data] : null;
    if (presets) {
      if (!presets.length || !presets.every((p) => p?.format === PRESET_FORMAT)) throw new Error('Unbekanntes Dateiformat');
      presets.forEach((p, i) => {
        let result;
        try {
          result = presetToPatch(p);
        } catch (e) {
          throw new Error(presets.length > 1 ? `Preset ${i + 1}: ${e.message}` : e.message);
        }
        for (const w of result.warnings) onWarning(`„${result.name}“: ${w}`);
        items.push({ map: result.map, name: result.name, kind: 'patch', origin: 'Preset', note: result.description, firmware: null });
      });
    } else if (data?.format === LIBRARY_FORMAT && Array.isArray(data.patches)) {
      for (const p of data.patches) {
        items.push({ map: parsePatch(p.patch), name: p.name, kind: p.kind === 'backup' ? 'backup' : 'patch', origin: p.origin ?? 'Import', note: p.note ?? '', firmware: p.firmware ?? null, createdAt: p.createdAt });
      }
    } else if (data?.format === BACKUP_FORMAT && Array.isArray(data.chunks)) {
      items.push({ map: backupToPatch(data), name: data.patchName ?? null, kind: 'patch', origin: 'Import', note: 'Backup-Datei', firmware: data.firmware ?? null, createdAt: data.created });
    } else {
      throw new Error('Unbekanntes Dateiformat');
    }
    for (const it of items) {
      await this.add(it.map, {
        kind: it.kind,
        origin: it.origin,
        note: it.note,
        firmware: it.firmware,
        name: it.name,
        createdAt: it.createdAt ? new Date(it.createdAt) : new Date(),
      });
    }
    return items.length;
  }
}

/** JSON text without a surrounding Markdown code fence (```json … ```). */
function stripFence(text) {
  const m = String(text).trim().match(/^```[\w-]*\s*\n([\s\S]*?)\n?```$/);
  return m ? m[1] : text;
}

/** Backup file (absolute addresses like "60 00 00 00") → patch map. */
export function backupToPatch(file) {
  const addr = (h) => h.split(/\s+/).map((x) => parseInt(x, 16));
  const first = addr(file.chunks[0].address);
  const base = fromBase128([first[0], first[1], 0, 0]);
  return parsePatch(file.chunks.map((c) => ({ offset: fromBase128(addr(c.address)) - base, data: c.data })));
}
