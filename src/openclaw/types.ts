export interface OpenClawSendResult {
  ok: boolean;
  channel: string;
  to: string;
  messageId?: string;
  mediaUrl?: string;
  caption?: string;
  raw?: unknown;
}
