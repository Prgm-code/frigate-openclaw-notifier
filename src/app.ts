import {
  AlertStatePublisher,
  cameraCommandTopic,
  cameraStateTopic,
  formatCameraAlertControlMessage,
  formatGlobalAlertControlMessage,
  formatHomeAssistantOpenClawControlMessage,
  parseHomeAssistantOpenClawPayload,
  parseAlertControlPayload,
  slugifyTopicPart
} from "./alert-control.js";
import { NotifierConfig } from "./config/schema.js";
import { DedupeStore } from "./dedupe/store.js";
import { EventCorrelator } from "./frigate/correlator.js";
import { EventContext, getFrigateEventState, parseFrigateEventMessage, parseReviewMessage, parseTrackedObjectUpdate, selectEventId } from "./frigate/event-models.js";
import { shouldNotifyReview } from "./frigate/rules.js";
import { Logger, redactTarget } from "./logger.js";
import { cleanupOldMedia, removeMediaFiles } from "./media/cleanup.js";
import { MediaResolver } from "./media/resolver.js";
import { processVideoForWhatsapp } from "./media/video.js";
import { OpenClawCli } from "./openclaw/cli.js";
import { OpenClawSendResult } from "./openclaw/types.js";
import { renderCaption } from "./templates/text.js";

export class NotifierApp {
  private alertsEnabled: boolean;
  private homeAssistantOpenClawEnabled: boolean;
  private readonly cameraAlertsEnabled = new Map<string, boolean>();
  private readonly cameraBySlug = new Map<string, string>();
  private alertStatePublisher?: AlertStatePublisher;

  constructor(
    readonly config: NotifierConfig,
    private readonly logger: Logger,
    private readonly correlator: EventCorrelator,
    private readonly dedupe: DedupeStore,
    private readonly mediaResolver: MediaResolver,
    private readonly openclaw: OpenClawCli
  ) {
    this.alertsEnabled = config.alertControlDefaultEnabled;
    this.homeAssistantOpenClawEnabled = config.homeAssistantOpenClawDefaultEnabled;
    for (const camera of config.allowedCameras) {
      this.cameraAlertsEnabled.set(camera, config.alertControlDefaultEnabled);
      this.cameraBySlug.set(slugifyTopicPart(camera), camera);
    }
  }

  setAlertStatePublisher(publisher: AlertStatePublisher): void {
    this.alertStatePublisher = publisher;
  }

  publishAlertState(source: string): void {
    const payload = {
      enabled: this.alertsEnabled,
      updatedAt: new Date().toISOString(),
      source
    };

    this.alertStatePublisher?.(this.config.alertControlStateTopic, payload);
    this.logger.info("alert_control_state_published", payload);
  }

  publishAllAlertStates(source: string): void {
    this.publishAlertState(source);
    this.publishHomeAssistantOpenClawState(source);
    for (const camera of this.config.allowedCameras) {
      this.publishCameraAlertState(camera, source);
    }
  }

  handleHomeAssistantOpenClawControlCommand(payload: string | Buffer): void {
    this.applyHomeAssistantOpenClawControlPayload(payload, "command");
  }

  handleHomeAssistantOpenClawControlState(payload: string | Buffer): void {
    this.applyHomeAssistantOpenClawControlPayload(payload, "retained_state");
  }

  private applyHomeAssistantOpenClawControlPayload(payload: string | Buffer, source: string): void {
    const enabled = parseAlertControlPayload(payload);
    if (enabled === undefined) {
      this.logger.warn("homeassistant_openclaw_control_command_invalid", { payload: payload.toString() });
      this.publishHomeAssistantOpenClawState("invalid_command");
      return;
    }

    this.homeAssistantOpenClawEnabled = enabled;
    this.logger.info("homeassistant_openclaw_control_state_changed", { enabled, source });
    if (source === "command") {
      this.publishHomeAssistantOpenClawState("command");
      this.sendAlertControlConfirmation(formatHomeAssistantOpenClawControlMessage(enabled), {
        scope: "homeassistant_openclaw",
        enabled
      });
    }
  }

  private publishHomeAssistantOpenClawState(source: string): void {
    const payload = {
      enabled: this.homeAssistantOpenClawEnabled,
      updatedAt: new Date().toISOString(),
      source
    };
    this.alertStatePublisher?.(this.config.homeAssistantOpenClawControlStateTopic, payload);
    this.logger.info("homeassistant_openclaw_control_state_published", payload);
  }

  handleAlertControlCommand(payload: string | Buffer): void {
    this.applyAlertControlPayload(payload, "command");
  }

  handleAlertControlState(payload: string | Buffer): void {
    this.applyAlertControlPayload(payload, "retained_state");
  }

  private applyAlertControlPayload(payload: string | Buffer, source: string): void {
    const enabled = parseAlertControlPayload(payload);
    if (enabled === undefined) {
      this.logger.warn("alert_control_command_invalid", { payload: payload.toString() });
      this.publishAlertState("invalid_command");
      return;
    }

    this.alertsEnabled = enabled;
    this.logger.info("alert_control_state_changed", { enabled, source });
    if (source === "command") {
      this.publishAlertState("command");
      this.sendAlertControlConfirmation(formatGlobalAlertControlMessage(enabled), { scope: "global", enabled });
    }
  }

  cameraControlCommandTopics(): string[] {
    return this.config.allowedCameras.map((camera) => cameraCommandTopic(this.config.alertControlCameraTopicPrefix, camera));
  }

  cameraStateTopics(): Array<{ camera: string; commandTopic: string; stateTopic: string }> {
    return this.config.allowedCameras.map((camera) => ({
      camera,
      commandTopic: cameraCommandTopic(this.config.alertControlCameraTopicPrefix, camera),
      stateTopic: cameraStateTopic(this.config.alertControlCameraTopicPrefix, camera)
    }));
  }

  handleCameraAlertControlCommand(topic: string, payload: string | Buffer): boolean {
    if (!topic.endsWith("/set")) {
      return false;
    }
    return this.applyCameraAlertControlPayload(topic, payload, "command");
  }

  handleCameraAlertControlState(topic: string, payload: string | Buffer): boolean {
    if (!topic.endsWith("/state")) {
      return false;
    }
    return this.applyCameraAlertControlPayload(topic, payload, "retained_state");
  }

  async handleHomeAssistantOpenClawMessage(payload: string | Buffer): Promise<void> {
    const message = parseHomeAssistantOpenClawPayload(payload);
    if (!message) {
      this.logger.warn("homeassistant_openclaw_message_invalid", { payload: payload.toString() });
      return;
    }

    if (!this.homeAssistantOpenClawEnabled) {
      this.logger.info("homeassistant_openclaw_message_suppressed", { reason: "homeassistant_openclaw_disabled" });
      return;
    }

    this.logger.info("homeassistant_openclaw_message_received", {
      targets: this.redactedTargets(),
      length: message.length
    });
    this.logger.info("openclaw_send_started", {
      source: "homeassistant/mqtt",
      kind: "text",
      targets: this.redactedTargets()
    });

    const results = await this.sendTextToTargets(message);
    this.logger.info("homeassistant_openclaw_message_sent", {
      results: this.formatSendResults(results)
    });
  }

  private applyCameraAlertControlPayload(topic: string, payload: string | Buffer, source: string): boolean {
    const prefix = `${this.config.alertControlCameraTopicPrefix.replace(/^\/+|\/+$/g, "")}/cameras/`;
    if (!topic.startsWith(prefix) || (!topic.endsWith("/set") && !topic.endsWith("/state"))) {
      return false;
    }

    const suffixLength = topic.endsWith("/set") ? "/set".length : "/state".length;
    const slug = topic.slice(prefix.length, -suffixLength);
    const camera = this.cameraBySlug.get(slug);
    if (!camera) {
      this.logger.warn("camera_alert_control_command_unknown_camera", { topic, slug });
      return true;
    }

    const enabled = parseAlertControlPayload(payload);
    if (enabled === undefined) {
      this.logger.warn("camera_alert_control_command_invalid", { camera, payload: payload.toString() });
      this.publishCameraAlertState(camera, "invalid_command");
      return true;
    }

    this.cameraAlertsEnabled.set(camera, enabled);
    this.logger.info("camera_alert_control_state_changed", { camera, enabled, source });
    if (source === "command") {
      this.publishCameraAlertState(camera, "command");
      this.sendAlertControlConfirmation(formatCameraAlertControlMessage(camera, enabled), { scope: "camera", camera, enabled });
    }
    return true;
  }

  private publishCameraAlertState(camera: string, source: string): void {
    const enabled = this.cameraAlertsEnabled.get(camera) ?? this.config.alertControlDefaultEnabled;
    const payload = {
      enabled,
      camera,
      updatedAt: new Date().toISOString(),
      source
    };
    this.alertStatePublisher?.(cameraStateTopic(this.config.alertControlCameraTopicPrefix, camera), payload);
    this.logger.info("camera_alert_control_state_published", payload);
  }

  async handleFrigateEvent(payload: string | Buffer): Promise<void> {
    const message = parseFrigateEventMessage(payload);
    const state = getFrigateEventState(message);
    const eventId = state.id;
    const zones = state.current_zones || state.entered_zones || [];

    this.logger.info("frigate_event_received", {
      type: message.type,
      eventId,
      camera: state.camera,
      label: state.label,
      zones,
      score: state.score,
      hasSnapshot: state.has_snapshot,
      hasClip: state.has_clip
    });

    if (message.type && !["new", "update"].includes(message.type)) {
      this.logger.info("frigate_event_skipped", { reason: "event_type_ignored", type: message.type, eventId });
      return;
    }
    if (!eventId) {
      this.logger.warn("frigate_event_missing_id", { type: message.type, camera: state.camera });
      return;
    }
    if (!this.alertsEnabled) {
      this.logger.info("frigate_event_notification_suppressed", { reason: "alerts_disabled", type: message.type, eventId, camera: state.camera });
      return;
    }
    if (state.camera && !this.isCameraEnabled(state.camera)) {
      this.logger.info("frigate_event_notification_suppressed", { reason: "camera_alerts_disabled", type: message.type, eventId, camera: state.camera });
      return;
    }
    if (this.config.allowedCameras.length > 0 && (!state.camera || !this.config.allowedCameras.includes(state.camera))) {
      this.logger.info("frigate_event_skipped", { reason: "camera_not_allowed", eventId, camera: state.camera });
      return;
    }
    if (this.config.allowedObjects.length > 0 && (!state.label || !this.config.allowedObjects.includes(state.label))) {
      this.logger.info("frigate_event_skipped", { reason: "object_not_allowed", eventId, label: state.label });
      return;
    }
    if (this.config.blockedZones.length > 0 && zones.some((zone) => this.config.blockedZones.includes(zone))) {
      this.logger.info("frigate_event_skipped", { reason: "blocked_zone", eventId, zones });
      return;
    }

    const context: EventContext = {
      eventIds: [eventId],
      camera: state.camera,
      severity: message.type || "event",
      objects: state.label ? [state.label] : [],
      zones,
      lastUpdatedAt: Date.now()
    };
    const caption = renderCaption(context, this.config.messageTimeZone);
    const dedupeKey = `event:${eventId}`;
    const dedupeDecision = this.dedupe.check(dedupeKey, caption);
    if (dedupeDecision.duplicate) {
      this.logger.info("frigate_event_duplicate_suppressed", { reason: dedupeDecision.reason, eventId });
      return;
    }

    this.dedupe.markInFlight(dedupeKey, caption);
    this.logger.info("frigate_event_selected_for_notification", {
      eventId,
      camera: state.camera,
      label: state.label,
      willTrySnapshot: this.config.sendSnapshot && state.has_snapshot !== false,
      willTryClip: this.config.sendClip && state.has_clip !== false
    });

    try {
      try {
        const sentSnapshot = await this.sendFrigateEventSnapshot(state.camera, eventId, caption, state.has_snapshot);
        if (!sentSnapshot) {
          this.logger.info("openclaw_send_started", {
            source: "frigate/events",
            kind: "text",
            eventId,
            targets: this.redactedTargets()
          });
          const results = await this.sendTextToTargets(caption);
          this.logger.info("whatsapp_text_sent", {
            source: "frigate/events",
            eventId,
            results: this.formatSendResults(results)
          });
        }
      } catch (error) {
        this.logger.error("frigate_event_alert_send_failed", {
          eventId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      this.dedupe.mark(dedupeKey, caption);
      if (this.config.sendClip && state.has_clip !== false) {
        this.logger.info("frigate_event_clip_scheduled", { eventId });
        this.sendFrigateEventClipWhenReady(eventId, state.camera, caption).catch((error: unknown) => {
          this.logger.error("frigate_event_clip_send_failed", {
            eventId,
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }
    } finally {
      await this.cleanupMedia();
    }
  }

  async handleReview(payload: string | Buffer): Promise<void> {
    const message = parseReviewMessage(payload);
    const decision = shouldNotifyReview(message, this.config);
    if (!decision.allowed) {
      this.logger.debug("review_skipped", { reason: decision.reason, type: message.type });
      return;
    }

    const context = this.correlator.upsertReview(message);
    const caption = renderCaption(context, this.config.messageTimeZone);
    const dedupeKey = context.reviewId || selectEventId(message);
    if (!dedupeKey) {
      this.logger.warn("review_missing_dedupe_key");
      return;
    }
    if (!this.alertsEnabled) {
      this.logger.info("review_notification_suppressed", { reason: "alerts_disabled", reviewId: context.reviewId, eventId: context.eventIds[0] });
      return;
    }
    if (context.camera && !this.isCameraEnabled(context.camera)) {
      this.logger.info("review_notification_suppressed", { reason: "camera_alerts_disabled", reviewId: context.reviewId, eventId: context.eventIds[0], camera: context.camera });
      return;
    }

    const dedupeDecision = this.dedupe.check(dedupeKey, caption);
    if (dedupeDecision.duplicate) {
      this.logger.info("review_duplicate_suppressed", { reason: dedupeDecision.reason, reviewId: context.reviewId });
      return;
    }

    try {
      const media = await this.mediaResolver.resolve(context.camera, context.eventIds[0]);
      if (media) {
        const results = await this.sendMediaToTargets(media.path, caption);
        this.logger.info("whatsapp_media_sent", {
          kind: media.kind,
          reviewId: context.reviewId,
          eventId: context.eventIds[0],
          results: this.formatSendResults(results)
        });
      } else {
        const results = await this.sendTextToTargets(caption);
        this.logger.info("whatsapp_text_sent", {
          reviewId: context.reviewId,
          eventId: context.eventIds[0],
          results: this.formatSendResults(results)
        });
      }

      const now = Date.now();
      this.dedupe.mark(dedupeKey, caption, now);
      this.correlator.markNotified(context, now);
    } finally {
      await this.cleanupMedia();
    }
  }

  handleTrackedObjectUpdate(payload: string | Buffer): void {
    const update = parseTrackedObjectUpdate(payload);
    const context = this.correlator.upsertTrackedObject(update);
    this.logger.debug("tracked_object_update_received", {
      eventId: update.id,
      enriched: Boolean(context)
    });
  }

  private async sendFrigateEventSnapshot(
    camera: string | undefined,
    eventId: string,
    caption: string,
    hasSnapshot: boolean | undefined
  ): Promise<boolean> {
    if (this.config.sendSnapshot && hasSnapshot !== false) {
      this.logger.info("frigate_event_snapshot_resolve_started", { eventId, camera });
      const snapshot = await this.mediaResolver.resolveSnapshot(camera, eventId);
      if (snapshot) {
        this.logger.info("frigate_event_snapshot_resolved", { eventId, path: snapshot.path });
        this.logger.info("openclaw_send_started", {
          source: "frigate/events",
          kind: snapshot.kind,
          eventId,
          path: snapshot.path,
          targets: this.redactedTargets()
        });
        const results = await this.sendMediaToTargets(snapshot.path, caption);
        this.logger.info("whatsapp_media_sent", {
          source: "frigate/events",
          kind: snapshot.kind,
          eventId,
          results: this.formatSendResults(results)
        });
        return true;
      }

      this.logger.warn("frigate_event_snapshot_not_available", { eventId, camera });
    }

    return false;
  }

  private async sendFrigateEventClipWhenReady(eventId: string, camera: string | undefined, caption: string): Promise<void> {
    this.logger.info("frigate_event_clip_download_started", {
      eventId,
      attempts: this.config.clipRetryAttempts,
      retryDelayMs: this.config.clipRetryDelayMs
    });
    const clip = await this.mediaResolver.resolveClipWithRetry(eventId);
    if (!clip) {
      this.logger.warn("frigate_event_clip_not_ready", { eventId });
      return;
    }

    this.logger.info("frigate_event_clip_downloaded", { eventId, path: clip.path });
    const outputPath = this.mediaResolver.processedClipPath(clip.path);
    this.logger.info("frigate_event_clip_processing_started", {
      eventId,
      inputPath: clip.path,
      outputPath,
      ffmpegBin: this.config.ffmpegBin,
      timeoutMs: this.config.videoProcessTimeoutMs
    });
    let processedPath: string | undefined;
    try {
      processedPath = await processVideoForWhatsapp(this.config.ffmpegBin, clip.path, outputPath, this.config.videoProcessTimeoutMs);
      this.logger.info("frigate_event_clip_processing_completed", { eventId, path: processedPath });

      if (!this.alertsEnabled) {
        this.logger.info("frigate_event_clip_send_suppressed", { reason: "alerts_disabled", eventId });
        return;
      }
      if (camera && !this.isCameraEnabled(camera)) {
        this.logger.info("frigate_event_clip_send_suppressed", { reason: "camera_alerts_disabled", eventId, camera });
        return;
      }

      this.logger.info("openclaw_send_started", {
        source: "frigate/events",
        kind: "clip",
        eventId,
        path: processedPath,
        targets: this.redactedTargets()
      });
      const results = await this.sendMediaToTargets(processedPath, `Video: ${caption}`);
      this.logger.info("whatsapp_media_sent", {
        source: "frigate/events",
        kind: "clip",
        eventId,
        processed: true,
        results: this.formatSendResults(results)
      });
    } finally {
      await removeMediaFiles([clip.path, processedPath], this.logger);
      await this.cleanupMedia();
    }
  }

  cleanupMedia(): Promise<void> {
    return cleanupOldMedia(this.config.mediaTmpDir, this.config.mediaRetentionSeconds, this.logger);
  }

  private isCameraEnabled(camera: string): boolean {
    return this.cameraAlertsEnabled.get(camera) ?? this.config.alertControlDefaultEnabled;
  }

  private sendAlertControlConfirmation(message: string, fields: Record<string, unknown>): void {
    this.logger.info("alert_control_whatsapp_confirmation_started", {
      ...fields,
      targets: this.redactedTargets()
    });
    this.sendTextToTargets(message)
      .then((results) => {
        this.logger.info("alert_control_whatsapp_confirmation_sent", {
          ...fields,
          results: this.formatSendResults(results)
        });
      })
      .catch((error: unknown) => {
        this.logger.error("alert_control_whatsapp_confirmation_failed", {
          ...fields,
          error: error instanceof Error ? error.message : String(error)
        });
      });
  }

  private sendTextToTargets(message: string): Promise<OpenClawSendResult[]> {
    return Promise.all(this.config.openclawTargets.map((target) => this.openclaw.sendText(target, message)));
  }

  private sendMediaToTargets(mediaPathOrUrl: string, caption?: string): Promise<OpenClawSendResult[]> {
    return Promise.all(this.config.openclawTargets.map((target) => this.openclaw.sendMedia(target, mediaPathOrUrl, caption)));
  }

  private redactedTargets(): string[] {
    return this.config.openclawTargets.map((target) => redactTarget(target));
  }

  private formatSendResults(results: OpenClawSendResult[]): Array<{ target: string; messageId?: string; mediaUrl?: string }> {
    return results.map((result, index) => ({
      target: redactTarget(this.config.openclawTargets[index] || result.to),
      messageId: result.messageId,
      mediaUrl: result.mediaUrl
    }));
  }
}
