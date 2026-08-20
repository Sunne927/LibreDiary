<script setup lang="ts">
/**
 * BubbleToolbar - 划字悬浮工具条
 * @description 选中文本时出现的浮动格式化条（Tiptap BubbleMenu，随选区定位），
 * 含 H1/H2/H3、粗斜下删、颜色/高亮、链接、列表与右侧 AI 下拉。
 * AI 输出沿用"预览→接受写入"，与顶部工具栏共用 useEditorAi。
 */
import { ref } from 'vue';
import { BubbleMenu } from '@tiptap/vue-3/menus';
import type { WritingAction } from '@/services/writing.service';
import { useEditorAi } from '@/composables/useEditorAi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const props = defineProps<{ editor: any }>();

const {
  isZh, aiEnabled, processing, suggestion, SUPPORTED_LANGUAGES,
  sourceText, runAction, translate, acceptSuggestion, clearSuggestion,
} = useEditorAi(() => props.editor);

const icons: Record<string, string> = {
  bold: 'M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z',
  italic: 'M19 4h-9M14 20H5M15 4 9 20',
  underline: 'M6 4v6a6 6 0 0 0 12 0V4M4 20h16',
  strike: 'M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  bullet: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  ordered: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
  task: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  chevron: 'M6 9l6 6 6-6',
  ai: 'M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l1-8z',
  aiContinue: 'M13 3v7h5l-7 11v-7H6l7-11z',
  aiPolish: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
  aiSummary: 'M14 3v4a1 1 0 0 0 1 1h4M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM8 13h8M8 17h5',
  aiCustom: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7 3 3 0 0 1 1 2.3V17h6v-.2a3 3 0 0 1 1-2.1A7 7 0 0 0 12 2z',
  aiTranslate: 'M4 5h7M9 3v2c0 4.5-2.5 8-5 9.5M5 9c0 2.5 2.5 5 5 5.5M11.5 20l4-9 4 9M13 17h5',
};

const TEXT_COLORS = ['#000000', '#ff0000', '#ff9900', '#ffcc00', '#00b050', '#00b0f0', '#0070c0', '#7030a0', '#5c635c', '#ffffff'];
const HIGHLIGHT_COLORS = ['#fff3a3', '#ffd6a5', '#c8f7c5', '#bde0fe', '#ffc9de', '#e6d3ff', '#d0f0ef', '#e2e8e2'];

// reactive re-render on editor changes
const tick = ref(0);
const onTx = () => { tick.value++; };
props.editor?.on('transaction', onTx);
props.editor?.on('selectionUpdate', onTx);

function active(name: string, attrs?: Record<string, unknown>): boolean {
  void tick.value;
  return props.editor?.isActive(name, attrs) ?? false;
}
function chain() {
  return props.editor.chain().focus();
}
function toggleHeading(level: 1 | 2 | 3) {
  chain().toggleHeading({ level }).run();
}

// Show whenever there's a non-empty text selection (don't depend on focus detection,
// which is flaky and hid the bubble). Hide inside code blocks / non-editable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shouldShow({ editor, state }: any): boolean {
  if (!editor?.isEditable) return false;
  const { selection } = state;
  if (selection.empty) return false;
  // TextSelection only (skip node/cell selections without text)
  const text = state.doc.textBetween(selection.from, selection.to, ' ').trim();
  if (!text) return false;
  if (editor.isActive('codeBlock')) return false;
  return true;
}

// popovers within/near the bubble
type Pop = 'ai' | 'text' | 'bg' | 'link' | null;
const pop = ref<Pop>(null);
const showLanguages = ref(false);
const linkUrl = ref('');

function togglePop(name: Exclude<Pop, null>) {
  pop.value = pop.value === name ? null : name;
  showLanguages.value = false;
  if (pop.value === 'link') linkUrl.value = (props.editor.getAttributes('link')?.href as string) ?? '';
}
function closePop() {
  pop.value = null;
  showLanguages.value = false;
}
function setColor(c: string) { chain().setColor(c).run(); closePop(); }
function clearColor() { chain().unsetColor().run(); closePop(); }
function setHighlight(c: string) { chain().setHighlight({ color: c }).run(); closePop(); }
function clearHighlight() { chain().unsetHighlight().run(); closePop(); }
function applyLink() {
  const url = linkUrl.value.trim();
  if (url) chain().extendMarkRange('link').setLink({ href: url }).run();
  else chain().extendMarkRange('link').unsetLink().run();
  closePop();
}

const showCustom = ref(false);
const instruction = ref('');
async function doAction(action: WritingAction) {
  closePop();
  await runAction(action);
}
async function doTranslate(language: string) {
  closePop();
  await translate(language);
}
function openCustom() {
  closePop();
  showCustom.value = true;
}
function submitCustom() {
  const value = instruction.value.trim();
  if (!value) return;
  showCustom.value = false;
  instruction.value = '';
  void runAction('custom', sourceText(), value);
}
</script>

<template>
  <BubbleMenu
    v-if="editor"
    :editor="editor"
    :should-show="shouldShow"
    :options="{ strategy: 'fixed', placement: 'top' }"
    class="bt-floating"
  >
    <div class="bt-bar" @mousedown.prevent>
      <!-- 标题 -->
      <button type="button" class="bt-h" :class="{ active: active('heading', { level: 1 }) }" @click="toggleHeading(1)">H1</button>
      <button type="button" class="bt-h" :class="{ active: active('heading', { level: 2 }) }" @click="toggleHeading(2)">H2</button>
      <button type="button" class="bt-h" :class="{ active: active('heading', { level: 3 }) }" @click="toggleHeading(3)">H3</button>
      <span class="bt-sep" />
      <!-- 文本格式 -->
      <button type="button" class="bt-btn" :class="{ active: active('bold') }" title="加粗" @click="chain().toggleBold().run()"><svg viewBox="0 0 24 24"><path :d="icons.bold" /></svg></button>
      <button type="button" class="bt-btn" :class="{ active: active('italic') }" title="斜体" @click="chain().toggleItalic().run()"><svg viewBox="0 0 24 24"><path :d="icons.italic" /></svg></button>
      <button type="button" class="bt-btn" :class="{ active: active('underline') }" title="下划线" @click="chain().toggleUnderline().run()"><svg viewBox="0 0 24 24"><path :d="icons.underline" /></svg></button>
      <button type="button" class="bt-btn" :class="{ active: active('strike') }" title="删除线" @click="chain().toggleStrike().run()"><svg viewBox="0 0 24 24"><path :d="icons.strike" /></svg></button>
      <span class="bt-sep" />
      <!-- 颜色 / 高亮 -->
      <div class="bt-pop-wrap">
        <button type="button" class="bt-btn bt-color" :class="{ active: pop === 'text' }" :title="isZh ? '文字颜色' : 'Text color'" @click="togglePop('text')">
          <span class="bt-a">A</span><span class="bt-bar-color" :style="{ background: (editor.getAttributes('textStyle').color) || 'var(--color-text-primary)' }" />
        </button>
        <div v-if="pop === 'text'" class="bt-swatch-pop">
          <div class="bt-swatches"><button v-for="c in TEXT_COLORS" :key="c" type="button" class="bt-swatch" :style="{ background: c }" @click="setColor(c)" /></div>
          <button type="button" class="bt-clear" @click="clearColor">{{ isZh ? '清除' : 'Clear' }}</button>
        </div>
      </div>
      <div class="bt-pop-wrap">
        <button type="button" class="bt-btn bt-color" :class="{ active: pop === 'bg' }" :title="isZh ? '高亮' : 'Highlight'" @click="togglePop('bg')">
          <span class="bt-a bt-a-hl">A</span><span class="bt-bar-color" :style="{ background: (editor.getAttributes('highlight').color) || '#fff3a3' }" />
        </button>
        <div v-if="pop === 'bg'" class="bt-swatch-pop">
          <div class="bt-swatches"><button v-for="c in HIGHLIGHT_COLORS" :key="c" type="button" class="bt-swatch" :style="{ background: c }" @click="setHighlight(c)" /></div>
          <button type="button" class="bt-clear" @click="clearHighlight">{{ isZh ? '清除' : 'Clear' }}</button>
        </div>
      </div>
      <span class="bt-sep" />
      <!-- 链接 -->
      <div class="bt-pop-wrap">
        <button type="button" class="bt-btn" :class="{ active: active('link') || pop === 'link' }" :title="isZh ? '链接' : 'Link'" @click="togglePop('link')"><svg viewBox="0 0 24 24"><path :d="icons.link" /></svg></button>
        <div v-if="pop === 'link'" class="bt-link-pop">
          <input v-model="linkUrl" class="bt-link-input" placeholder="https://" @keydown.enter.prevent="applyLink" />
          <button type="button" class="bt-link-apply" @click="applyLink">{{ isZh ? '确定' : 'OK' }}</button>
        </div>
      </div>
      <span class="bt-sep" />
      <!-- 列表 -->
      <button type="button" class="bt-btn" :class="{ active: active('bulletList') }" :title="isZh ? '项目符号' : 'Bullet list'" @click="chain().toggleBulletList().run()"><svg viewBox="0 0 24 24"><path :d="icons.bullet" /></svg></button>
      <button type="button" class="bt-btn" :class="{ active: active('orderedList') }" :title="isZh ? '编号列表' : 'Numbered list'" @click="chain().toggleOrderedList().run()"><svg viewBox="0 0 24 24"><path :d="icons.ordered" /></svg></button>
      <button type="button" class="bt-btn" :class="{ active: active('taskList') }" :title="isZh ? '待办事项' : 'Task list'" @click="chain().toggleTaskList().run()"><svg viewBox="0 0 24 24"><path :d="icons.task" /></svg></button>

      <!-- AI -->
      <template v-if="aiEnabled">
        <span class="bt-sep" />
        <div class="bt-pop-wrap">
          <button type="button" class="bt-ai" :class="{ active: pop === 'ai' }" :aria-expanded="pop === 'ai'" @click="togglePop('ai')">
            <svg class="bt-ai-bolt" viewBox="0 0 24 24"><path :d="icons.ai" /></svg>
            <span>AI</span>
            <svg class="bt-ai-caret" viewBox="0 0 24 24"><path :d="icons.chevron" /></svg>
          </button>
          <div v-if="pop === 'ai'" class="bt-ai-menu" role="menu">
            <button type="button" role="menuitem" @click="doAction('expand')"><span class="bt-menu-ico"><svg viewBox="0 0 24 24"><path :d="icons.aiContinue" /></svg></span>{{ isZh ? '继续写作' : 'Continue writing' }}</button>
            <button type="button" role="menuitem" @click="doAction('improve')"><span class="bt-menu-ico"><svg viewBox="0 0 24 24"><path :d="icons.aiPolish" /></svg></span>{{ isZh ? '润色文本' : 'Polish text' }}</button>
            <button type="button" role="menuitem" @click="doAction('summarise')"><span class="bt-menu-ico"><svg viewBox="0 0 24 24"><path :d="icons.aiSummary" /></svg></span>{{ isZh ? '总结内容' : 'Summarise' }}</button>
            <button type="button" role="menuitem" @click="openCustom"><span class="bt-menu-ico"><svg viewBox="0 0 24 24"><path :d="icons.aiCustom" /></svg></span>{{ isZh ? '自定义 AI' : 'Custom AI' }}</button>
            <div class="bt-menu-line" />
            <button type="button" role="menuitem" class="bt-has-arrow" @click="showLanguages = !showLanguages"><span class="bt-menu-ico"><svg viewBox="0 0 24 24"><path :d="icons.aiTranslate" /></svg></span>{{ isZh ? '翻译' : 'Translate' }}<b>›</b></button>
            <div v-if="showLanguages" class="bt-lang-submenu">
              <button v-for="language in SUPPORTED_LANGUAGES" :key="language" type="button" @click="doTranslate(language)">{{ language }}</button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </BubbleMenu>

  <Teleport to="body">
    <!-- 自定义 AI 指令 -->
    <div v-if="showCustom" class="bt-overlay" @click.self="showCustom = false">
      <section class="bt-dialog" role="dialog" aria-modal="true">
        <h2>{{ isZh ? '自定义 AI 指令' : 'Custom AI instruction' }}</h2>
        <div class="bt-source"><span>{{ isZh ? '选中内容：' : 'Selected text:' }}</span><p>{{ sourceText() || (isZh ? '将在当前位置生成内容' : 'Content will be generated at the cursor') }}</p></div>
        <input v-model="instruction" autofocus :placeholder="isZh ? '请输入 AI 指令，例如：优化这段文字、翻译...' : 'Enter an instruction...'" @keydown.enter.prevent="submitCustom" />
        <footer><button type="button" @click="showCustom = false">{{ isZh ? '取消' : 'Cancel' }}</button><button type="button" :disabled="!instruction.trim()" @click="submitCustom">{{ isZh ? '执行' : 'Run' }}</button></footer>
      </section>
    </div>

    <!-- AI 建议预览 -->
    <div v-if="suggestion" class="bt-result" role="dialog">
      <header><strong>{{ processing ? (isZh ? 'AI 正在生成...' : 'AI is writing...') : (isZh ? 'AI 建议' : 'AI suggestion') }}</strong><button type="button" @click="clearSuggestion">×</button></header>
      <p>{{ suggestion.content || '...' }}</p>
      <footer><button type="button" @click="clearSuggestion">{{ isZh ? '拒绝' : 'Reject' }}</button><button type="button" :disabled="processing" @click="acceptSuggestion">{{ isZh ? '接受替换' : 'Accept' }}</button></footer>
    </div>
  </Teleport>
</template>

<style scoped>
.bt-floating {
  z-index: 60;
}
.bt-bar {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 4px 5px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgb(0 0 0 / 14%);
}
.bt-btn, .bt-h {
  display: grid;
  place-items: center;
  height: 30px;
  padding: 0;
  color: var(--color-text-primary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 5px;
}
.bt-btn { width: 30px; }
.bt-h { width: 32px; font-size: 13px; font-weight: 600; }
.bt-btn:hover, .bt-h:hover { background: var(--color-hover); }
.bt-btn.active, .bt-h.active { color: var(--color-accent); background: var(--color-accent-subtle); }
.bt-btn svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.bt-sep { width: 1px; height: 20px; margin: 0 3px; background: var(--color-border); }
.bt-color { flex-direction: column; gap: 0; }
.bt-a { font-size: 13px; font-weight: 700; line-height: 1; }
.bt-a-hl { background: #fff3a3; color: #2c2f2c; border-radius: 2px; padding: 0 2px; }
.bt-bar-color { width: 16px; height: 3px; margin-top: 1px; border-radius: 2px; }
.bt-ai {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 5px;
}
.bt-ai:hover { background: var(--color-hover); }
.bt-ai.active { color: var(--color-accent); background: var(--color-accent-subtle); }
.bt-ai-bolt { width: 15px; height: 15px; fill: var(--color-accent); }
.bt-ai-caret { width: 12px; height: 12px; fill: none; stroke: var(--color-text-tertiary); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.bt-pop-wrap { position: relative; display: flex; }

/* 弹层：定位在按钮下方，随选区（tippy 定位整条）而动 */
.bt-swatch-pop, .bt-link-pop, .bt-ai-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 5;
  padding: 8px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 12px 28px rgb(0 0 0 / 18%);
}
.bt-swatches { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
.bt-swatch { width: 22px; height: 22px; cursor: pointer; border: 1px solid var(--color-border); border-radius: 5px; }
.bt-swatch:hover { transform: scale(1.1); }
.bt-clear { width: 100%; margin-top: 7px; padding: 4px; font: inherit; font-size: 12px; color: var(--color-text-secondary); cursor: pointer; background: transparent; border: 1px solid var(--color-border); border-radius: 5px; }
.bt-link-pop { display: flex; gap: 6px; }
.bt-link-input { width: 200px; height: 32px; padding: 0 10px; font: inherit; color: var(--color-text-primary); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 5px; box-sizing: border-box; }
.bt-link-input:focus { border-color: var(--color-accent); outline: none; }
.bt-link-apply { padding: 0 12px; font: inherit; color: #fff; cursor: pointer; background: var(--color-accent); border: 0; border-radius: 5px; }
.bt-ai-menu { right: 0; left: auto; width: 200px; padding: 6px; }
.bt-ai-menu > button { display: flex; gap: 10px; align-items: center; width: 100%; height: 34px; padding: 0 9px; font: inherit; font-size: 13.5px; color: var(--color-text-primary); text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 5px; }
.bt-ai-menu > button:hover { background: var(--color-hover); }
.bt-ai-menu > button > span.bt-menu-ico { display: grid; width: 18px; place-items: center; color: var(--color-text-secondary); }
.bt-ai-menu > button > span.bt-menu-ico svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.bt-has-arrow b { margin-left: auto; font-size: 18px; font-weight: 400; color: var(--color-text-tertiary); }
.bt-menu-line { height: 1px; margin: 5px 4px; background: var(--color-border); }
.bt-lang-submenu { position: absolute; top: 0; right: calc(100% + 6px); width: 150px; max-height: 250px; padding: 6px; overflow-y: auto; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 8px; box-shadow: 0 12px 28px rgb(0 0 0 / 18%); }
.bt-lang-submenu button { display: block; width: 100%; padding: 7px 8px; font: inherit; font-size: 13.5px; color: var(--color-text-primary); text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 4px; }
.bt-lang-submenu button:hover { background: var(--color-hover); }
</style>

<style>
/* 复用顶栏样式风格的自定义弹窗 / 结果面板（Teleport 到 body） */
.bt-overlay { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 20px; background: rgb(0 0 0 / 22%); }
.bt-dialog { width: min(500px, 100%); padding: 22px; background: var(--color-surface-raised); border-radius: 8px; box-shadow: 0 18px 45px rgb(0 0 0 / 24%); }
.bt-dialog h2 { margin: 0 0 18px; font-size: 19px; color: var(--color-accent); }
.bt-source { padding: 12px; margin-bottom: 16px; background: color-mix(in srgb, var(--color-warning) 12%, var(--color-surface)); border: 1px solid color-mix(in srgb, var(--color-warning) 45%, var(--color-border)); border-radius: 5px; }
.bt-source span { font-size: 13px; color: var(--color-text-secondary); }
.bt-source p { margin: 6px 0 0; line-height: 1.45; color: var(--color-text-primary); }
.bt-dialog input { width: 100%; height: 44px; padding: 0 12px; font: inherit; color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: 5px; box-sizing: border-box; }
.bt-dialog footer, .bt-result footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.bt-dialog footer button, .bt-result footer button { padding: 7px 13px; font: inherit; cursor: pointer; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 4px; }
.bt-dialog footer button:last-child, .bt-result footer button:last-child { color: white; background: var(--color-accent); border-color: var(--color-accent); }
.bt-dialog button:disabled, .bt-result button:disabled { opacity: .45; cursor: default; }
.bt-result { position: fixed; right: 20px; bottom: 20px; z-index: 1201; width: min(420px, calc(100vw - 40px)); padding: 15px; background: var(--color-surface-raised); border: 1px solid var(--color-accent); border-radius: 8px; box-shadow: 0 14px 35px rgb(0 0 0 / 20%); }
.bt-result header { display: flex; justify-content: space-between; }
.bt-result header button { font-size: 20px; cursor: pointer; background: none; border: 0; }
.bt-result p { max-height: 220px; overflow: auto; line-height: 1.55; white-space: pre-wrap; }
</style>
