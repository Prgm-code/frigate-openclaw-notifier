# frigate-openclaw-notifier

Node.js + TypeScript service that listens to Frigate MQTT events and sends direct WhatsApp notifications through OpenClaw.

It sends with `openclaw message send`. It does not use chat completions, agents, LLM flows, Twilio, or the official WhatsApp Business API.

## Features

- Listens to Frigate MQTT events, normally `frigate/events`.
- Sends a fast WhatsApp alert with a snapshot when available.
- Downloads clips, transcodes them with `ffmpeg`, then sends the video as a second WhatsApp message when ready.
- Deduplicates repeated MQTT updates for the same Frigate event.
- Cleans temporary image/video files to avoid filling the disk.
- Provides MQTT on/off alert control, with retained state.
- Publishes Home Assistant MQTT Discovery switches:
  - one global alert switch;
  - one switch for each camera listed in `ALLOWED_CAMERAS`.

## Requirements

- Node.js 20 or newer.
- `pnpm`.
- `ffmpeg`.
- Frigate with MQTT enabled and event media available through its HTTP API.
- OpenClaw installed on the host running this service.
- OpenClaw WhatsApp channel logged in, for example:

```bash
openclaw channels login --channel whatsapp
```

## Install ffmpeg

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y ffmpeg
```

macOS with Homebrew:

```bash
brew install ffmpeg
```

Docker/containers based on Debian or Ubuntu:

```bash
apt-get update
apt-get install -y ffmpeg
```

Verify that `ffmpeg` is available and includes `libx264`:

```bash
ffmpeg -version
```

The output should include `--enable-libx264`. The service uses `FFMPEG_BIN=ffmpeg` by default; set `FFMPEG_BIN=/path/to/ffmpeg` if it is installed somewhere else.

## Configuration

Copy the example file and edit it:

```bash
cp .env.example .env
```

Required deployment values:

```bash
MQTT_URL=mqtt://<mqtt-host>:1883
MQTT_USERNAME=<mqtt-user>
MQTT_PASSWORD=<mqtt-password>
FRIGATE_BASE_URL=http://<frigate-host>:5000/api
OPENCLAW_TARGET=<E164_OR_GROUP_JID>
OPENCLAW_GROUP_ID=<GROUP_JID_OPTIONAL>
MEDIA_TMP_DIR=/tmp/frigate-openclaw
```

Camera controls are generated from:

```bash
ALLOWED_CAMERAS=<camera-1>,<camera-2>
```

Use the exact Frigate camera names, for example the value that appears in MQTT as `"camera": "..."`.

OpenClaw destinations:

```bash
OPENCLAW_TARGET=<E164_OR_GROUP_JID>
OPENCLAW_GROUP_ID=<GROUP_JID_OPTIONAL>
```

If both are set, every alert and alert-control confirmation is sent to both destinations. At least one of `OPENCLAW_TARGET` or `OPENCLAW_GROUP_ID` must be set.

## Run

Install dependencies:

```bash
pnpm install
```

Run in development:

```bash
pnpm dev
```

Build and run:

```bash
pnpm run build
pnpm start
```

Run checks:

```bash
pnpm run build
pnpm test
```

## Run as a systemd Service

The repo includes a sample unit file:

```text
systemd/frigate-openclaw-notifier.service
```

The unit expects:

```text
WorkingDirectory=/opt/frigate-openclaw-notifier
EnvironmentFile=/etc/frigate-openclaw-notifier.env
ExecStart=/usr/bin/node /opt/frigate-openclaw-notifier/dist/src/index.js
User=frigate-openclaw
Group=frigate-openclaw
```

Install the service on Ubuntu/Debian:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin frigate-openclaw
sudo mkdir -p /opt/frigate-openclaw-notifier
sudo cp -a . /opt/frigate-openclaw-notifier
sudo chown -R frigate-openclaw:frigate-openclaw /opt/frigate-openclaw-notifier
```

You can also run the service with the current user instead. This is useful when
OpenClaw is already logged in for that user.

Create the environment file from the example:

```bash
sudo cp /opt/frigate-openclaw-notifier/.env.example /etc/frigate-openclaw-notifier.env
sudo nano /etc/frigate-openclaw-notifier.env
sudo chown root:frigate-openclaw /etc/frigate-openclaw-notifier.env
sudo chmod 640 /etc/frigate-openclaw-notifier.env
```

Install dependencies and build:

```bash
cd /opt/frigate-openclaw-notifier
sudo -u frigate-openclaw pnpm install --frozen-lockfile
sudo -u frigate-openclaw pnpm run build
```

Install and start the unit:

```bash
sudo cp /opt/frigate-openclaw-notifier/systemd/frigate-openclaw-notifier.service /etc/systemd/system/frigate-openclaw-notifier.service
sudo systemctl daemon-reload
sudo systemctl enable --now frigate-openclaw-notifier
```

Check status and logs:

```bash
sudo systemctl status frigate-openclaw-notifier
sudo journalctl -u frigate-openclaw-notifier -f
```

Restart after configuration changes:

```bash
sudo systemctl restart frigate-openclaw-notifier
```

### Edit locally and deploy

If you keep this repository as the editable working copy, update the installed
service with:

```bash
pnpm deploy
```

The deploy command syncs this working copy to `/opt/frigate-openclaw-notifier`,
skipping local-only files such as `node_modules`, `dist`, `.git`, and `.env`.
It then installs dependencies, runs checks, builds the app, installs the systemd
unit for the current user, and restarts `frigate-openclaw-notifier`.

The deploy command always uses local `.env` as the source of truth for service
configuration. On every deploy it copies `.env` to
`/etc/frigate-openclaw-notifier.env`, then applies safe permissions.

You can also create it manually:

```bash
sudo cp .env.example /etc/frigate-openclaw-notifier.env
sudo nano /etc/frigate-openclaw-notifier.env
sudo chown root:$(id -gn) /etc/frigate-openclaw-notifier.env
sudo chmod 640 /etc/frigate-openclaw-notifier.env
```

To deploy with a different service account, set `SERVICE_USER` and
`SERVICE_GROUP`:

```bash
SERVICE_USER=frigate-openclaw SERVICE_GROUP=frigate-openclaw pnpm deploy
```

The service user must be able to run `openclaw message send` with the WhatsApp session you intend to use. If OpenClaw stores session data in a user home directory, run the OpenClaw WhatsApp login as the same service user or adjust `OPENCLAW_BIN` and OpenClaw configuration paths accordingly.

## MQTT Topics

Frigate input topic:

```text
frigate/events
```

Configured through:

```bash
MQTT_TOPICS=frigate/events
```

Home Assistant direct-to-OpenClaw topic:

```text
frigate-openclaw-notifier/openclaw/send
```

Configured through:

```bash
HOME_ASSISTANT_OPENCLAW_TOPIC=frigate-openclaw-notifier/openclaw/send
```

Expected payload:

```json
{
  "message": "Alerta Home Assistant: porton abierto"
}
```

Recommended MQTT publish settings:

```text
QoS: 1
Retain: false
```

Home Assistant direct-to-OpenClaw control topics:

```text
frigate-openclaw-notifier/openclaw/set
frigate-openclaw-notifier/openclaw/state
```

Configured through:

```bash
HOME_ASSISTANT_OPENCLAW_CONTROL_COMMAND_TOPIC=frigate-openclaw-notifier/openclaw/set
HOME_ASSISTANT_OPENCLAW_CONTROL_STATE_TOPIC=frigate-openclaw-notifier/openclaw/state
HOME_ASSISTANT_OPENCLAW_DEFAULT_ENABLED=true
```

Accepted control payloads:

```text
on
off
true
false
1
0
enabled
disabled
{"enabled":true}
{"enabled":false}
```

Global alert command topic:

```text
frigate-openclaw-notifier/alerts/set
```

Global alert retained state topic:

```text
frigate-openclaw-notifier/alerts/state
```

Per-camera command topics are derived from `ALLOWED_CAMERAS`:

```text
frigate-openclaw-notifier/alerts/cameras/<camera-slug>/set
```

Per-camera retained state topics:

```text
frigate-openclaw-notifier/alerts/cameras/<camera-slug>/state
```

Accepted command payloads:

```text
on
off
true
false
1
0
enabled
disabled
{"enabled":true}
{"enabled":false}
```

The service publishes retained JSON state payloads:

```json
{
  "enabled": true,
  "updatedAt": "2026-04-14T00:00:00.000Z",
  "source": "command"
}
```

Camera state payloads include `camera`.

## Home Assistant

MQTT Discovery is enabled by default:

```bash
HOME_ASSISTANT_DISCOVERY_ENABLED=true
HOME_ASSISTANT_DISCOVERY_PREFIX=homeassistant
HOME_ASSISTANT_DEVICE_ID=frigate_openclaw_notifier
HOME_ASSISTANT_DEVICE_NAME=Frigate OpenClaw Notifier
```

Home Assistant should show one MQTT device named `Frigate OpenClaw Notifier` with switches like:

```text
Frigate OpenClaw Alerts
Frigate OpenClaw <camera-1>
Frigate OpenClaw <camera-2>
```

Discovery config topics:

```text
homeassistant/switch/frigate_openclaw_notifier/alerts/config
homeassistant/switch/frigate_openclaw_notifier/camera_<camera-slug>/config
```

## WhatsApp Confirmations

When alert control is changed through MQTT, the service also confirms over WhatsApp:

```text
Alertas Frigate OpenClaw: ON
Alertas Frigate OpenClaw: OFF
Alertas Frigate OpenClaw <camera>: ON
Alertas Frigate OpenClaw <camera>: OFF
```

Retained state restored on startup does not send WhatsApp confirmations, to avoid spam.

## Media Flow

For `frigate/events`:

1. The service logs the event.
2. It sends a snapshot alert immediately when available.
3. If `has_clip` is true, it downloads the clip with retries.
4. It transcodes the clip with `ffmpeg` for WhatsApp compatibility.
5. It sends the processed video as a second WhatsApp message.
6. It removes the original and processed clip files after the send attempt.

Temporary media is stored in:

```bash
MEDIA_TMP_DIR=/tmp/frigate-openclaw
```

Old media files are cleaned after:

```bash
MEDIA_RETENTION_SECONDS=600
```

## OpenClaw Commands Used

Text:

```bash
openclaw message send --channel whatsapp --target <TARGET> --message <TEXT> --json
```

Media:

```bash
openclaw message send --channel whatsapp --target <TARGET> --media <FILE_OR_URL> --message <CAPTION> --json
```

## Security Notes

- Do not commit `.env`.
- Use `.env.example` as the public template.
- The repository ignores `.env`, `.env.*`, local logs, build output, dependencies, and local planning notes.
- MQTT credentials, Frigate URL, OpenClaw target, camera names, and local paths should be supplied through environment variables.

## License

MIT. See [LICENSE](LICENSE).
