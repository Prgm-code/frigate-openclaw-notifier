import { EventContext, ReviewMessage, TrackedObjectUpdate, getReviewState, selectEventId } from "./event-models.js";

export class EventCorrelator {
  private readonly byReviewId = new Map<string, EventContext>();
  private readonly byEventId = new Map<string, EventContext>();

  constructor(private readonly ttlMs: number = 10 * 60 * 1000) {}

  upsertReview(message: ReviewMessage, now = Date.now()): EventContext {
    this.prune(now);
    const state = getReviewState(message);
    const reviewId = state?.id;
    const eventId = selectEventId(message);
    const existing = (reviewId ? this.byReviewId.get(reviewId) : undefined) || (eventId ? this.byEventId.get(eventId) : undefined);
    const eventIds = unique([...(existing?.eventIds || []), ...(state?.data?.detections || [])]);

    const context: EventContext = {
      ...existing,
      reviewId: reviewId || existing?.reviewId,
      eventIds,
      camera: state?.camera || existing?.camera,
      severity: state?.severity || existing?.severity,
      objects: unique([...(existing?.objects || []), ...(state?.data?.objects || [])]),
      zones: unique([...(existing?.zones || []), ...(state?.data?.zones || [])]),
      subLabels: unique([...(existing?.subLabels || []), ...(state?.data?.sub_labels || [])]),
      lastUpdatedAt: now
    };

    this.index(context);
    return context;
  }

  upsertTrackedObject(update: TrackedObjectUpdate, now = Date.now()): EventContext | undefined {
    this.prune(now);
    if (!update.id) {
      return undefined;
    }

    const existing = this.byEventId.get(update.id);
    const context: EventContext = {
      ...existing,
      eventIds: unique([...(existing?.eventIds || []), update.id]),
      camera: update.camera || existing?.camera,
      objects: unique([...(existing?.objects || []), ...(update.label ? [update.label] : [])]),
      zones: unique([...(existing?.zones || []), ...(update.current_zones || []), ...(update.entered_zones || [])]),
      subLabels: unique([...(existing?.subLabels || []), ...normalizeSubLabels(update.sub_label), maybeString(update.classification)]),
      description: update.description || existing?.description,
      lpr: update.lpr || maybeString(update["license_plate"]) || existing?.lpr,
      face: update.face || maybeString(update["recognized_face"]) || existing?.face,
      lastUpdatedAt: now
    };

    this.index(context);
    return context;
  }

  markNotified(context: EventContext, now = Date.now()): void {
    context.notifiedAt = now;
    context.lastUpdatedAt = now;
    this.index(context);
  }

  private index(context: EventContext): void {
    if (context.reviewId) {
      this.byReviewId.set(context.reviewId, context);
    }
    for (const eventId of context.eventIds) {
      this.byEventId.set(eventId, context);
    }
  }

  private prune(now: number): void {
    for (const [key, value] of this.byReviewId) {
      if (now - value.lastUpdatedAt > this.ttlMs) {
        this.byReviewId.delete(key);
      }
    }
    for (const [key, value] of this.byEventId) {
      if (now - value.lastUpdatedAt > this.ttlMs) {
        this.byEventId.delete(key);
      }
    }
  }
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalizeSubLabels(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function maybeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}
