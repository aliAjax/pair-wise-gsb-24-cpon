// 资料层：台账事件（append-only，所有状态变化都由事件表达，天然可追溯）

import type { ConclusionSnapshot, FeatureInput, SpecimenSnapshot } from "./types";

export interface EventBase {
  id: string;
  at: number;
  by: string; // 操作人 person id
}

/** 队员新建地层（带草稿结论） */
export interface LayerCreatedEvent extends EventBase {
  type: "layer_created";
  layerId: string;
  siteId: string;
  squareId: string;
  code: string;
  conclusionId: string;
  draft: ConclusionSnapshot;
}

/** 队员更新自己的草稿 */
export interface DraftUpdatedEvent extends EventBase {
  type: "draft_updated";
  layerId: string;
  patch: Partial<ConclusionSnapshot>;
}

/** 队员提交结论（提交后本人也不能再直接改） */
export interface ConclusionSubmittedEvent extends EventBase {
  type: "conclusion_submitted";
  layerId: string;
}

/** 队员补充同层观察（不动他人结论） */
export interface ObservationAddedEvent extends EventBase {
  type: "observation_added";
  layerId: string;
  observationId: string;
  text: string;
}

/** 整理员校正已交结论（写原因、留原值） */
export interface RecordCorrectedEvent extends EventBase {
  type: "record_corrected";
  layerId: string;
  correctionId: string;
  reason: string;
  before: ConclusionSnapshot;
  after: ConclusionSnapshot;
}

/** 任何人登记标本（在某地层下） */
export interface SpecimenRegisteredEvent extends EventBase {
  type: "specimen_registered";
  specimenId: string;
  code: string;
  siteId: string;
  squareId: string;
  layerId: string;
  input: SpecimenSnapshot;
}

/** 队员把未交接标本交给整理员 */
export interface SpecimenHandedEvent extends EventBase {
  type: "specimen_handed";
  specimenIds: string[];
  receiverId: string;
}

/** 整理员整理后交回入库 */
export interface SpecimenReturnedEvent extends EventBase {
  type: "specimen_returned";
  specimenIds: string[];
}

/** 整理员校正标本（写原因、留原值；数量随之变化） */
export interface SpecimenCorrectedEvent extends EventBase {
  type: "specimen_corrected";
  specimenId: string;
  correctionId: string;
  reason: string;
  before: SpecimenSnapshot;
  after: SpecimenSnapshot;
}

/** 领队宣布遗址收官 / 重开 */
export interface SiteClosedEvent extends EventBase {
  type: "site_closed";
  siteId: string;
}

export interface SiteReopenedEvent extends EventBase {
  type: "site_reopened";
  siteId: string;
}

export type LedgerEvent =
  | LayerCreatedEvent
  | DraftUpdatedEvent
  | ConclusionSubmittedEvent
  | ObservationAddedEvent
  | RecordCorrectedEvent
  | SpecimenRegisteredEvent
  | SpecimenHandedEvent
  | SpecimenReturnedEvent
  | SpecimenCorrectedEvent
  | SiteClosedEvent
  | SiteReopenedEvent;

/** 遗迹单位录入项（随地层草稿一起提交） */
export type { FeatureInput };
