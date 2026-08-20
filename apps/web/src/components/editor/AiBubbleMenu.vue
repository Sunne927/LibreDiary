<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BubbleMenu } from '@tiptap/vue-3/menus';
import { translateText, SUPPORTED_LANGUAGES } from '@/services/translation.service';
import type { SupportedLanguage } from '@/services/translation.service';
import { streamWriteText } from '@/services/writing.service';
import type { WritingAction } from '@/services/writing.service';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
}>();

const authStore = useAuthStore();
const toast = useToast();
const { locale } = useI18n();

const showMenu = ref(false);
const activeView = ref<'main' | 'languages' | 'generate'>('main');
const processing = ref(false);
const loadingMessage = ref('');
const generatePrompt = ref('');

interface AiSuggestion {
  from: number;
  to: number;
  originalText: string;
  content: string;
  action: WritingAction | 'translate';
  label: string;
}

const suggestion = ref<AiSuggestion | null>(null);

const aiEnabled = computed(() => authStore.currentOrganization?.aiEnabled ?? false);

function toggleMenu() {
  showMenu.value = !showMenu.value;
  if (showMenu.value) {
    activeView.value = 'main';
    generatePrompt.value = '';
  }
}

function closeMenu() {
  showMenu.value = false;
  activeView.value = 'main';
  generatePrompt.value = '';
}

function clearSuggestion() {
  suggestion.value = null;
}

function acceptSuggestion() {
  const currentSuggestion = suggestion.value;
  if (!currentSuggestion) return;

  props.editor
    .chain()
    .focus()
    .insertContentAt(
      { from: currentSuggestion.from, to: currentSuggestion.to },
      currentSuggestion.content
    )
    .run();

  toast.success(locale.value === 'zh-CN' ? '已接受 AI 建议' : 'AI suggestion accepted');
  clearSuggestion();
}

function regenerateSuggestion() {
  const currentSuggestion = suggestion.value;
  if (!currentSuggestion) return;

  if (currentSuggestion.action === 'translate') {
    showMenu.value = true;
    showLanguages();
    clearSuggestion();
    return;
  }

  clearSuggestion();
  void handleWrite(currentSuggestion.action, {
    from: currentSuggestion.from,
    to: currentSuggestion.to,
    selectedText: currentSuggestion.originalText,
  });
}

function handleMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMenu();
  }
}

function showLanguages() {
  activeView.value = 'languages';
}

function showGenerate() {
  activeView.value = 'generate';
}

function goBack() {
  activeView.value = 'main';
  generatePrompt.value = '';
}

function selectionPreview() {
  const { from, to } = props.editor.state.selection;
  const text = props.editor.state.doc.textBetween(from, to, ' ').trim();
  if (!text) return locale.value === 'zh-CN' ? '未选中文本，将在当前位置生成' : 'No text selected; generate at the current position';
  return text.length > 88 ? `${text.slice(0, 88)}...` : text;
}

const LOADING_MESSAGES: Record<WritingAction, string> = {
  generate: 'Generating...',
  expand: 'Expanding...',
  summarise: 'Summarising...',
  improve: 'Improving...',
  custom: 'Working...',
};

const SUCCESS_MESSAGES: Record<WritingAction, string> = {
  generate: 'Content generated',
  expand: 'Text expanded',
  summarise: 'Text summarised',
  improve: 'Text improved',
  custom: 'Custom AI result',
};

async function handleWrite(
  action: WritingAction,
  range?: { from: number; to: number; selectedText: string }
) {
  const { from, to } = range ?? props.editor.state.selection;
  const selectedText = range?.selectedText ?? props.editor.state.doc.textBetween(from, to, ' ');

  if (!selectedText.trim() && action !== 'generate') return;

  const orgId = authStore.currentOrganizationId;
  if (!orgId) return;

  processing.value = true;
  loadingMessage.value = locale.value === 'zh-CN'
    ? ({ generate: '正在生成...', expand: '正在扩写...', summarise: '正在总结...', improve: '正在润色...', custom: '正在处理...' }[action])
    : LOADING_MESSAGES[action];

  try {
    suggestion.value = {
      from,
      to,
      originalText: selectedText,
      content: '',
      action,
      label: locale.value === 'zh-CN'
        ? ({ generate: '生成建议', expand: '扩写建议', summarise: '总结建议', improve: '润色建议', custom: 'AI 建议' }[action])
        : `${SUCCESS_MESSAGES[action]} suggestion`,
    };
    await streamWriteText(orgId, action, selectedText, {
      onToken: (token) => {
        if (suggestion.value) suggestion.value.content += token;
      },
    });
    closeMenu();
  } catch {
    clearSuggestion();
    toast.error(locale.value === 'zh-CN' ? '写作失败，请重试。' : 'Writing failed. Please try again.');
  } finally {
    processing.value = false;
    loadingMessage.value = '';
  }
}

async function handleGenerate() {
  const prompt = generatePrompt.value.trim();
  if (!prompt) return;

  const orgId = authStore.currentOrganizationId;
  if (!orgId) return;

  const { from, to } = props.editor.state.selection;

  processing.value = true;
  loadingMessage.value = locale.value === 'zh-CN' ? '正在生成...' : LOADING_MESSAGES.generate;

  try {
    suggestion.value = {
      from,
      to,
      originalText: prompt,
      content: '',
      action: 'generate',
      label: locale.value === 'zh-CN' ? '生成建议' : 'Generated suggestion',
    };
    await streamWriteText(orgId, 'generate', prompt, {
      onToken: (token) => {
        if (suggestion.value) suggestion.value.content += token;
      },
    });
    closeMenu();
  } catch {
    clearSuggestion();
    toast.error(locale.value === 'zh-CN' ? '写作失败，请重试。' : 'Writing failed. Please try again.');
  } finally {
    processing.value = false;
    loadingMessage.value = '';
  }
}

async function handleTranslate(language: SupportedLanguage) {
  const { from, to } = props.editor.state.selection;
  const selectedText = props.editor.state.doc.textBetween(from, to, ' ');

  if (!selectedText.trim()) return;

  const orgId = authStore.currentOrganizationId;
  if (!orgId) return;

  processing.value = true;
  loadingMessage.value = locale.value === 'zh-CN' ? '正在翻译...' : 'Translating...';

  try {
    const result = await translateText(orgId, selectedText, language);

    suggestion.value = {
      from,
      to,
      originalText: selectedText,
      content: result.translatedText,
      action: 'translate',
      label: locale.value === 'zh-CN' ? `翻译为${language}的建议` : `Translation to ${language}`,
    };
    closeMenu();
  } catch {
    toast.error(locale.value === 'zh-CN' ? '翻译失败，请重试。' : 'Translation failed. Please try again.');
  } finally {
    processing.value = false;
    loadingMessage.value = '';
  }
}
</script>

<template>
  <BubbleMenu
    v-if="aiEnabled"
    :editor="editor"
    :tippy-options="{ duration: 150, placement: 'top', maxWidth: 'none' }"
  >
    <div class="ai-bubble">
      <!-- Loading overlay -->
      <div v-if="processing && !suggestion" class="ai-loading">
        <div class="ai-spinner"></div>
        <span>{{ loadingMessage }}</span>
      </div>

      <template v-else>
        <!-- AI trigger button -->
        <button
          class="ai-trigger"
          type="button"
          aria-haspopup="true"
          :aria-expanded="showMenu"
          @click="toggleMenu"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M7 1.75L8.225 4.55L11.375 4.9L9.1 7L9.7 10.1L7 8.575L4.3 10.1L4.9 7L2.625 4.9L5.775 4.55L7 1.75Z"
              stroke="currentColor"
              stroke-width="1.1"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="ai-trigger-copy">
            <strong>AI</strong>
            <small>{{ locale === 'zh-CN' ? '助手' : 'Assistant' }}</small>
          </span>
          <svg
            class="ai-chevron"
            :class="{ 'ai-chevron--open': showMenu }"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 3.75L5 6.25L7.5 3.75"
              stroke="currentColor"
              stroke-width="1.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <!-- Suggestions stay outside the document until the user accepts them. -->
        <div v-if="suggestion" class="ai-suggestion" role="dialog" aria-label="AI suggestion">
          <div class="ai-suggestion-header">
            <span class="ai-suggestion-label">{{ suggestion.label }}</span>
            <span v-if="processing" class="ai-loading ai-suggestion-loading">
              <span class="ai-spinner"></span>
              {{ loadingMessage }}
            </span>
            <button class="ai-suggestion-dismiss" type="button" aria-label="Dismiss suggestion" @click="clearSuggestion">
              ×
            </button>
          </div>
          <div class="ai-suggestion-body">
            <div class="ai-suggestion-original">
              <span class="ai-suggestion-caption">{{ locale === 'zh-CN' ? '原文' : 'Original' }}</span>
              <p>{{ suggestion.originalText || (locale === 'zh-CN' ? '当前位置' : 'Current position') }}</p>
            </div>
            <div class="ai-suggestion-divider" aria-hidden="true"></div>
            <div class="ai-suggestion-result">
              <span class="ai-suggestion-caption">{{ locale === 'zh-CN' ? 'AI 建议' : 'AI suggestion' }}</span>
              <p>{{ suggestion.content }}</p>
            </div>
          </div>
          <div class="ai-suggestion-actions">
            <button class="ai-suggestion-btn ai-suggestion-btn--accept" type="button" @click="acceptSuggestion">
              {{ locale === 'zh-CN' ? '接受替换' : 'Accept' }}
            </button>
            <button class="ai-suggestion-btn" type="button" @click="regenerateSuggestion">
              {{ locale === 'zh-CN' ? '重新生成' : 'Regenerate' }}
            </button>
            <button class="ai-suggestion-btn" type="button" @click="clearSuggestion">
              {{ locale === 'zh-CN' ? '拒绝' : 'Reject' }}
            </button>
          </div>
        </div>

        <!-- Main menu -->
        <div
          v-if="showMenu && activeView === 'main'"
          class="ai-menu"
          role="menu"
          aria-label="AI 操作"
          @keydown="handleMenuKeydown"
        >
          <div class="ai-menu-heading">
            <div>
              <strong>{{ locale === 'zh-CN' ? 'AI 写作助手' : 'AI writing assistant' }}</strong>
              <span>{{ locale === 'zh-CN' ? '基于当前选区给出建议' : 'Suggestions based on the current selection' }}</span>
            </div>
            <button class="ai-menu-close" type="button" aria-label="Close AI assistant" @click="closeMenu">×</button>
          </div>
          <div class="ai-context-preview">
            <span>{{ locale === 'zh-CN' ? '当前上下文' : 'Context' }}</span>
            <p>{{ selectionPreview() }}</p>
          </div>
          <div class="ai-menu-section">
            <span class="ai-menu-label">{{ locale === 'zh-CN' ? '快速操作' : 'Quick actions' }}</span>
            <div class="ai-action-grid">
              <button class="ai-action-card ai-menu-item" role="menuitem" type="button" @click="showGenerate">
                <span class="ai-action-icon">✦</span>
                <span><strong>{{ locale === 'zh-CN' ? '生成' : 'Generate' }}</strong><small>{{ locale === 'zh-CN' ? '从提示开始写' : 'Start from a prompt' }}</small></span>
              </button>
              <button class="ai-action-card ai-menu-item" role="menuitem" type="button" @click="handleWrite('expand')">
                <span class="ai-action-icon">↗</span>
                <span><strong>{{ locale === 'zh-CN' ? '扩写' : 'Expand' }}</strong><small>{{ locale === 'zh-CN' ? '补充细节和论据' : 'Add detail and depth' }}</small></span>
              </button>
              <button class="ai-action-card ai-menu-item" role="menuitem" type="button" @click="handleWrite('summarise')">
                <span class="ai-action-icon">≡</span>
                <span><strong>{{ locale === 'zh-CN' ? '总结' : 'Summarise' }}</strong><small>{{ locale === 'zh-CN' ? '提炼核心信息' : 'Extract the key points' }}</small></span>
              </button>
              <button class="ai-action-card ai-menu-item" role="menuitem" type="button" @click="handleWrite('improve')">
                <span class="ai-action-icon">⌁</span>
                <span><strong>{{ locale === 'zh-CN' ? '润色' : 'Improve' }}</strong><small>{{ locale === 'zh-CN' ? '让表达更清晰' : 'Make it clearer' }}</small></span>
              </button>
            </div>
          </div>
          <div class="ai-menu-divider"></div>
          <div class="ai-menu-section">
            <span class="ai-menu-label">{{ locale === 'zh-CN' ? '翻译' : 'Translate' }}</span>
            <button class="ai-menu-item" role="menuitem" type="button" @click="showLanguages">
              <span class="ai-menu-item-icon">文</span>
              <span>{{ locale === 'zh-CN' ? '翻译为...' : 'Translate to...' }}</span>
            </button>
          </div>
          <div class="ai-prompt-row">
            <input v-model="generatePrompt" type="text" :placeholder="locale === 'zh-CN' ? '告诉 AI 你想怎么改...' : 'Tell AI what to change...'" @keydown.enter.prevent="handleGenerate" />
            <button type="button" :disabled="!generatePrompt.trim()" aria-label="Run AI prompt" @click="handleGenerate">↵</button>
          </div>
        </div>

        <!-- Language submenu -->
        <div
          v-if="showMenu && activeView === 'languages'"
          class="ai-languages"
          role="listbox"
          aria-label="选择语言"
          @keydown="handleMenuKeydown"
        >
          <button class="ai-back-btn" type="button" @click="goBack">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M7.5 9L4.5 6L7.5 3"
                stroke="currentColor"
                stroke-width="1.25"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ locale === 'zh-CN' ? '返回' : 'Back' }}
          </button>
          <button
            v-for="lang in SUPPORTED_LANGUAGES"
            :key="lang"
            class="language-item"
            role="option"
            type="button"
            @click="handleTranslate(lang)"
          >
            {{ lang }}
          </button>
        </div>

        <!-- Generate view -->
        <div
          v-if="showMenu && activeView === 'generate'"
          class="ai-generate"
          @keydown="handleMenuKeydown"
        >
          <button class="ai-back-btn" type="button" @click="goBack">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M7.5 9L4.5 6L7.5 3"
                stroke="currentColor"
                stroke-width="1.25"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ locale === 'zh-CN' ? '返回' : 'Back' }}
          </button>
          <input
            v-model="generatePrompt"
            class="ai-generate-input"
            type="text"
            placeholder="描述你想生成的内容..."
            @keydown.enter.prevent="handleGenerate"
          />
          <button
            class="ai-generate-btn"
            type="button"
            :disabled="!generatePrompt.trim()"
            @click="handleGenerate"
          >
            {{ locale === 'zh-CN' ? '生成' : 'Generate' }}
          </button>
        </div>
      </template>
    </div>
  </BubbleMenu>
</template>

<style scoped>
.ai-bubble {
  position: relative;
  font-family: var(--font-sans);
}

.ai-trigger {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  padding: 5px var(--space-2) 5px 6px;
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  white-space: nowrap;
  cursor: pointer;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  transition: all var(--transition-fast);
}

.ai-trigger:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.ai-trigger:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.ai-suggestion {
  position: absolute;
  top: calc(100% + var(--space-2));
  left: 0;
  z-index: 11;
  width: min(420px, calc(100vw - var(--space-8)));
  padding: var(--space-3);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.ai-suggestion-header,
.ai-suggestion-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.ai-suggestion-header {
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.ai-suggestion-label,
.ai-suggestion-caption {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  letter-spacing: 0;
  text-transform: uppercase;
}

.ai-suggestion-label {
  color: var(--color-accent);
}

.ai-suggestion-dismiss {
  width: 22px;
  height: 22px;
  padding: 0;
  font-family: inherit;
  font-size: 18px;
  line-height: 1;
  color: var(--color-text-tertiary);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
}

.ai-suggestion-dismiss:hover {
  color: var(--color-text-primary);
  background: var(--color-hover);
}

.ai-suggestion-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.ai-suggestion-original,
.ai-suggestion-result {
  min-width: 0;
}

.ai-suggestion-original p,
.ai-suggestion-result p {
  max-height: 150px;
  margin: var(--space-1) 0 0;
  overflow-y: auto;
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
}

.ai-suggestion-result p {
  color: var(--color-text-primary);
}

.ai-suggestion-divider {
  background: var(--color-border);
}

.ai-suggestion-actions {
  justify-content: flex-end;
}

.ai-suggestion-btn {
  padding: 5px var(--space-2);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.ai-suggestion-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-hover);
}

.ai-suggestion-btn--accept {
  color: var(--color-text-inverse);
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.ai-suggestion-btn--accept:hover {
  color: var(--color-text-inverse);
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
}

.ai-chevron {
  transition: transform var(--transition-fast);
}

.ai-chevron--open {
  transform: rotate(180deg);
}

/* Main menu */
.ai-menu {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: 10;
  min-width: 180px;
  padding: var(--space-1);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

@media (max-width: 520px) {
  .ai-suggestion {
    position: fixed;
    right: var(--space-3);
    bottom: var(--space-3);
    left: var(--space-3);
    width: auto;
  }

  .ai-suggestion-body {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }

  .ai-suggestion-divider {
    height: 1px;
  }
}

.ai-menu-section {
  padding: var(--space-1) 0;
}

.ai-menu-label {
  display: block;
  padding: var(--space-1) var(--space-3);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ai-menu-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: inherit;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.ai-menu-item:hover,
.ai-menu-item:focus {
  color: var(--color-text-primary);
  background: var(--color-hover);
  outline: none;
}

.ai-menu-divider {
  height: 1px;
  margin: var(--space-1) var(--space-2);
  background: var(--color-border);
}

/* Language submenu */
.ai-languages {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: 10;
  min-width: 180px;
  max-height: 280px;
  padding: var(--space-1);
  overflow-y: auto;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.language-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: inherit;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.language-item:hover,
.language-item:focus {
  color: var(--color-text-primary);
  background: var(--color-hover);
  outline: none;
}

/* Back button */
.ai-back-btn {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-1);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-tertiary);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  transition: all var(--transition-fast);
}

.ai-back-btn:hover {
  color: var(--color-text-primary);
}

/* Generate view */
.ai-generate {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: 10;
  min-width: 260px;
  padding: var(--space-1);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.ai-generate-input {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  margin: var(--space-1) 0;
  font-family: inherit;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: none;
  box-sizing: border-box;
  transition: border-color var(--transition-fast);
}

.ai-generate-input:focus {
  border-color: var(--color-accent);
}

.ai-generate-input::placeholder {
  color: var(--color-text-tertiary);
}

.ai-generate-btn {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-inverse);
  cursor: pointer;
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.ai-generate-btn:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.ai-generate-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Loading state */
.ai-loading {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  padding: 5px var(--space-3);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-tertiary);
  white-space: nowrap;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.ai-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: ai-spin 0.6s linear infinite;
}

@keyframes ai-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Scrollbar styling */
.ai-languages::-webkit-scrollbar {
  width: 4px;
}

.ai-languages::-webkit-scrollbar-track {
  background: transparent;
}

.ai-languages::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}
.ai-trigger {
  gap: 6px;
  min-height: 34px;
  padding: 4px 9px 4px 8px;
  color: var(--color-text-primary);
  border-radius: 7px;
}

.ai-trigger-copy { display: grid; gap: 0; line-height: 1.05; }
.ai-trigger-copy strong { font-size: 12px; }
.ai-trigger-copy small { font-size: 9px; color: var(--color-text-tertiary); }

.ai-menu { width: 344px; padding: 10px; border-radius: 8px; }
.ai-menu-heading { display: flex; align-items: flex-start; justify-content: space-between; padding: 2px 2px 10px; }
.ai-menu-heading strong, .ai-menu-heading span { display: block; }
.ai-menu-heading strong { font-size: 14px; color: var(--color-text-primary); }
.ai-menu-heading span { margin-top: 3px; font-size: 11px; color: var(--color-text-tertiary); }
.ai-menu-close { width: 24px; height: 24px; padding: 0; font-size: 18px; line-height: 1; color: var(--color-text-tertiary); cursor: pointer; background: transparent; border: 0; border-radius: 5px; }
.ai-menu-close:hover { color: var(--color-text-primary); background: var(--color-hover); }
.ai-context-preview { padding: 9px 10px; margin-bottom: 8px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 6px; }
.ai-context-preview span { font-size: 10px; font-weight: 600; color: var(--color-text-tertiary); }
.ai-context-preview p { margin: 3px 0 0; overflow: hidden; font-size: 12px; line-height: 1.45; color: var(--color-text-secondary); text-overflow: ellipsis; white-space: nowrap; }
.ai-menu-label { padding: 4px 2px 6px; }
.ai-action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ai-action-card { display: flex; gap: 8px; align-items: center; min-height: 58px; padding: 8px; text-align: left; cursor: pointer; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 6px; transition: border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast); }
.ai-action-card:hover { background: var(--color-hover); border-color: var(--color-accent); transform: translateY(-1px); }
.ai-action-card > span:last-child { min-width: 0; }
.ai-action-card strong, .ai-action-card small { display: block; }
.ai-action-card strong { font-size: 12px; color: var(--color-text-primary); }
.ai-action-card small { margin-top: 2px; font-size: 10px; color: var(--color-text-tertiary); line-height: 1.25; }
.ai-action-icon { display: grid; flex: 0 0 27px; width: 27px; height: 27px; place-items: center; font-size: 15px; font-weight: 600; color: var(--color-accent); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 5px; }
.ai-menu-item { display: flex; gap: 8px; align-items: center; }
.ai-menu-item-icon { display: grid; width: 21px; height: 21px; place-items: center; font-size: 11px; color: var(--color-accent); border: 1px solid var(--color-border); border-radius: 4px; }
.ai-prompt-row { display: flex; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--color-border); }
.ai-prompt-row input { min-width: 0; flex: 1; height: 33px; padding: 0 10px; font: inherit; font-size: 12px; color: var(--color-text-primary); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 5px; outline: none; }
.ai-prompt-row input:focus { border-color: var(--color-accent); }
.ai-prompt-row button { width: 34px; height: 33px; color: var(--color-text-inverse); cursor: pointer; background: var(--color-accent); border: 0; border-radius: 5px; }
.ai-prompt-row button:disabled { cursor: default; opacity: .45; }

</style>
