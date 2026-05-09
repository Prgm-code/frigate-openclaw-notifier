import { NotifierConfig, parseBoolean, parseList, parseLogLevel, parseNumber, requireOneString, requireString } from "./schema.js";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): NotifierConfig {
  requireOneString([
    { value: env.OPENCLAW_TARGET, name: "OPENCLAW_TARGET" },
    { value: env.OPENCLAW_GROUP_ID, name: "OPENCLAW_GROUP_ID" }
  ]);
  const openclawTargets = [...new Set(parseList(`${env.OPENCLAW_TARGET || ""},${env.OPENCLAW_GROUP_ID || ""}`))];

  return {
    mqttUrl: requireString(env.MQTT_URL, "MQTT_URL"),
    mqttUsername: env.MQTT_USERNAME || undefined,
    mqttPassword: env.MQTT_PASSWORD || undefined,
    mqttTopics: parseList(env.MQTT_TOPICS).length > 0 ? parseList(env.MQTT_TOPICS) : ["frigate/reviews"],
    homeAssistantOpenClawTopic: env.HOME_ASSISTANT_OPENCLAW_TOPIC || "frigate-openclaw-notifier/openclaw/send",
    homeAssistantOpenClawControlCommandTopic: env.HOME_ASSISTANT_OPENCLAW_CONTROL_COMMAND_TOPIC || "frigate-openclaw-notifier/openclaw/set",
    homeAssistantOpenClawControlStateTopic: env.HOME_ASSISTANT_OPENCLAW_CONTROL_STATE_TOPIC || "frigate-openclaw-notifier/openclaw/state",
    homeAssistantOpenClawDefaultEnabled: parseBoolean(env.HOME_ASSISTANT_OPENCLAW_DEFAULT_ENABLED, true),
    alertControlCommandTopic: env.ALERT_CONTROL_COMMAND_TOPIC || "frigate-openclaw-notifier/alerts/set",
    alertControlStateTopic: env.ALERT_CONTROL_STATE_TOPIC || "frigate-openclaw-notifier/alerts/state",
    alertControlDefaultEnabled: parseBoolean(env.ALERT_CONTROL_DEFAULT_ENABLED, true),
    alertControlCameraTopicPrefix: env.ALERT_CONTROL_CAMERA_TOPIC_PREFIX || "frigate-openclaw-notifier/alerts",
    homeAssistantDiscoveryEnabled: parseBoolean(env.HOME_ASSISTANT_DISCOVERY_ENABLED, true),
    homeAssistantDiscoveryPrefix: env.HOME_ASSISTANT_DISCOVERY_PREFIX || "homeassistant",
    homeAssistantDeviceId: env.HOME_ASSISTANT_DEVICE_ID || "frigate_openclaw_notifier",
    homeAssistantDeviceName: env.HOME_ASSISTANT_DEVICE_NAME || "Frigate OpenClaw Notifier",
    frigateBaseUrl: requireString(env.FRIGATE_BASE_URL, "FRIGATE_BASE_URL"),
    frigateUseLocalMedia: parseBoolean(env.FRIGATE_USE_LOCAL_MEDIA, false),
    frigateLocalClipsDir: env.FRIGATE_LOCAL_CLIPS_DIR || "",
    openclawBin: env.OPENCLAW_BIN || "openclaw",
    openclawChannel: "whatsapp",
    openclawAccount: env.OPENCLAW_ACCOUNT || undefined,
    openclawTarget: env.OPENCLAW_TARGET || undefined,
    openclawGroupId: env.OPENCLAW_GROUP_ID || undefined,
    openclawTargets,
    notifyOnReviewNew: parseBoolean(env.NOTIFY_ON_REVIEW_NEW, true),
    notifyOnReviewUpdate: parseBoolean(env.NOTIFY_ON_REVIEW_UPDATE, false),
    notifyOnReviewEnd: parseBoolean(env.NOTIFY_ON_REVIEW_END, false),
    sendSnapshot: parseBoolean(env.SEND_SNAPSHOT, true),
    sendClip: parseBoolean(env.SEND_CLIP, true),
    minSeverities: parseList(env.MIN_SEVERITIES || "alert"),
    allowedCameras: parseList(env.ALLOWED_CAMERAS),
    allowedObjects: parseList(env.ALLOWED_OBJECTS),
    blockedZones: parseList(env.BLOCKED_ZONES),
    cooldownSeconds: parseNumber(env.COOLDOWN_SECONDS, 90, "COOLDOWN_SECONDS"),
    mediaTmpDir: requireString(env.MEDIA_TMP_DIR, "MEDIA_TMP_DIR"),
    mediaRetentionSeconds: parseNumber(env.MEDIA_RETENTION_SECONDS, 3600, "MEDIA_RETENTION_SECONDS"),
    ffmpegBin: env.FFMPEG_BIN || "ffmpeg",
    videoProcessTimeoutMs: parseNumber(env.VIDEO_PROCESS_TIMEOUT_MS, 120_000, "VIDEO_PROCESS_TIMEOUT_MS"),
    clipRetryAttempts: parseNumber(env.CLIP_RETRY_ATTEMPTS, 3, "CLIP_RETRY_ATTEMPTS"),
    clipRetryDelayMs: parseNumber(env.CLIP_RETRY_DELAY_MS, 3000, "CLIP_RETRY_DELAY_MS"),
    messageTimeZone: env.MESSAGE_TIME_ZONE || "America/Santiago",
    logLevel: parseLogLevel(env.LOG_LEVEL),
    openclawTimeoutMs: parseNumber(env.OPENCLAW_TIMEOUT_MS, 120_000, "OPENCLAW_TIMEOUT_MS"),
    frigateFetchTimeoutMs: parseNumber(env.FRIGATE_FETCH_TIMEOUT_MS, 15_000, "FRIGATE_FETCH_TIMEOUT_MS")
  };
}
