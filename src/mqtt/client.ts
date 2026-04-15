import mqtt, { MqttClient } from "mqtt";
import { cameraCommandTopic, cameraStateTopic } from "../alert-control.js";
import { NotifierConfig } from "../config/schema.js";
import { Logger } from "../logger.js";

export type MqttMessageHandler = (topic: string, payload: Buffer) => void | Promise<void>;
export type MqttConnectHandler = (client: MqttClient) => void | Promise<void>;

export function startMqttClient(config: NotifierConfig, logger: Logger, onMessage: MqttMessageHandler, onConnect?: MqttConnectHandler): MqttClient {
  const client = mqtt.connect(config.mqttUrl, {
    username: config.mqttUsername,
    password: config.mqttPassword,
    reconnectPeriod: 5000
  });

  client.on("connect", () => {
    const cameraCommandTopics = config.allowedCameras.map((camera) => cameraCommandTopic(config.alertControlCameraTopicPrefix, camera));
    const cameraStateTopics = config.allowedCameras.map((camera) => cameraStateTopic(config.alertControlCameraTopicPrefix, camera));
    const topics = unique([
      ...config.mqttTopics,
      config.homeAssistantOpenClawTopic,
      config.homeAssistantOpenClawControlCommandTopic,
      config.homeAssistantOpenClawControlStateTopic,
      config.alertControlCommandTopic,
      config.alertControlStateTopic,
      ...cameraCommandTopics,
      ...cameraStateTopics
    ]);
    logger.info("mqtt_connected", { url: config.mqttUrl, topics });
    client.subscribe(topics, (error) => {
      if (error) {
        logger.error("mqtt_subscribe_failed", { error: error.message });
        return;
      }
      logger.info("mqtt_subscribed", { topics });
      Promise.resolve(onConnect?.(client)).catch((connectError: unknown) => {
        logger.error("mqtt_connect_handler_failed", { error: connectError instanceof Error ? connectError.message : String(connectError) });
      });
    });
  });

  client.on("reconnect", () => logger.warn("mqtt_reconnecting"));
  client.on("error", (error) => logger.error("mqtt_error", { error: error.message }));
  client.on("message", (topic, payload) => {
    Promise.resolve(onMessage(topic, payload)).catch((error: unknown) => {
      logger.error("mqtt_message_handler_failed", { topic, error: error instanceof Error ? error.message : String(error) });
    });
  });

  return client;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
