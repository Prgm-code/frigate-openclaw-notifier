import { describe, expect, it } from "vitest";
import {
  buildSwitchDiscoveryPayload,
  cameraCommandTopic,
  cameraStateTopic,
  discoveryTopic,
  formatCameraAlertControlMessage,
  formatGlobalAlertControlMessage,
  formatHomeAssistantOpenClawControlMessage,
  parseHomeAssistantOpenClawPayload,
  parseAlertControlPayload
} from "../src/alert-control.js";
import { testEnv } from "./helpers.js";

describe("parseAlertControlPayload", () => {
  it("accepts text commands", () => {
    expect(parseAlertControlPayload("on")).toBe(true);
    expect(parseAlertControlPayload("off")).toBe(false);
  });

  it("accepts JSON commands", () => {
    expect(parseAlertControlPayload("true")).toBe(true);
    expect(parseAlertControlPayload("false")).toBe(false);
    expect(parseAlertControlPayload(JSON.stringify({ enabled: true }))).toBe(true);
  });

  it("rejects unknown commands", () => {
    expect(parseAlertControlPayload("maybe")).toBeUndefined();
  });

  it("accepts Home Assistant OpenClaw payloads", () => {
    expect(parseHomeAssistantOpenClawPayload(JSON.stringify({ message: "Alerta Home Assistant: porton abierto" }))).toBe(
      "Alerta Home Assistant: porton abierto"
    );
    expect(parseHomeAssistantOpenClawPayload(JSON.stringify({ message: "   " }))).toBeUndefined();
    expect(parseHomeAssistantOpenClawPayload(JSON.stringify({ enabled: true }))).toBeUndefined();
  });

  it("builds camera control topics from camera names", () => {
    expect(cameraCommandTopic(testEnv.alertControlCameraTopicPrefix, "Front Door")).toBe("notifier-test/alerts/cameras/front_door/set");
    expect(cameraStateTopic(testEnv.alertControlCameraTopicPrefix, "Front Door")).toBe("notifier-test/alerts/cameras/front_door/state");
  });

  it("builds Home Assistant discovery payloads", () => {
    const payload = buildSwitchDiscoveryPayload({
      name: "Notifier Test Camera",
      uniqueId: "notifier_test_camera",
      commandTopic: testEnv.alertControlCommandTopic,
      stateTopic: testEnv.alertControlStateTopic,
      deviceId: testEnv.homeAssistantDeviceId,
      deviceName: testEnv.homeAssistantDeviceName
    });

    expect(discoveryTopic(testEnv.homeAssistantDiscoveryPrefix, "camera")).toBe("homeassistant-test/switch/frigate_openclaw_notifier/camera/config");
    expect(payload.command_topic).toBe(testEnv.alertControlCommandTopic);
    expect(payload.value_template).toContain("value_json.enabled");
  });

  it("formats WhatsApp control confirmations", () => {
    expect(formatGlobalAlertControlMessage(true)).toBe("Alertas Frigate OpenClaw: ON");
    expect(formatGlobalAlertControlMessage(false)).toBe("Alertas Frigate OpenClaw: OFF");
    expect(formatCameraAlertControlMessage(testEnv.cameraName, false)).toBe(`Alertas Frigate OpenClaw ${testEnv.cameraName}: OFF`);
    expect(formatHomeAssistantOpenClawControlMessage(true)).toBe("Mensajes MQTT a OpenClaw: ON");
  });
});
