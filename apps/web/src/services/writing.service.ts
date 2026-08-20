import { api } from './api';

export const WRITING_ACTIONS = ['generate', 'expand', 'summarise', 'improve', 'custom'] as const;

export type WritingAction = (typeof WRITING_ACTIONS)[number];

export async function writeText(
  orgId: string,
  action: WritingAction,
  text: string
): Promise<{ content: string }> {
  return api.post(`/organizations/${orgId}/ai/write`, { action, text });
}

export function streamWriteText(
  orgId: string,
  action: WritingAction,
  text: string,
  callbacks: Parameters<typeof api.streamPost>[2],
  instruction?: string
): Promise<void> {
  return api.streamPost(`/organizations/${orgId}/ai/write/stream`, { action, text, instruction }, callbacks);
}
