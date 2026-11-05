/**
 * localStorage with every access wrapped: the game must run when storage is
 * unavailable (private windows, blocked site data, previews).
 */
import { createMemory, deserializeMemory, serializeMemory, type PlayerMemory } from '../sim/memory';
import type { GameSettings } from './game';

const MEMORY_KEY = 'meridian.memory.v2';
const SETTINGS_KEY = 'meridian.settings.v1';

export function loadMemory(): PlayerMemory {
  try {
    const text = localStorage.getItem(MEMORY_KEY);
    if (!text) return createMemory();
    return deserializeMemory(text);
  } catch {
    return createMemory();
  }
}

export function saveMemory(mem: PlayerMemory): boolean {
  try {
    localStorage.setItem(MEMORY_KEY, serializeMemory(mem));
    return true;
  } catch {
    return false;
  }
}

export function clearMemory(): void {
  try {
    localStorage.removeItem(MEMORY_KEY);
  } catch {
    // nothing to clear
  }
}

export function loadSettings(): Partial<GameSettings> {
  try {
    const text = localStorage.getItem(SETTINGS_KEY);
    return text ? (JSON.parse(text) as Partial<GameSettings>) : {};
  } catch {
    return {};
  }
}

export function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // storage unavailable; settings live for the session only
  }
}
