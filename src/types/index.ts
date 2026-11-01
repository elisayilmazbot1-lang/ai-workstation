/** Arayüz tarafı yardımcı tipleri. */
export type AppEventBusPayload =
  | { type: 'task.updated'; taskId: string; status: string; progress: number; title: string }
  | { type: 'task.step'; taskId: string; stepId: string; index: number; role: string; status: string; title: string }
  | { type: 'task.log'; taskId: string; message: string; level: 'info' | 'warn' | 'error' }
  | { type: 'agent.run'; taskId: string; runId: string; role: string; status: string; model?: string }
  | { type: 'approval.created'; approvalId: string; taskId?: string; title: string; risk: string }
  | { type: 'approval.decided'; approvalId: string; status: string }
  | { type: 'notification'; notificationId: string; kind: string; title: string; message: string }
  | { type: 'usage'; taskId?: string; inputTokens: number; outputTokens: number; costUsd: number }
  | { type: 'chat.delta'; threadId: string; text: string }
  | { type: 'chat.done'; threadId: string; messageId: string }
  | { type: 'emergency'; stopped: boolean }
  | { type: 'docker.status'; available: boolean }
  | { type: 'system'; message: string };
