import { NotifierConfig } from "../config/schema.js";
import { getReviewState, ReviewMessage } from "./event-models.js";

export interface RuleDecision {
  allowed: boolean;
  reason?: string;
}

export function shouldNotifyReview(message: ReviewMessage, config: NotifierConfig): RuleDecision {
  if (!isReviewTypeEnabled(message.type, config)) {
    return { allowed: false, reason: "review_type_disabled" };
  }

  const state = getReviewState(message);
  if (!state) {
    return { allowed: false, reason: "missing_review_state" };
  }

  if (config.allowedCameras.length > 0 && (!state.camera || !config.allowedCameras.includes(state.camera))) {
    return { allowed: false, reason: "camera_not_allowed" };
  }

  if (config.minSeverities.length > 0 && (!state.severity || !config.minSeverities.includes(state.severity))) {
    return { allowed: false, reason: "severity_not_allowed" };
  }

  const objects = state.data?.objects || [];
  if (config.allowedObjects.length > 0 && !objects.some((object) => config.allowedObjects.includes(object))) {
    return { allowed: false, reason: "object_not_allowed" };
  }

  const zones = state.data?.zones || [];
  if (config.blockedZones.length > 0 && zones.some((zone) => config.blockedZones.includes(zone))) {
    return { allowed: false, reason: "blocked_zone" };
  }

  return { allowed: true };
}

function isReviewTypeEnabled(type: ReviewMessage["type"], config: NotifierConfig): boolean {
  if (type === "new") {
    return config.notifyOnReviewNew;
  }
  if (type === "update") {
    return config.notifyOnReviewUpdate;
  }
  return config.notifyOnReviewEnd;
}
