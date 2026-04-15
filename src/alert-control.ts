export interface AlertStatePayload {
  enabled: boolean;
  updatedAt: string;
  source: string;
  camera?: string;
}

export interface DiscoveryPayload {
  name: string;
  unique_id: string;
  command_topic: string;
  state_topic: string;
  payload_on: string;
  payload_off: string;
  state_on: string;
  state_off: string;
  value_template: string;
  retain: boolean;
  device: {
    identifiers: string[];
    name: string;
  };
}

export type AlertStatePublisher = (topic: string, payload: AlertStatePayload) => void;
export type DiscoveryPublisher = (topic: string, payload: DiscoveryPayload) => void;

export function parseAlertControlPayload(payload: string | Buffer): boolean | undefined {
  const text = payload.toString().trim();
  if (!text) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "boolean") {
      return parsed;
    }
    if (isObject(parsed) && typeof parsed.enabled === "boolean") {
      return parsed.enabled;
    }
  } catch {
    // Use the plain-text protocol below.
  }

  const normalized = text.toLowerCase();
  if (["on", "true", "1", "enabled", "enable"].includes(normalized)) {
    return true;
  }
  if (["off", "false", "0", "disabled", "disable"].includes(normalized)) {
    return false;
  }

  return undefined;
}

export function parseHomeAssistantOpenClawPayload(payload: string | Buffer): string | undefined {
  const text = payload.toString().trim();
  if (!text) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isMessagePayload(parsed)) {
      return undefined;
    }

    const message = parsed.message.trim();
    return message ? message : undefined;
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is { enabled?: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMessagePayload(value: unknown): value is { message: string } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as { message?: unknown }).message === "string";
}

export function slugifyTopicPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function cameraCommandTopic(prefix: string, camera: string): string {
  return `${trimSlash(prefix)}/cameras/${slugifyTopicPart(camera)}/set`;
}

export function cameraStateTopic(prefix: string, camera: string): string {
  return `${trimSlash(prefix)}/cameras/${slugifyTopicPart(camera)}/state`;
}

export function buildSwitchDiscoveryPayload(input: {
  name: string;
  uniqueId: string;
  commandTopic: string;
  stateTopic: string;
  deviceId: string;
  deviceName: string;
}): DiscoveryPayload {
  return {
    name: input.name,
    unique_id: input.uniqueId,
    command_topic: input.commandTopic,
    state_topic: input.stateTopic,
    payload_on: "on",
    payload_off: "off",
    state_on: "on",
    state_off: "off",
    value_template: "{{ 'on' if value_json.enabled else 'off' }}",
    retain: true,
    device: {
      identifiers: [input.deviceId],
      name: input.deviceName
    }
  };
}

export function discoveryTopic(discoveryPrefix: string, objectId: string): string {
  return `${trimSlash(discoveryPrefix)}/switch/frigate_openclaw_notifier/${slugifyTopicPart(objectId)}/config`;
}

export function formatGlobalAlertControlMessage(enabled: boolean): string {
  return `Alertas Frigate OpenClaw: ${enabled ? "ON" : "OFF"}`;
}

export function formatCameraAlertControlMessage(camera: string, enabled: boolean): string {
  return `Alertas Frigate OpenClaw ${camera}: ${enabled ? "ON" : "OFF"}`;
}

export function formatHomeAssistantOpenClawControlMessage(enabled: boolean): string {
  return `Mensajes MQTT a OpenClaw: ${enabled ? "ON" : "OFF"}`;
}

function trimSlash(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}
