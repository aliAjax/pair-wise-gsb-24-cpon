// 保存层：事件台账仓库。append-only 写入 localStorage，刷新后记录可续用。

import type { LedgerEvent } from "../data/events";
import { SEED_EVENTS } from "../data/reference";
import { reduceAll } from "../rules/reducer";
import type { LedgerState } from "../data/types";

const STORAGE_KEY = "tanfang-ledger-v1";

function isEvent(value: unknown): value is LedgerEvent {
  return Boolean(value && typeof value === "object" && "type" in value && "id" in value && "at" in value && "by" in value);
}

export interface LedgerStore {
  load(): LedgerEvent[];
  append(events: LedgerEvent[]): void;
  reset(): LedgerEvent[];
  getState(): LedgerState;
}

export function createStore(): LedgerStore {
  function load(): LedgerEvent[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_EVENTS));
        return [...SEED_EVENTS];
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || !parsed.every(isEvent)) {
        return [...SEED_EVENTS];
      }
      return parsed as LedgerEvent[];
    } catch {
      return [...SEED_EVENTS];
    }
  }

  function append(events: LedgerEvent[]): void {
    const all = [...load(), ...events];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function reset(): LedgerEvent[] {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_EVENTS));
    return [...SEED_EVENTS];
  }

  return {
    load,
    append,
    reset,
    getState: () => reduceAll(load()),
  };
}
