import { describe, expect, it, vi } from "vitest";
import { NotifierApp } from "../src/app.js";
import { makeConfig, testEnv } from "./helpers.js";

describe("Home Assistant MQTT to OpenClaw", () => {
  it("sends the payload message to configured OpenClaw targets", async () => {
    const sendText = vi.fn().mockResolvedValue({
      ok: true,
      channel: "whatsapp",
      to: testEnv.openclawTarget,
      messageId: "msg-1"
    });
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const app = new NotifierApp(
      makeConfig(),
      logger,
      {} as never,
      {} as never,
      {} as never,
      {
        sendText,
        sendMedia: vi.fn()
      } as never
    );

    await app.handleHomeAssistantOpenClawMessage(
      Buffer.from(JSON.stringify({ message: "Alerta Home Assistant: porton abierto" }))
    );

    expect(sendText).toHaveBeenCalledTimes(2);
    expect(sendText).toHaveBeenNthCalledWith(1, testEnv.openclawTarget, "Alerta Home Assistant: porton abierto");
    expect(sendText).toHaveBeenNthCalledWith(2, testEnv.openclawGroupId, "Alerta Home Assistant: porton abierto");
    expect(logger.info).toHaveBeenCalledWith(
      "homeassistant_openclaw_message_sent",
      expect.objectContaining({
        results: expect.any(Array)
      })
    );
  });

  it("suppresses Home Assistant MQTT messages when disabled", async () => {
    const sendText = vi.fn();
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const app = new NotifierApp(
      makeConfig(),
      logger,
      {} as never,
      {} as never,
      {} as never,
      {
        sendText,
        sendMedia: vi.fn()
      } as never
    );

    app.handleHomeAssistantOpenClawControlCommand(Buffer.from("off"));
    await app.handleHomeAssistantOpenClawMessage(
      Buffer.from(JSON.stringify({ message: "Alerta Home Assistant: porton abierto" }))
    );

    expect(sendText).toHaveBeenCalledTimes(2);
    expect(sendText).toHaveBeenNthCalledWith(1, testEnv.openclawTarget, "Mensajes MQTT a OpenClaw: OFF");
    expect(sendText).toHaveBeenNthCalledWith(2, testEnv.openclawGroupId, "Mensajes MQTT a OpenClaw: OFF");
    expect(logger.info).toHaveBeenCalledWith(
      "homeassistant_openclaw_message_suppressed",
      expect.objectContaining({ reason: "homeassistant_openclaw_disabled" })
    );
  });

  it("sends a confirmation message when the Home Assistant MQTT switch changes", async () => {
    const sendText = vi.fn().mockResolvedValue({
      ok: true,
      channel: "whatsapp",
      to: testEnv.openclawTarget,
      messageId: "msg-1"
    });
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const app = new NotifierApp(
      makeConfig(),
      logger,
      {} as never,
      {} as never,
      {} as never,
      {
        sendText,
        sendMedia: vi.fn()
      } as never
    );

    app.handleHomeAssistantOpenClawControlCommand(Buffer.from("off"));

    expect(sendText).toHaveBeenCalledTimes(2);
    expect(sendText).toHaveBeenNthCalledWith(1, testEnv.openclawTarget, "Mensajes MQTT a OpenClaw: OFF");
    expect(sendText).toHaveBeenNthCalledWith(2, testEnv.openclawGroupId, "Mensajes MQTT a OpenClaw: OFF");
  });
});
