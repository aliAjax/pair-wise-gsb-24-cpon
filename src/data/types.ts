// 领域资料类型：探方台涉及的全部数据结构

export type Role = "member" | "curator"; // 发掘队员 / 资料整理员

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Site {
  id: string;
  name: string;
  closedAt: string | null; // 宣布收官的时间，未收官为 null
}

export interface Unit {
  id: string;
  siteId: string;
  code: string; // 探方号，如 T0203
}

/** 地层记录的三项核心内容，校正留痕时整体快照 */
export interface LayerSnapshot {
  openingDepth: string; // 开口深度
  features: string; // 遗迹
  conclusion: string; // 结论
}

/** 队员对他人已交结论的补充观察 */
export interface Observation {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

/** 整理员校正留痕：原因 + 原记录 + 新记录 */
export interface Revision {
  id: string;
  curatorId: string;
  curatorName: string;
  reason: string;
  before: LayerSnapshot;
  after: LayerSnapshot;
  createdAt: string;
}

export type RecordStatus = "draft" | "submitted"; // 草稿（可续记）/ 已交（锁定）

export interface LayerRecord {
  id: string;
  siteId: string;
  unitId: string;
  layer: string; // 地层，如 第3层
  openingDepth: string;
  features: string;
  conclusion: string;
  authorId: string;
  authorName: string;
  status: RecordStatus;
  observations: Observation[];
  revisions: Revision[];
  createdAt: string;
  updatedAt: string;
}

export interface SpecimenSnapshot {
  name: string;
  layer: string;
  quantity: number;
}

/** 整理员对标本的校正留痕 */
export interface SpecimenCorrection {
  id: string;
  curatorId: string;
  curatorName: string;
  reason: string;
  before: SpecimenSnapshot;
  after: SpecimenSnapshot;
  createdAt: string;
}

export type SpecimenStatus = "pending" | "handed"; // 待交接（未交接）/ 已交接

export interface Specimen {
  id: string;
  siteId: string;
  unitId: string;
  layer: string;
  name: string;
  quantity: number;
  status: SpecimenStatus;
  registeredById: string;
  registeredByName: string;
  registeredAt: string;
  handedAt: string | null;
  receiverName: string | null;
  corrections: SpecimenCorrection[];
}

export type AuditAction =
  | "save_draft"
  | "submit_record"
  | "add_observation"
  | "correct_record"
  | "register_specimen"
  | "handover_specimen"
  | "correct_specimen"
  | "close_site"
  | "reopen_site";

/** 追溯日志：谁在什么时候做了什么 */
export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  role: Role;
  action: AuditAction;
  summary: string;
}

export interface Database {
  version: number;
  users: User[];
  sites: Site[];
  units: Unit[];
  records: LayerRecord[];
  specimens: Specimen[];
  audit: AuditEvent[];
}
