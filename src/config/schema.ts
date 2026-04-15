export type LogLevel = "debug" | "info" | "warn" | "error";

export interface NotifierConfig {
  mqttUrl: string;
  mqttUsername?: string;
  mqttPassword?: string;
  mqttTopics: string[];
  homeAssistantOpenClawTopic: string;
  homeAssistantOpenClawControlCommandTopic: string;
  homeAssistantOpenClawControlStateTopic: string;
  homeAssistantOpenClawDefaultEnabled: boolean;
  alertControlCommandTopic: string;
  alertControlStateTopic: string;
  alertControlDefaultEnabled: boolean;
  alertControlCameraTopicPrefix: string;
  homeAssistantDiscoveryEnabled: boolean;
  homeAssistantDiscoveryPrefix: string;
  homeAssistantDeviceId: string;
  homeAssistantDeviceName: string;
  frigateBaseUrl: string;
  frigateUseLocalMedia: boolean;
  frigateLocalClipsDir: string;
  openclawBin: string;
  openclawChannel: "whatsapp";
  openclawAccount?: string;
  openclawTarget?: string;
  openclawGroupId?: string;
  openclawTargets: string[];
  notifyOnReviewNew: boolean;
  notifyOnReviewUpdate: boolean;
  notifyOnReviewEnd: boolean;
  sendSnapshot: boolean;
  sendClip: boolean;
  minSeverities: string[];
  allowedCameras: string[];
  allowedObjects: string[];
  blockedZones: string[];
  cooldownSeconds: number;
  mediaTmpDir: string;
  mediaRetentionSeconds: number;
  ffmpegBin: string;
  videoProcessTimeoutMs: number;
  clipRetryAttempts: number;
  clipRetryDelayMs: number;
  messageTimeZone: string;
  logLevel: LogLevel;
  openclawTimeoutMs: number;
  frigateFetchTimeoutMs: number;
}

const allowedLogLevels = new Set<LogLevel>(["debug", "info", "warn", "error"]);

export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean value: ${value}`);
}

export function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseNumber(value: string | undefined, defaultValue: number, name: string): number {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return parsed;
}

export function requireString(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

export function requireOneString(values: Array<{ value: string | undefined; name: string }>): void {
  if (!values.some((item) => item.value && item.value.trim() !== "")) {
    throw new Error(`One of ${values.map((item) => item.name).join(", ")} is required`);
  }
}

export function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = (value || "info").trim().toLowerCase();
  if (!allowedLogLevels.has(normalized as LogLevel)) {
    throw new Error(`LOG_LEVEL must be one of: ${Array.from(allowedLogLevels).join(", ")}`);
  }
  return normalized as LogLevel;
}
