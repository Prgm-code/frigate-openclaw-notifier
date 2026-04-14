import { LogLevel } from "./config/schema.js";

type LogFields = Record<string, unknown>;

const rank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export function createLogger(minLevel: LogLevel): Logger {
  function write(level: LogLevel, message: string, fields: LogFields = {}): void {
    if (rank[level] < rank[minLevel]) {
      return;
    }

    const record = {
      time: new Date().toISOString(),
      level,
      message,
      ...fields
    };

    const line = JSON.stringify(record, null, 2);
    if (level === "error" || level === "warn") {
      console.error(line);
      return;
    }
    console.log(line);
  }

  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields)
  };
}

export function redactTarget(target: string): string {
  if (target.length <= 6) {
    return "***";
  }
  return `${target.slice(0, 3)}***${target.slice(-3)}`;
}
