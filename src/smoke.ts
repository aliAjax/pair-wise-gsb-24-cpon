// 规则冒烟测试：用 esbuild 打包后 node 运行（见 package.json 的 test 脚本）
declare const process: { exit(code?: number): void };

import { reduceAll } from "./rules/reducer";
import { commands, type CommandContext } from "./rules/commands";
import { SEED_EVENTS, PEOPLE } from "./data/reference";
import type { LedgerEvent } from "./data/events";
import type { LedgerState } from "./data/types";
import { countSpecimens, siteStatuses, specimensAt } from "./rules/selectors";
import { createStore } from "./storage/store";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) {
    failures += 1;
    console.error(`✗ ${name} ${detail}`);
  } else {
    console.log(`✓ ${name}`);
  }
}

function expectThrow(name: string, fn: () => unknown) {
  try {
    fn();
    check(name, false, "操作应当被规则拒绝");
  } catch {
    check(name, true);
  }
}

const ctx: CommandContext = {
  now: (() => {
    let t = Date.parse("2026-09-23T18:00:00+08:00");
    return () => (t += 60_000);
  })(),
  id: (() => {
    let n = 0;
    return (p: string) => `${p}-new-${++n}`;
  })(),
};

const gao = PEOPLE[0]; // 领队
const lin = PEOPLE[1]; // 队员
const zhao = PEOPLE[2]; // 队员
const shen = PEOPLE[3]; // 整理员

let state: LedgerState = reduceAll(SEED_EVENTS);
let stream: LedgerEvent[] = [...SEED_EVENTS];
const apply = (newEvents: LedgerEvent[]) => {
  stream = [...stream, ...newEvents];
  state = reduceAll(stream);
};

// ---------- 演示数据 ----------
const xhw = siteStatuses(state).find((s) => s.site.id === "s-xhw")!;
const dg = siteStatuses(state).find((s) => s.site.id === "s-dg")!;
check("演示：西湾有 3 条未处理标本（1 未交接 + 2 待整理）", xhw.pending === 3, `实际 ${xhw.pending}`);
check("演示：西湾不能收官", !xhw.canClose);
check("演示：东岗全部交回可收官", dg.canClose);
check("演示：件数随校正变化（12→10），合计 23", countSpecimens(Object.values(state.specimens)).total === 23);

// ---------- 登记权限 ----------
expectThrow("领队不能登记地层", () =>
  commands.createLayer(state, gao, { siteId: "s-dg", squareId: "q-0101", code: "第5层", openingDepth: "1.0", summary: "x", features: [] }, ctx),
);
expectThrow("同探方地层编号不能重复", () =>
  commands.createLayer(state, zhao, { siteId: "s-xhw", squareId: "q-0203", code: "第3层", openingDepth: "1.0", summary: "x", features: [] }, ctx),
);
expectThrow("必须选择探方", () =>
  commands.createLayer(state, zhao, { siteId: "s-dg", squareId: "q-0203", code: "第5层", openingDepth: "1.0", summary: "x", features: [] }, ctx),
);

apply(commands.createLayer(state, zhao, {
  siteId: "s-dg", squareId: "q-0101", code: "第6层", openingDepth: "1.2", summary: "沙土",
  features: [{ code: "H9", kind: "灰坑", soil: "黑土", note: "" }],
}, ctx));
const l6 = Object.values(state.layers).find((l) => l.code === "第6层")!.id;
check("新地层带遗迹登记成功", state.layers[l6].conclusion!.features[0].code === "H9");

// ---------- 同层多人协作 ----------
expectThrow("林队员不能改赵队员的草稿", () => commands.updateDraft(state, lin, l6, { summary: "抢改" }, ctx));
expectThrow("林队员不能替赵队员提交", () => commands.submitConclusion(state, lin, l6, ctx));
apply(commands.addObservation(state, lin, l6, "林补充观察", ctx));
check("补充观察生效且结论原样保留",
  state.layers[l6].observations.some((o) => o.text === "林补充观察") && state.layers[l6].conclusion!.summary === "沙土");

// ---------- 提交锁定 ----------
apply(commands.submitConclusion(state, zhao, l6, ctx));
check("提交后状态为已交接", state.layers[l6].conclusion!.submitted === true);
expectThrow("提交后作者本人也不能直接改", () => commands.updateDraft(state, zhao, l6, { summary: "再改" }, ctx));

// ---------- 整理员校正：写原因、留原记录 ----------
const beforeSummary = state.layers[l6].conclusion!.summary;
apply(commands.correctRecord(state, shen, l6, {
  reason: "复测开口深度",
  after: { openingDepth: "1.25", summary: "沙土（校正）", features: [] },
}, ctx));
const recCorr = state.layers[l6].conclusion!.corrections[0];
check("记录校正留痕（原因/原值/新值）",
  recCorr.reason === "复测开口深度" && recCorr.before.summary === beforeSummary && recCorr.after.openingDepth === "1.25",
);
expectThrow("校正必须填写原因", () =>
  commands.correctRecord(state, shen, l6, { reason: "  ", after: { openingDepth: "1.3", summary: "x", features: [] } }, ctx),
);
expectThrow("队员不能校正记录", () =>
  commands.correctRecord(state, lin, l6, { reason: "r", after: { openingDepth: "1.3", summary: "x", features: [] } }, ctx),
);

// 未提交草稿不能被整理员校正
const l204 = Object.values(state.layers).find((l) => l.id === "l-0204-2")!;
expectThrow("草稿未提交，整理员不能校正", () =>
  commands.correctRecord(state, shen, l204.id, { reason: "r", after: { openingDepth: "1", summary: "x", features: [] } }, ctx),
);

// ---------- 标本流转 ----------
apply(commands.registerSpecimen(state, zhao, { layerId: l6, name: "陶罐", qty: 5, coord: "E1 N1" }, ctx));
const sp = Object.values(state.specimens).find((s) => s.layerId === l6 && s.name === "陶罐")!;
check("标本编号格式 DG-T0101-6:001", sp.code === "DG-T0101-6:001", sp.code);
check("登记后为未交接", sp.status === "unhanded");
expectThrow("整理员不能执行交接", () => commands.handOver(state, shen, [sp.id], shen.id, ctx));
expectThrow("交接必须指定接收整理员", () => commands.handOver(state, zhao, [sp.id], "", ctx));
apply(commands.handOver(state, zhao, [sp.id], shen.id, ctx));
check("交接后为待整理", state.specimens[sp.id].status === "handed");
expectThrow("不能重复交接", () => commands.handOver(state, zhao, [sp.id], shen.id, ctx));
expectThrow("队员不能登记数量为 0 的标本", () =>
  commands.registerSpecimen(state, lin, { layerId: l6, name: "碎块", qty: 0, coord: "x" }, ctx),
);

apply(commands.correctSpecimen(state, shen, sp.id, {
  reason: "拼对复原 2 件，核减",
  after: { name: "陶罐", qty: 3, coord: "E1 N1" },
}, ctx));
check("标本校正后件数 3 且留痕", state.specimens[sp.id].qty === 3 && state.specimens[sp.id].corrections.length === 1);
expectThrow("队员不能校正标本", () =>
  commands.correctSpecimen(state, lin, sp.id, { reason: "x", after: { name: "陶罐", qty: 2, coord: "x" } }, ctx),
);
expectThrow("校正数量必须为正整数", () =>
  commands.correctSpecimen(state, shen, sp.id, { reason: "x", after: { name: "陶罐", qty: 0, coord: "x" } }, ctx),
);

expectThrow("队员不能交回入库", () => commands.returnSpecimens(state, zhao, [sp.id], ctx));
apply(commands.returnSpecimens(state, shen, [sp.id], ctx));
check("交回后为已交回", state.specimens[sp.id].status === "returned");
expectThrow("不能再次交回", () => commands.returnSpecimens(state, shen, [sp.id], ctx));

// ---------- 收官闸口 ----------
expectThrow("西湾有未处理标本，领队也不能收官", () => commands.closeSite(state, gao, "s-xhw", ctx));
expectThrow("非领队不能收官", () => commands.closeSite(state, shen, "s-dg", ctx));

apply(commands.registerSpecimen(state, zhao, { layerId: l6, name: "石片", qty: 1, coord: "E2 N2" }, ctx));
const sp2 = Object.values(state.specimens).find((s) => s.name === "石片" && s.layerId === l6)!;
expectThrow("新增未交接标本后不能收官", () => commands.closeSite(state, gao, "s-dg", ctx));
apply(commands.handOver(state, zhao, [sp2.id], shen.id, ctx));
expectThrow("待整理（未交回）仍不能收官", () => commands.closeSite(state, gao, "s-dg", ctx));
apply(commands.returnSpecimens(state, shen, [sp2.id], ctx));

apply(commands.closeSite(state, gao, "s-dg", ctx));
check("全部处理完可以收官", Boolean(state.closures["s-dg"]));
expectThrow("已收官不能重复宣布", () => commands.closeSite(state, gao, "s-dg", ctx));
expectThrow("非领队不能重开", () => commands.reopenSite(state, shen, "s-dg", ctx));
apply(commands.reopenSite(state, gao, "s-dg", ctx));
check("重开后收官标记消失", !state.closures["s-dg"]);

// ---------- 派生数量与筛选 ----------
const counts = countSpecimens(Object.values(state.specimens));
check("总件数随登记与校正变化：23 + 3 + 1 = 27", counts.total === 27, `实际 ${counts.total}`);
const dgSpecs = specimensAt(state, "s-dg");
check("按遗址筛选东岗 3 条标本", dgSpecs.length === 3, `实际 ${dgSpecs.length}`);
const t0203 = specimensAt(state, "s-xhw", "q-0203");
check("按遗址+探方筛选 T0203 为 2 条", t0203.length === 2 && t0203.every((s) => s.squareId === "q-0203"));

// ---------- 事件流可重建（续用） ----------
check("状态可从事件流完整重建", JSON.stringify(reduceAll(stream)) === JSON.stringify(state));

// ---------- 保存层往返（内存 localStorage） ----------
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
(globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
const store = createStore();
check("首次加载为演示数据", store.load().length === SEED_EVENTS.length);
store.append([stream[stream.length - 1]]);
check("append 后刷新可续读", store.load().length === SEED_EVENTS.length + 1);
check("仓库可归约出状态", Object.keys(store.getState().specimens).length > 0);

console.log(failures === 0 ? "\n全部规则测试通过" : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
