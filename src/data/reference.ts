// 资料层：基础档案（人员、遗址、探方），台账事件从这里生成初始演示数据

import type { Person, Site, Square } from "./types";
import type { LedgerEvent } from "./events";

export const PEOPLE: Person[] = [
  { id: "p-gao", name: "高队长", role: "leader" },
  { id: "p-lin", name: "林队员", role: "member" },
  { id: "p-zhao", name: "赵队员", role: "member" },
  { id: "p-shen", name: "沈整理员", role: "cataloger" },
];

export const SITES: Site[] = [
  { id: "s-xhw", name: "西湾遗址" },
  { id: "s-dg", name: "东岗遗址" },
];

export const SQUARES: Square[] = [
  { id: "q-0203", name: "T0203", siteId: "s-xhw" },
  { id: "q-0204", name: "T0204", siteId: "s-xhw" },
  { id: "q-0301", name: "T0301", siteId: "s-xhw" },
  { id: "q-0101", name: "T0101", siteId: "s-dg" },
];

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-09-20T08:00:00+08:00");

let seq = 0;
function eid(prefix: string): string {
  seq += 1;
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

function makeEvents(): LedgerEvent[] {
  const ev: LedgerEvent[] = [];
  let t = T0;
  const at = (offsetMin: number) => t + offsetMin * 60_000;

  // T0203 第3层：林队员登记并提交；赵队员补充观察；沈整理员校正过一次
  ev.push({
    id: eid("ev"),
    at: at(0),
    by: "p-lin",
    type: "layer_created",
    layerId: "l-0203-3",
    siteId: "s-xhw",
    squareId: "q-0203",
    code: "第3层",
    conclusionId: "c-0203-3",
    draft: {
      openingDepth: "0.42",
      summary: "灰褐色沙土，结构较疏松，出土陶片集中于探方东北部。",
      features: [
        { id: "f-0203-1", code: "H12", kind: "灰坑", soil: "黑褐土，夹炭屑", note: "坑壁斜收，见动物骨骼" },
      ],
    },
  });
  ev.push({ id: eid("ev"), at: at(40), by: "p-lin", type: "conclusion_submitted", layerId: "l-0203-3" });
  ev.push({
    id: eid("ev"),
    at: at(75),
    by: "p-zhao",
    type: "observation_added",
    layerId: "l-0203-3",
    observationId: "o-1",
    text: "H12 坑口东侧另有陶片散布，疑与灰坑同期堆积，建议画关系图。",
  });
  ev.push({
    id: eid("ev"),
    at: at(180),
    by: "p-shen",
    type: "record_corrected",
    layerId: "l-0203-3",
    correctionId: "rc-1",
    reason: "复测水准点后开口深度应为 0.45 米；陶片质地区分后补充夹砂陶描述。",
    before: {
      openingDepth: "0.42",
      summary: "灰褐色沙土，结构较疏松，出土陶片集中于探方东北部。",
      features: [
        { id: "f-0203-1", code: "H12", kind: "灰坑", soil: "黑褐土，夹炭屑", note: "坑壁斜收，见动物骨骼" },
      ],
    },
    after: {
      openingDepth: "0.45",
      summary: "灰褐色沙土，结构较疏松，出土夹砂陶片集中于探方东北部。",
      features: [
        { id: "f-0203-1", code: "H12", kind: "灰坑", soil: "黑褐土，夹炭屑", note: "坑壁斜收，见动物骨骼" },
      ],
    },
  });
  ev.push({
    id: eid("ev"),
    at: at(95),
    by: "p-lin",
    type: "specimen_registered",
    specimenId: "sp-1",
    code: "XHW-T0203-3:001",
    siteId: "s-xhw",
    squareId: "q-0203",
    layerId: "l-0203-3",
    input: { name: "夹砂陶片", qty: 12, coord: "E3 N4" },
  });
  ev.push({
    id: eid("ev"),
    at: at(130),
    by: "p-zhao",
    type: "specimen_registered",
    specimenId: "sp-2",
    code: "XHW-T0203-3:002",
    siteId: "s-xhw",
    squareId: "q-0203",
    layerId: "l-0203-3",
    input: { name: "动物骨", qty: 3, coord: "E2.8 N3.6" },
  });
  ev.push({ id: eid("ev"), at: at(150), by: "p-lin", type: "specimen_handed", specimenIds: ["sp-1", "sp-2"], receiverId: "p-shen" });
  ev.push({ id: eid("ev"), at: at(300), by: "p-shen", type: "specimen_returned", specimenIds: ["sp-1", "sp-2"] });
  ev.push({
    id: eid("ev"),
    at: at(320),
    by: "p-shen",
    type: "specimen_corrected",
    specimenId: "sp-1",
    correctionId: "sc-1",
    reason: "清洗拼对后确认含可复原器口沿 2 件，按完整登记件数核减。",
    before: { name: "夹砂陶片", qty: 12, coord: "E3 N4" },
    after: { name: "夹砂陶片", qty: 10, coord: "E3 N4" },
  });

  // T0204 第2层：赵队员的草稿，尚未提交
  t += DAY;
  ev.push({
    id: eid("ev"),
    at: t,
    by: "p-zhao",
    type: "layer_created",
    layerId: "l-0204-2",
    siteId: "s-xhw",
    squareId: "q-0204",
    code: "第2层",
    conclusionId: "c-0204-2",
    draft: {
      openingDepth: "0.3",
      summary: "黄褐土，较致密，含少量红烧土颗粒。",
      features: [],
    },
  });
  ev.push({
    id: eid("ev"),
    at: t + 50 * 60_000,
    by: "p-zhao",
    type: "specimen_registered",
    specimenId: "sp-3",
    code: "XHW-T0204-2:001",
    siteId: "s-xhw",
    squareId: "q-0204",
    layerId: "l-0204-2",
    input: { name: "红烧土块", qty: 6, coord: "E1 N2" },
  });

  // T0301 F2房址层：林队员已交，赵队员补充柱洞复核意见；标本只交接未交回
  t += DAY;
  ev.push({
    id: eid("ev"),
    at: t,
    by: "p-lin",
    type: "layer_created",
    layerId: "l-0301-2",
    siteId: "s-xhw",
    squareId: "q-0301",
    code: "第2层",
    conclusionId: "c-0301-2",
    draft: {
      openingDepth: "0.55",
      summary: "夯土居住面，发现柱洞两组，叠压打破关系待确认。",
      features: [
        { id: "f-0301-1", code: "F2", kind: "房址", soil: "夯土面", note: "柱洞关系需复核" },
      ],
    },
  });
  ev.push({ id: eid("ev"), at: t + 30 * 60_000, by: "p-lin", type: "conclusion_submitted", layerId: "l-0301-2" });
  ev.push({
    id: eid("ev"),
    at: t + 90 * 60_000,
    by: "p-zhao",
    type: "observation_added",
    layerId: "l-0301-2",
    observationId: "o-2",
    text: "西侧柱洞打破第3层，F2 应晚于第3层；夯土面下未见活动面。",
  });
  ev.push({
    id: eid("ev"),
    at: t + 120 * 60_000,
    by: "p-lin",
    type: "specimen_registered",
    specimenId: "sp-4",
    code: "XHW-T0301-2:001",
    siteId: "s-xhw",
    squareId: "q-0301",
    layerId: "l-0301-2",
    input: { name: "石斧", qty: 1, coord: "E4 N1.5" },
  });
  ev.push({
    id: eid("ev"),
    at: t + 150 * 60_000,
    by: "p-lin",
    type: "specimen_registered",
    specimenId: "sp-5",
    code: "XHW-T0301-2:002",
    siteId: "s-xhw",
    squareId: "q-0301",
    layerId: "l-0301-2",
    input: { name: "陶豆残件", qty: 2, coord: "E4.2 N1.6" },
  });
  ev.push({ id: eid("ev"), at: t + 180 * 60_000, by: "p-lin", type: "specimen_handed", specimenIds: ["sp-4", "sp-5"], receiverId: "p-shen" });

  // 东岗 T0101：全部标本已交回入库，可收官（用于演示收官闸口）
  t += DAY;
  ev.push({
    id: eid("ev"),
    at: t,
    by: "p-zhao",
    type: "layer_created",
    layerId: "l-0101-4",
    siteId: "s-dg",
    squareId: "q-0101",
    code: "第4层",
    conclusionId: "c-0101-4",
    draft: {
      openingDepth: "0.8",
      summary: "灰黑淤土层，出土遗物少，为自然淤积层。",
      features: [],
    },
  });
  ev.push({ id: eid("ev"), at: t + 20 * 60_000, by: "p-zhao", type: "conclusion_submitted", layerId: "l-0101-4" });
  ev.push({
    id: eid("ev"),
    at: t + 60 * 60_000,
    by: "p-zhao",
    type: "specimen_registered",
    specimenId: "sp-6",
    code: "DG-T0101-4:001",
    siteId: "s-dg",
    squareId: "q-0101",
    layerId: "l-0101-4",
    input: { name: "磨制石锛", qty: 1, coord: "E2 N2" },
  });
  ev.push({ id: eid("ev"), at: t + 90 * 60_000, by: "p-zhao", type: "specimen_handed", specimenIds: ["sp-6"], receiverId: "p-shen" });
  ev.push({ id: eid("ev"), at: t + 240 * 60_000, by: "p-shen", type: "specimen_returned", specimenIds: ["sp-6"] });

  return ev;
}

export const SEED_EVENTS: LedgerEvent[] = makeEvents();
