import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { streamWriteText } from '@/services/writing.service';
import type { WritingAction } from '@/services/writing.service';
import { translateText, SUPPORTED_LANGUAGES } from '@/services/translation.service';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

export interface AiSuggestion {
  from: number;
  to: number;
  original: string;
  content: string;
}

/**
 * Shared AI editing logic for the editor toolbar and the selection bubble menu.
 * Provides the "preview then accept" streaming flow used by both.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useEditorAi(getEditor: () => any) {
  const { locale } = useI18n();
  const authStore = useAuthStore();
  const toast = useToast();

  const isZh = computed(() => locale.value === 'zh-CN');
  const aiEnabled = computed(() => authStore.currentOrganization?.aiEnabled ?? false);
  const processing = ref(false);
  const suggestion = ref<AiSuggestion | null>(null);

  function selectedText(): string {
    const e = getEditor();
    const { from, to } = e.state.selection;
    return e.state.doc.textBetween(from, to, ' ').trim();
  }
  function sourceText(): string {
    return selectedText() || getEditor().state.doc.textContent.trim();
  }

  async function runAction(action: WritingAction, text = sourceText(), customInstruction?: string) {
    if (!text) {
      toast.error(isZh.value ? '请先输入或选中内容' : 'Enter or select some content first');
      return;
    }
    const orgId = authStore.currentOrganizationId;
    if (!orgId) return;
    const { from, to } = getEditor().state.selection;
    suggestion.value = { from, to, original: text, content: '' };
    processing.value = true;
    try {
      await streamWriteText(
        orgId,
        action,
        text,
        { onToken: (token: string) => { if (suggestion.value) suggestion.value.content += token; } },
        customInstruction
      );
    } catch {
      suggestion.value = null;
      toast.error(isZh.value ? 'AI 请求失败，请重试' : 'AI request failed. Please try again.');
    } finally {
      processing.value = false;
    }
  }

  async function translate(language: string) {
    const text = sourceText();
    const orgId = authStore.currentOrganizationId;
    if (!text || !orgId) return;
    const { from, to } = getEditor().state.selection;
    processing.value = true;
    try {
      const result = await translateText(orgId, text, language as Parameters<typeof translateText>[2]);
      suggestion.value = { from, to, original: text, content: result.translatedText };
    } catch {
      toast.error(isZh.value ? '翻译失败，请重试' : 'Translation failed. Please try again.');
    } finally {
      processing.value = false;
    }
  }

  function acceptSuggestion() {
    const value = suggestion.value;
    if (!value || processing.value) return;
    getEditor().chain().focus().insertContentAt({ from: value.from, to: value.to }, value.content).run();
    suggestion.value = null;
  }

  function clearSuggestion() {
    suggestion.value = null;
  }

  return {
    isZh,
    aiEnabled,
    processing,
    suggestion,
    SUPPORTED_LANGUAGES,
    selectedText,
    sourceText,
    runAction,
    translate,
    acceptSuggestion,
    clearSuggestion,
  };
}
