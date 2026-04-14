import { NotifierApp } from "../app.js";

export async function handleMqttMessage(app: NotifierApp, topic: string, payload: Buffer): Promise<void> {
  if (topic === app.config.alertControlCommandTopic) {
    app.handleAlertControlCommand(payload);
    return;
  }

  if (topic === app.config.alertControlStateTopic) {
    app.handleAlertControlState(payload);
    return;
  }

  if (app.handleCameraAlertControlCommand(topic, payload)) {
    return;
  }

  if (app.handleCameraAlertControlState(topic, payload)) {
    return;
  }

  if (topic === "frigate/events") {
    await app.handleFrigateEvent(payload);
    return;
  }

  if (topic === "frigate/reviews") {
    await app.handleReview(payload);
    return;
  }

  if (topic === "frigate/tracked_object_update") {
    app.handleTrackedObjectUpdate(payload);
  }
}
