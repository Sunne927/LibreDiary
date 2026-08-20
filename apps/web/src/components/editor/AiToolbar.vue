<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { streamWriteText } from '@/services/writing.service';
import type { WritingAction } from '@/services/writing.service';
import { translateText, SUPPORTED_LANGUAGES } from '@/services/translation.service';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const props = defineProps<{ editor: any }>();
const { locale } = useI18n();
const authStore = useAuthStore();
const toast = useToast();

const trigger = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const showLanguages = ref(false);
const showCustom = ref(false);
const instruction = ref('');
const processing = ref(false);
const position = ref({ top: 0, left: 0 });
const suggestion = ref<{ from: number; to: number; original: string; content: string } | null>(null);
const aiEnabled = computed(() => authStore.currentOrganization?.aiEnabled ?? false);

function selectedText() {
  const { from, to } = props.editor.state.selection;
  return props.editor.state.doc.textBetween(from, to, ' ').trim();
}

function sourceText() {
  return selectedText() || props.editor.state.doc.textContent.trim();
}

function placeMenu() {
  const rect = trigger.value?.getBoundingClientRect();
  if (!rect) return;
  const width = 230;
  const height = 278;
  const margin = 10;
  const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
  const below = rect.bottom + height + margin <= window.innerHeight;
  position.value = { left, top: below ? rect.bottom + 8 : Math.max(margin, rect.top - height - 8) };
}

function closeMenu() {
  isOpen.value = false;
  showLanguages.value = false;
}

async function toggleMenu() {
  isOpen.value = !isOpen.value;
  showLanguages.value = false;
  if (isOpen.value) {
    await nextTick();
    placeMenu();
  }
}

function onViewportChange() {
  if (isOpen.value) placeMenu();
}

window.addEventListener('resize', onViewportChange);
window.addEventListener('scroll', onViewportChange, true);
onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, true);
});

async function runAction(action: WritingAction, text = sourceText(), customInstruction?: string) {
  if (!text) {
    toast.error(locale.value === 'zh-CN' ? '请先输入或选中内容' : 'Enter or select some content first');
    return;
  }
  const orgId = authStore.currentOrganizationId;
  if (!orgId) return;
  const { from, to } = props.editor.state.selection;
  suggestion.value = { from, to, original: text, content: '' };
  processing.value = true;
  closeMenu();
  try {
    await streamWriteText(orgId, action, text, {
      onToken: (token) => { if (suggestion.value) suggestion.value.content += token; },
    }, customInstruction);
  } catch {
    suggestion.value = null;
    toast.error(locale.value === 'zh-CN' ? 'AI 请求失败，请重试' : 'AI request failed. Please try again.');
  } finally {
    processing.value = false;
  }
}

async function translate(language: string) {
  const text = sourceText();
  const orgId = authStore.currentOrganizationId;
  if (!text || !orgId) return;
  const { from, to } = props.editor.state.selection;
  processing.value = true;
  closeMenu();
  try {
    const result = await translateText(orgId, text, language as Parameters<typeof translateText>[2]);
    suggestion.value = { from, to, original: text, content: result.translatedText };
  } catch {
    toast.error(locale.value === 'zh-CN' ? '翻译失败，请重试' : 'Translation failed. Please try again.');
  } finally { processing.value = false; }
}

function submitCustom() {
  const value = instruction.value.trim();
  if (!value) return;
  showCustom.value = false;
  instruction.value = '';
  void runAction('custom', sourceText(), value);
}

function acceptSuggestion() {
  const value = suggestion.value;
  if (!value || processing.value) return;
  props.editor.chain().focus().insertContentAt({ from: value.from, to: value.to }, value.content).run();
  suggestion.value = null;
}
</script>

<template>
  <div v-if="aiEnabled" class="editor-toolbar" aria-label="编辑器工具栏">
    <button type="button" title="加粗" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()"><b>B</b></button>
    <button type="button" title="斜体" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()"><i>I</i></button>
    <button type="button" title="下划线"><u>U</u></button>
    <button type="button" title="删除线" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()"><s>S</s></button>
    <span class="toolbar-divider" />
    <button type="button" title="项目符号" @click="editor.chain().focus().toggleBulletList().run()">☷</button>
    <button type="button" title="编号列表" @click="editor.chain().focus().toggleOrderedList().run()">☷</button>
    <button type="button" title="待办事项" @click="editor.chain().focus().toggleTaskList().run()">☑</button>
    <span class="toolbar-divider" />
    <button type="button" title="插入链接">⌁</button>
    <button ref="trigger" type="button" class="ai-toolbar-trigger" :class="{ active: isOpen }" :aria-expanded="isOpen" @click="toggleMenu">
      <span class="ai-bolt">ϟ</span> AI <span class="caret">⌄</span>
    </button>
  </div>

  <Teleport to="body">
    <div v-if="isOpen" class="ai-toolbar-menu" :style="{ top: `${position.top}px`, left: `${position.left}px` }" role="menu">
      <button type="button" role="menuitem" @click="runAction('expand')"><span>ϟ</span>{{ locale === 'zh-CN' ? '继续写作' : 'Continue writing' }}</button>
      <button type="button" role="menuitem" @click="runAction('improve')"><span>✎</span>{{ locale === 'zh-CN' ? '润色文本' : 'Polish text' }}</button>
      <button type="button" role="menuitem" @click="runAction('summarise')"><span>▤</span>{{ locale === 'zh-CN' ? '总结内容' : 'Summarise' }}</button>
      <button type="button" role="menuitem" @click="showCustom = true; closeMenu()"><span>♧</span>{{ locale === 'zh-CN' ? '自定义 AI' : 'Custom AI' }}</button>
      <div class="menu-line" />
      <button type="button" role="menuitem" class="has-arrow" @click="showLanguages = !showLanguages"><span>文</span>{{ locale === 'zh-CN' ? '翻译' : 'Translate' }}<b>›</b></button>
      <div v-if="showLanguages" class="language-submenu">
        <button v-for="language in SUPPORTED_LANGUAGES" :key="language" type="button" @click="translate(language)">{{ language }}</button>
      </div>
    </div>

    <div v-if="showCustom" class="custom-overlay" @click.self="showCustom = false">
      <section class="custom-dialog" role="dialog" aria-modal="true">
        <h2>{{ locale === 'zh-CN' ? '自定义 AI 指令' : 'Custom AI instruction' }}</h2>
        <div class="custom-source"><span>{{ locale === 'zh-CN' ? '选中内容：' : 'Selected text:' }}</span><p>{{ sourceText() || (locale === 'zh-CN' ? '将在当前位置生成内容' : 'Content will be generated at the cursor') }}</p></div>
        <input v-model="instruction" autofocus :placeholder="locale === 'zh-CN' ? '请输入 AI 指令，例如：优化这段文字、翻译...' : 'Enter an instruction, e.g. improve this text...'" @keydown.enter.prevent="submitCustom" />
        <footer><button type="button" @click="showCustom = false">{{ locale === 'zh-CN' ? '取消' : 'Cancel' }}</button><button type="button" :disabled="!instruction.trim()" @click="submitCustom">{{ locale === 'zh-CN' ? '执行' : 'Run' }}</button></footer>
      </section>
    </div>

    <div v-if="suggestion" class="ai-result" role="dialog">
      <header><strong>{{ processing ? (locale === 'zh-CN' ? 'AI 正在生成...' : 'AI is writing...') : (locale === 'zh-CN' ? 'AI 建议' : 'AI suggestion') }}</strong><button type="button" @click="suggestion = null">×</button></header>
      <p>{{ suggestion.content || '...' }}</p>
      <footer><button type="button" @click="suggestion = null">{{ locale === 'zh-CN' ? '拒绝' : 'Reject' }}</button><button type="button" :disabled="processing" @click="acceptSuggestion">{{ locale === 'zh-CN' ? '接受替换' : 'Accept' }}</button></footer>
    </div>
  </Teleport>
</template>

<style scoped>
.editor-toolbar { display: flex; align-items: center; gap: 2px; min-height: 46px; padding: 5px 8px; margin: 0 -28px 12px; overflow-x: auto; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 6px; }
.editor-toolbar button { display: grid; width: 34px; height: 34px; place-items: center; padding: 0; font: inherit; font-size: 18px; color: var(--color-text-primary); cursor: pointer; background: transparent; border: 0; border-radius: 4px; }
.editor-toolbar button:hover, .editor-toolbar button.active { background: var(--color-hover); }
.toolbar-divider { width: 1px; height: 25px; margin: 0 6px; background: var(--color-border); }
.editor-toolbar .ai-toolbar-trigger { display: flex; gap: 5px; align-items: center; width: auto; padding: 0 10px; margin-left: auto; font-size: 14px; border: 1px solid transparent; }
.editor-toolbar .ai-toolbar-trigger.active { color: var(--color-accent); background: var(--color-accent-subtle); border-color: var(--color-accent); }
.ai-bolt { font-size: 22px; font-style: italic; }.caret { font-size: 15px; color: var(--color-text-tertiary); }
</style>

<style>
.ai-toolbar-menu { position: fixed; z-index: 1000; width: 230px; padding: 7px; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 8px; box-shadow: 0 14px 28px rgb(0 0 0 / 16%); }
.ai-toolbar-menu > button { display: flex; gap: 12px; align-items: center; width: 100%; height: 42px; padding: 0 10px; font: inherit; font-size: 16px; color: var(--color-text-primary); text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 5px; }
.ai-toolbar-menu > button:hover { background: var(--color-hover); }.ai-toolbar-menu > button > span { display: grid; width: 22px; place-items: center; font-size: 20px; color: var(--color-text-secondary); }.ai-toolbar-menu .has-arrow b { margin-left: auto; font-size: 25px; font-weight: 400; }.menu-line { height: 1px; margin: 6px 4px; background: var(--color-border); }.language-submenu { position: absolute; top: 0; left: calc(100% + 6px); width: 160px; max-height: 260px; padding: 6px; overflow-y: auto; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 8px; box-shadow: 0 14px 28px rgb(0 0 0 / 16%); }.language-submenu button { display: block; width: 100%; padding: 8px; color: var(--color-text-primary); text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 4px; }.language-submenu button:hover { background: var(--color-hover); }
.custom-overlay { position: fixed; inset: 0; z-index: 1100; display: grid; place-items: center; padding: 20px; background: rgb(0 0 0 / 22%); }.custom-dialog { width: min(500px, 100%); padding: 22px; background: var(--color-surface-raised); border-radius: 8px; box-shadow: 0 18px 45px rgb(0 0 0 / 24%); }.custom-dialog h2 { margin: 0 0 18px; font-size: 19px; color: var(--color-accent); }.custom-source { padding: 12px; margin-bottom: 16px; background: color-mix(in srgb, var(--color-warning) 12%, var(--color-surface)); border: 1px solid color-mix(in srgb, var(--color-warning) 45%, var(--color-border)); border-radius: 5px; }.custom-source span { font-size: 13px; color: var(--color-text-secondary); }.custom-source p { margin: 6px 0 0; line-height: 1.45; color: var(--color-text-primary); }.custom-dialog input { width: 100%; height: 44px; padding: 0 12px; font: inherit; color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: 5px; box-sizing: border-box; }.custom-dialog footer, .ai-result footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }.custom-dialog footer button, .ai-result footer button { padding: 7px 13px; font: inherit; cursor: pointer; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 4px; }.custom-dialog footer button:last-child, .ai-result footer button:last-child { color: white; background: var(--color-accent); border-color: var(--color-accent); }.custom-dialog button:disabled, .ai-result button:disabled { opacity: .45; cursor: default; }
.ai-result { position: fixed; right: 20px; bottom: 20px; z-index: 1001; width: min(420px, calc(100vw - 40px)); padding: 15px; background: var(--color-surface-raised); border: 1px solid var(--color-accent); border-radius: 8px; box-shadow: 0 14px 35px rgb(0 0 0 / 20%); }.ai-result header { display: flex; justify-content: space-between; }.ai-result header button { font-size: 20px; cursor: pointer; background: none; border: 0; }.ai-result p { max-height: 220px; overflow: auto; line-height: 1.55; white-space: pre-wrap; }
@media (max-width: 540px) { .editor-toolbar { margin-right: -8px; margin-left: -8px; }.editor-toolbar .ai-toolbar-trigger { margin-left: 0; }.ai-toolbar-menu { width: min(230px, calc(100vw - 20px)); }.language-submenu { right: 0; left: auto; transform: translateX(-20px); } }
</style>
