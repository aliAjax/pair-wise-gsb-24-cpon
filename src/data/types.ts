// 资料层：领域模型（人员、遗址、探方、地层记录、标本、台账状态）

export type Role = "member" | "cataloger" | "leader";

export interface Person {
  id: string;
  name: string;
  role: Role;
}

export interface Site {
  id: string;
  name: string;
}

export interface Square {
  id: string;
  name: string;
  siteId: string;
}

export type FeatureKind = "灰坑" | "墓葬" | "房址" | "沟状遗迹" | "灶址" | "其他";

export interface Feature {
  id: string;
  code: string; // 遗迹单位号，如 H12、F2
  kind: FeatureKind;
  soil: string; // 土色土质
  note: string;
}

export type FeatureInput = Omit<Feature, "id">;

// 未交接（待整理）→ 已交接（整理中）→ 已交回（已入库）
export type SpecimenStatus = "unhanded" | "handed" | "returned";

export interface SpecimenSnapshot {
  name: string;
  qty: number;
  coord: string;
}

export interface SpecimenCorrection {
  id: string;
  at: number;
  by: string;
  reason: string;
  before: SpecimenSnapshot;
  after: SpecimenSnapshot;
}

export interface Specimen extends SpecimenSnapshot {
  id: string;
  code: string;
  siteId: string;
  squareId: string;
  layerId: string;
  registeredBy: string;
  registeredAt: number;
  status: SpecimenStatus;
  handedAt?: number;
  handedBy?: string;
  receiverId?: string;
  returnedAt?: number;
  corrections: SpecimenCorrection[];
}

export interface ConclusionSnapshot {
  openingDepth: string; // 开口深度
  summary: string; // 地层小结
  features: Feature[]; // 遗迹
}

export interface RecordCorrection {
  id: string;
  at: number;
  by: string; // 整理员
  reason: string;
  before: ConclusionSnapshot;
  after: ConclusionSnapshot;
}

export interface Conclusion extends ConclusionSnapshot {
  id: string;
  authorId: string;
  at: number;
  updatedAt: number;
  submitted: boolean;
  submittedAt?: number;
  corrections: RecordCorrection[];
}

export interface Observation {
  id: string;
  at: number;
  authorId: string;
  text: string;
}

export interface LayerRecord {
  id: string;
  code: string; // 地层编号，如 第3层
  siteId: string;
  squareId: string;
  creatorId: string;
  createdAt: number;
  conclusion?: Conclusion;
  observations: Observation[];
}

export interface ClosureInfo {
  at: number;
  by: string;
}

export interface LedgerState {
  layers: Record<string, LayerRecord>;
  specimens: Record<string, Specimen>;
  closures: Record<string, ClosureInfo>;
}
