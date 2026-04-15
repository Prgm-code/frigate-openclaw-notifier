import { buildSwitchDiscoveryPayload, discoveryTopic, slugifyTopicPart } from "./alert-control.js";
import { NotifierApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { DedupeStore } from "./dedupe/store.js";
import { FrigateApi } from "./frigate/api.js";
import { EventCorrelator } from "./frigate/correlator.js";
import { createLogger } from "./logger.js";
import { MediaResolver } from "./media/resolver.js";
import { startMqttClient } from "./mqtt/client.js";
import { handleMqttMessage } from "./mqtt/handlers.js";
import { OpenClawCli } from "./openclaw/cli.js";
import type { MqttClient } from "mqtt";

const config = loadConfig();
const logger = createLogger(config.logLevel);
const frigateApi = new FrigateApi(config.frigateBaseUrl, config.frigateFetchTimeoutMs);
const mediaResolver = new MediaResolver(config, frigateApi);
const correlator = new EventCorrelator();
const dedupe = new DedupeStore(config.cooldownSeconds * 1000);
const openclaw = new OpenClawCli(config);
const app = new NotifierApp(config, logger, correlator, dedupe, mediaResolver, openclaw);

logger.info("notifier_config_loaded", {
  mqttUrl: config.mqttUrl,
  mqttTopics: config.mqttTopics,
  homeAssistantOpenClawTopic: config.homeAssistantOpenClawTopic,
  homeAssistantOpenClawControlCommandTopic: config.homeAssistantOpenClawControlCommandTopic,
  homeAssistantOpenClawControlStateTopic: config.homeAssistantOpenClawControlStateTopic,
  homeAssistantOpenClawDefaultEnabled: config.homeAssistantOpenClawDefaultEnabled,
  alertControlCommandTopic: config.alertControlCommandTopic,
  alertControlStateTopic: config.alertControlStateTopic,
  alertControlDefaultEnabled: config.alertControlDefaultEnabled,
  alertControlCameraTopicPrefix: config.alertControlCameraTopicPrefix,
  homeAssistantDiscoveryEnabled: config.homeAssistantDiscoveryEnabled,
  homeAssistantDiscoveryPrefix: config.homeAssistantDiscoveryPrefix,
  frigateBaseUrl: config.frigateBaseUrl,
  allowedCameras: config.allowedCameras.length > 0 ? config.allowedCameras : "all",
  allowedObjects: config.allowedObjects.length > 0 ? config.allowedObjects : "all",
  blockedZones: config.blockedZones,
  sendSnapshot: config.sendSnapshot,
  sendClip: config.sendClip,
  openclawTargets: config.openclawTargets.length,
  openclawTimeoutMs: config.openclawTimeoutMs,
  mediaTmpDir: config.mediaTmpDir,
  mediaRetentionSeconds: config.mediaRetentionSeconds,
  ffmpegBin: config.ffmpegBin,
  videoProcessTimeoutMs: config.videoProcessTimeoutMs,
  clipRetryAttempts: config.clipRetryAttempts,
  clipRetryDelayMs: config.clipRetryDelayMs,
  messageTimeZone: config.messageTimeZone
});

app.cleanupMedia().catch((error: unknown) => {
  logger.warn("media_cleanup_startup_failed", { error: error instanceof Error ? error.message : String(error) });
});

const client = startMqttClient(
  config,
  logger,
  (topic, payload) => handleMqttMessage(app, topic, payload),
  (mqttClient) => {
    app.setAlertStatePublisher((topic, payload) => {
      mqttClient.publish(topic, JSON.stringify(payload), { retain: true, qos: 1 });
    });
    if (config.homeAssistantDiscoveryEnabled) {
      publishHomeAssistantDiscovery(mqttClient);
    }
    setTimeout(() => app.publishAllAlertStates("connect"), 1000);
  }
);

function shutdown(signal: NodeJS.Signals): void {
  logger.info("shutdown_started", { signal });
  client.end(false, {}, () => {
    logger.info("shutdown_complete");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function publishHomeAssistantDiscovery(mqttClient: MqttClient): void {
  const globalPayload = buildSwitchDiscoveryPayload({
    name: "Frigate OpenClaw Alerts",
    uniqueId: `${config.homeAssistantDeviceId}_alerts`,
    commandTopic: config.alertControlCommandTopic,
    stateTopic: config.alertControlStateTopic,
    deviceId: config.homeAssistantDeviceId,
    deviceName: config.homeAssistantDeviceName
  });
  const globalTopic = discoveryTopic(config.homeAssistantDiscoveryPrefix, "alerts");
  mqttClient.publish(globalTopic, JSON.stringify(globalPayload), { retain: true, qos: 1 });
  logger.info("home_assistant_discovery_published", { topic: globalTopic, name: globalPayload.name });

  const homeAssistantOpenClawPayload = buildSwitchDiscoveryPayload({
    name: "Home Assistant OpenClaw Messages",
    uniqueId: `${config.homeAssistantDeviceId}_homeassistant_openclaw`,
    commandTopic: config.homeAssistantOpenClawControlCommandTopic,
    stateTopic: config.homeAssistantOpenClawControlStateTopic,
    deviceId: config.homeAssistantDeviceId,
    deviceName: config.homeAssistantDeviceName
  });
  const homeAssistantOpenClawDiscoveryTopic = discoveryTopic(config.homeAssistantDiscoveryPrefix, "homeassistant_openclaw");
  mqttClient.publish(homeAssistantOpenClawDiscoveryTopic, JSON.stringify(homeAssistantOpenClawPayload), { retain: true, qos: 1 });
  logger.info("home_assistant_discovery_published", {
    topic: homeAssistantOpenClawDiscoveryTopic,
    name: homeAssistantOpenClawPayload.name
  });

  for (const { camera, commandTopic, stateTopic } of app.cameraStateTopics()) {
    const payload = buildSwitchDiscoveryPayload({
      name: `Frigate OpenClaw ${camera}`,
      uniqueId: `${config.homeAssistantDeviceId}_${slugifyTopicPart(camera)}`,
      commandTopic,
      stateTopic,
      deviceId: config.homeAssistantDeviceId,
      deviceName: config.homeAssistantDeviceName
    });
    const topic = discoveryTopic(config.homeAssistantDiscoveryPrefix, `camera_${camera}`);
    mqttClient.publish(topic, JSON.stringify(payload), { retain: true, qos: 1 });
    logger.info("home_assistant_discovery_published", { topic, name: payload.name, camera });
  }
}
