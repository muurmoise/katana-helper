// Debug log with a fixed-size buffer. No DOM here, so it can be tested in Node.

export const LEVELS = ['info', 'ok', 'warn', 'err', 'out', 'in'];

const PREFIX = { info: '  ', ok: 'OK', warn: '! ', err: '!!', out: '->', in: '<-' };

export function timestamp(date) {
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}.${p(date.getMilliseconds(), 3)}`;
}

export class Logger {
  constructor({ limit = 5000, now = () => new Date() } = {}) {
    this.limit = limit;
    this.now = now;
    this.entries = [];
    this.listeners = new Set();
    this.nextId = 1;
  }

  /**
   * level: one of LEVELS.
   * options.raw: hex string shown on demand.
   * options.tag: free label for filtering, e.g. 'amp' for messages the amp sent on its own.
   */
  add(level, text, { raw = null, tag = null } = {}) {
    const entry = { id: this.nextId++, time: this.now(), level, text, raw, tag };
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
    for (const l of this.listeners) l({ type: 'add', entry });
    return entry;
  }

  clear() {
    this.entries = [];
    for (const l of this.listeners) l({ type: 'clear' });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  static format(entry, { withRaw = true } = {}) {
    const head = `${timestamp(entry.time)} ${PREFIX[entry.level] ?? '  '} ${entry.text}`;
    return withRaw && entry.raw ? `${head}\n${' '.repeat(16)}${entry.raw}` : head;
  }

  toText({ withRaw = true } = {}) {
    return this.entries.map((e) => Logger.format(e, { withRaw })).join('\n');
  }
}
