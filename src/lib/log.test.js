import { describe, expect, it } from 'vitest';
import { Logger, timestamp } from './log.js';

const fixed = () => new Date(2026, 10, 1, 9, 5, 7, 42);

describe('Logger', () => {
  it('formats entries with time and direction', () => {
    const log = new Logger({ now: fixed });
    log.add('out', 'Identity Request', { raw: 'F0 7E 00 06 01 F7' });
    log.add('err', 'Keine Antwort');
    expect(log.toText()).toBe(
      '09:05:07.042 -> Identity Request\n                F0 7E 00 06 01 F7\n09:05:07.042 !! Keine Antwort',
    );
    expect(log.toText({ withRaw: false })).toBe('09:05:07.042 -> Identity Request\n09:05:07.042 !! Keine Antwort');
  });

  it('keeps only the newest entries', () => {
    const log = new Logger({ limit: 3, now: fixed });
    for (let i = 0; i < 5; i++) log.add('info', `#${i}`);
    expect(log.entries.map((e) => e.text)).toEqual(['#2', '#3', '#4']);
  });

  it('notifies listeners and clears', () => {
    const log = new Logger({ now: fixed });
    const events = [];
    const off = log.subscribe((e) => events.push(e.type));
    log.add('info', 'a');
    log.clear();
    off();
    log.add('info', 'b');
    expect(events).toEqual(['add', 'clear']);
    expect(log.entries).toHaveLength(1);
  });

  it('pads the timestamp', () => {
    expect(timestamp(new Date(2026, 0, 1, 1, 2, 3, 4))).toBe('01:02:03.004');
  });
});
