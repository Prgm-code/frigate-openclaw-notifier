import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { testEnv } from "./helpers.js";

describe("loadConfig", () => {
  it("uses the configured Frigate MQTT defaults", () => {
    const config = loadConfig({
      MQTT_URL: testEnv.mqttUrl,
      MQTT_USERNAME: testEnv.mqttUsername,
      MQTT_PASSWORD: testEnv.mqttPassword,
      ALERT_CONTROL_COMMAND_TOPIC: testEnv.alertControlCommandTopic,
      ALERT_CONTROL_STATE_TOPIC: testEnv.alertControlStateTopic,
      ALERT_CONTROL_CAMERA_TOPIC_PREFIX: testEnv.alertControlCameraTopicPrefix,
      HOME_ASSISTANT_DISCOVERY_PREFIX: testEnv.homeAssistantDiscoveryPrefix,
      HOME_ASSISTANT_DEVICE_ID: testEnv.homeAssistantDeviceId,
      HOME_ASSISTANT_DEVICE_NAME: testEnv.homeAssistantDeviceName,
      FRIGATE_BASE_URL: testEnv.frigateBaseUrl,
      OPENCLAW_TARGET: testEnv.openclawTarget,
      MEDIA_TMP_DIR: testEnv.mediaTmpDir
    });

    expect(config.mqttUrl).toBe(testEnv.mqttUrl);
    expect(config.mqttUsername).toBe(testEnv.mqttUsername);
    expect(config.mqttPassword).toBe(testEnv.mqttPassword);
    expect(config.mqttTopics).toContain(testEnv.mqttTopics[0]);
    expect(config.alertControlCommandTopic).toBe(testEnv.alertControlCommandTopic);
    expect(config.alertControlStateTopic).toBe(testEnv.alertControlStateTopic);
    expect(config.alertControlDefaultEnabled).toBe(true);
    expect(config.alertControlCameraTopicPrefix).toBe(testEnv.alertControlCameraTopicPrefix);
    expect(config.homeAssistantDiscoveryEnabled).toBe(true);
    expect(config.homeAssistantDiscoveryPrefix).toBe(testEnv.homeAssistantDiscoveryPrefix);
    expect(config.homeAssistantDeviceId).toBe(testEnv.homeAssistantDeviceId);
    expect(config.homeAssistantDeviceName).toBe(testEnv.homeAssistantDeviceName);
    expect(config.frigateBaseUrl).toBe(testEnv.frigateBaseUrl);
    expect(config.sendClip).toBe(true);
    expect(config.openclawTarget).toBe(testEnv.openclawTarget);
    expect(config.mediaRetentionSeconds).toBe(3600);
    expect(config.ffmpegBin).toBe(testEnv.ffmpegBin);
    expect(config.videoProcessTimeoutMs).toBe(120_000);
    expect(config.clipRetryAttempts).toBe(3);
    expect(config.clipRetryDelayMs).toBe(3000);
    expect(config.openclawTimeoutMs).toBe(120_000);
    expect(config.messageTimeZone).toBe(testEnv.messageTimeZone);
  });

  it("requires deployment-specific environment variables", () => {
    expect(() => loadConfig({})).toThrow(/MQTT_URL/);
  });
});
