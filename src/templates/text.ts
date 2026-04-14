import { EventContext } from "../frigate/event-models.js";

export function renderCaption(context: EventContext, timeZone = "America/Santiago"): string {
  const eventId = context.eventIds[0];
  const lines = [
    line("Frigate", context.severity),
    line("Camara", context.camera),
    line("Objetos", join(context.objects)),
    line("Zonas", join(context.zones)),
    line("Reconocido", join(context.subLabels)),
    line("Descripcion", context.description),
    line("Patente", context.lpr),
    line("Rostro", context.face),
    line("Evento", eventId),
    line("Hora", formatTime(context.lastUpdatedAt, timeZone))
  ];

  return lines.filter(Boolean).join("\n").slice(0, 3500);
}

function line(label: string, value: string | undefined): string | undefined {
  return value ? `${label}: ${value}` : undefined;
}

function join(values: string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(", ") : undefined;
}

function formatTime(timestamp: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("es-CL", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}:${values.second}`;
}
