// 保存层：localStorage 读写与版本校验，页面不直接接触

import { seedDb, DB_VERSION } from "./data/seed";
import type { Database } from "./data/types";

const KEY = "hxwl10.tanfangtai.v1";

export function loadDb(): Database {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedDb();
    const db = JSON.parse(raw) as Database;
    if (!db || db.version !== DB_VERSION || !Array.isArray(db.records)) return seedDb();
    return db;
  } catch {
    return seedDb();
  }
}

export function saveDb(db: Database): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // 存储不可用时静默失败，页面仍可用（刷新后回到种子数据）
  }
}

export function resetDb(): Database {
  const db = seedDb();
  saveDb(db);
  return db;
}
