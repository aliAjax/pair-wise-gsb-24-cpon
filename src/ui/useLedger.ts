// 页面层：台账 hook，把保存层和规则层接到 React

import { useCallback, useMemo, useState } from "react";
import type { LedgerEvent } from "../data/events";
import { reduceAll } from "../rules/reducer";
import { createStore } from "../storage/store";
import type { LedgerState } from "../data/types";

const store = createStore();

export interface CommitResult {
  ok: boolean;
  error?: string;
}

export function useLedger() {
  const [events, setEvents] = useState<LedgerEvent[]>(() => store.load());

  const state: LedgerState = useMemo(() => reduceAll(events), [events]);

  const commit = useCallback((newEvents: LedgerEvent[]): CommitResult => {
    try {
      store.append(newEvents);
      setEvents(store.load());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "操作失败" };
    }
  }, []);

  const reset = useCallback(() => {
    setEvents(store.reset());
  }, []);

  return { events, state, commit, reset };
}
