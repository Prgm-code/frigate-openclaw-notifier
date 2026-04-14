export interface ReviewData {
  detections?: string[];
  objects?: string[];
  sub_labels?: string[];
  zones?: string[];
  audio?: string[];
}

export interface ReviewState {
  id: string;
  camera?: string;
  severity?: string;
  data?: ReviewData;
  start_time?: number;
  end_time?: number;
}

export interface ReviewMessage {
  type: "new" | "update" | "end";
  before?: ReviewState;
  after?: ReviewState;
}

export interface TrackedObjectUpdate {
  type?: string;
  id?: string;
  camera?: string;
  description?: string;
  sub_label?: string | string[];
  current_zones?: string[];
  entered_zones?: string[];
  label?: string;
  lpr?: string;
  face?: string;
  classification?: string;
  [key: string]: unknown;
}

export interface FrigateEventState {
  id?: string;
  camera?: string;
  label?: string;
  current_zones?: string[];
  entered_zones?: string[];
  score?: number;
  has_clip?: boolean;
  has_snapshot?: boolean;
  start_time?: number;
  end_time?: number;
}

export interface FrigateEventMessage extends FrigateEventState {
  type?: "new" | "update" | "end";
  before?: FrigateEventState;
  after?: FrigateEventState;
}

export interface EventContext {
  reviewId?: string;
  eventIds: string[];
  camera?: string;
  severity?: string;
  objects?: string[];
  zones?: string[];
  subLabels?: string[];
  description?: string;
  lpr?: string;
  face?: string;
  lastUpdatedAt: number;
  notifiedAt?: number;
}

export function parseReviewMessage(payload: string | Buffer): ReviewMessage {
  const parsed = JSON.parse(payload.toString()) as unknown;
  if (!isObject(parsed)) {
    throw new Error("Review message must be an object");
  }

  const type = parsed.type;
  if (type !== "new" && type !== "update" && type !== "end") {
    throw new Error("Review message type must be new, update, or end");
  }

  return parsed as unknown as ReviewMessage;
}

export function parseTrackedObjectUpdate(payload: string | Buffer): TrackedObjectUpdate {
  const parsed = JSON.parse(payload.toString()) as unknown;
  if (!isObject(parsed)) {
    throw new Error("Tracked object update must be an object");
  }
  return parsed as TrackedObjectUpdate;
}

export function parseFrigateEventMessage(payload: string | Buffer): FrigateEventMessage {
  const parsed = JSON.parse(payload.toString()) as unknown;
  if (!isObject(parsed)) {
    throw new Error("Frigate event message must be an object");
  }
  return parsed as FrigateEventMessage;
}

export function getReviewState(message: ReviewMessage): ReviewState | undefined {
  return message.after || message.before;
}

export function selectEventId(message: ReviewMessage): string | undefined {
  const state = getReviewState(message);
  return state?.data?.detections?.find(Boolean);
}

export function getFrigateEventState(message: FrigateEventMessage): FrigateEventState {
  return message.after || message;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
