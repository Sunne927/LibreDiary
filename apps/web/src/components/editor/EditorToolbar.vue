<script setup lang="ts">
/**
 * EditorToolbar - 完整格式化工具栏
 * @description 将 Tiptap UI Kit 的编辑器功能移植到 LibreDiary，视觉沿用本站设计令牌。
 * 左侧为完整格式工具，右侧为 AI 下拉（继续写作 / 润色 / 总结 / 自定义 / 翻译），
 * AI 输出采用「预览，接受后写入」的方式。
 */
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { streamWriteText } from '@/services/writing.service';
import type { WritingAction } from '@/services/writing.service';
import { translateText, SUPPORTED_LANGUAGES } from '@/services/translation.service';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const props = defineProps<{ editor: any }>();
const emit = defineEmits<{ (e: 'import'): void }>();

const { locale } = useI18n();
const authStore = useAuthStore();
const toast = useToast();
const isZh = computed(() => locale.value === 'zh-CN');
const aiEnabled = computed(() => authStore.currentOrganization?.aiEnabled ?? false);

/* ---------- 编辑器状态响应式 ---------- */
// Tiptap 的 isActive/getAttributes 并非 Vue 响应式，用 transaction 事件驱动模板刷新
const tick = ref(0);
const onTx = () => { tick.value++; };
props.editor?.on('transaction', onTx);
props.editor?.on('selectionUpdate', onTx);

function active(name: string, attrs?: Record<string, unknown>): boolean {
  void tick.value;
  return props.editor?.isActive(name, attrs) ?? false;
}
function attr(name: string, key: string): string {
  void tick.value;
  return (props.editor?.getAttributes(name)?.[key] as string) ?? '';
}

/* ---------- 选项常量（移植自 UI Kit） ---------- */
const FONT_FAMILIES = [
  { label: isZh.value ? '默认字体' : 'Default', value: '' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Monospace', value: 'monospace' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '宋体', value: 'SimSun' },
  { label: '黑体', value: 'SimHei' },
];
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
const TEXT_COLORS = ['#000000', '#ff0000', '#ff9900', '#ffcc00', '#00b050', '#00b0f0', '#0070c0', '#7030a0', '#5c635c', '#ffffff'];
const HIGHLIGHT_COLORS = ['#fff3a3', '#ffd6a5', '#c8f7c5', '#bde0fe', '#ffc9de', '#e6d3ff', '#d0f0ef', '#e2e8e2'];
const HEADINGS = [
  { label: isZh.value ? '正文' : 'Text', level: 0 },
  { label: 'H1', level: 1 },
  { label: 'H2', level: 2 },
  { label: 'H3', level: 3 },
  { label: 'H4', level: 4 },
  { label: 'H5', level: 5 },
  { label: 'H6', level: 6 },
];

/* ---------- 图标（lucide 风格 path） ---------- */
const icons: Record<string, string> = {
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4',
  redo: 'm15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h4',
  brush: 'M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z',
  eraser: 'm7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21M22 21H7M5 11l9 9',
  bold: 'M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z',
  italic: 'M19 4h-9M14 20H5M15 4 9 20',
  underline: 'M6 4v6a6 6 0 0 0 12 0V4M4 20h16',
  strike: 'M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  bullet: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  ordered: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
  task: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  alignLeft: 'M15 12H3M17 6H3M21 18H3',
  alignCenter: 'M17 12H7M19 6H5M21 18H3',
  alignRight: 'M21 12H9M21 6H7M21 18H3',
  alignJustify: 'M21 12H3M21 6H3M21 18H3',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  table: 'M12 3v18M3 9h18M3 15h18M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  image: 'M21 15l-5-5L5 21M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  imageDot: 'M9 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  chevron: 'M6 9l6 6 6-6',
  ai: 'M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l1-8z',
  aiContinue: 'M13 3v7h5l-7 11v-7H6l7-11z',
  aiPolish: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
  aiSummary: 'M14 3v4a1 1 0 0 0 1 1h4M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM8 13h8M8 17h5',
  aiCustom: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7 3 3 0 0 1 1 2.3V17h6v-.2a3 3 0 0 1 1-2.1A7 7 0 0 0 12 2z',
  aiTranslate: 'M4 5h7M9 3v2c0 4.5-2.5 8-5 9.5M5 9c0 2.5 2.5 5 5 5.5M11.5 20l4-9 4 9M13 17h5',
};

/* ---------- 命令 ---------- */
function chain() {
  return props.editor.chain().focus();
}
function setFontFamily(value: string) {
  if (value === '') chain().unsetFontFamily().run();
  else chain().setFontFamily(value).run();
}
function setFontSize(value: string) {
  if (!value) chain().setMark('textStyle', { fontSize: null }).run();
  else chain().setMark('textStyle', { fontSize: value }).run();
}
function currentFontSize() {
  return attr('textStyle', 'fontSize') || '16px';
}
function currentFontFamily() {
  return attr('textStyle', 'fontFamily') || '';
}
function currentHeadingLevel(): number {
  void tick.value;
  for (let l = 1; l <= 6; l++) if (active('heading', { level: l })) return l;
  return 0;
}
function setHeading(level: number) {
  if (level === 0) chain().setParagraph().run();
  else chain().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
}
function setAlign(value: string) {
  chain().setTextAlign(value).run();
}
function alignActive(value: string): boolean {
  void tick.value;
  return props.editor?.isActive({ textAlign: value }) ?? false;
}
function setColor(color: string) {
  chain().setColor(color).run();
  closePopover();
}
function clearColor() {
  chain().unsetColor().run();
  closePopover();
}
function setHighlight(color: string) {
  chain().setHighlight({ color }).run();
  closePopover();
}
function clearHighlight() {
  chain().unsetHighlight().run();
  closePopover();
}
function toggleFormatPainter() {
  if (props.editor.storage.formatPainter?.isActive) {
    props.editor.commands.cancelFormatPainting();
  } else {
    props.editor.commands.startFormatPainting(1);
  }
}
function clearFormat() {
  chain().unsetAllMarks().run();
}
function insertTable() {
  chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
}

/* ---------- 弹层通用定位（随视窗避让，不溢出） ---------- */
type Popover = 'text' | 'bg' | 'link' | null;
const popover = ref<Popover>(null);
const popPos = ref({ top: 0, left: 0 });
const linkUrl = ref('');
const anchors: Record<string, HTMLElement | null> = {};
function setAnchor(name: string, el: unknown) {
  anchors[name] = (el as HTMLElement) ?? null;
}
async function openPopover(name: Popover, width: number, height: number) {
  if (popover.value === name) { closePopover(); return; }
  popover.value = name;
  if (name === 'link') linkUrl.value = attr('link', 'href') || '';
  await nextTick();
  const rect = anchors[name!]?.getBoundingClientRect();
  if (!rect) return;
  const margin = 10;
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
  const below = rect.bottom + height + margin <= window.innerHeight;
  popPos.value = { left, top: below ? rect.bottom + 6 : Math.max(margin, rect.top - height - 6) };
}
function closePopover() {
  popover.value = null;
}
function applyLink() {
  const url = linkUrl.value.trim();
  if (url) chain().extendMarkRange('link').setLink({ href: url }).run();
  else chain().extendMarkRange('link').unsetLink().run();
  closePopover();
}

/* ---------- 图片上传 ---------- */
const fileInput = ref<HTMLInputElement | null>(null);
function pickImage() {
  fileInput.value?.click();
}
function onImageSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    // ImageUploadExtension 注入的命令
    props.editor.commands.uploadImage(file, authStore.currentOrganizationId ?? undefined);
  }
  input.value = '';
}

/* ---------- AI 菜单（移植自 AiToolbar，逻辑不变） ---------- */
const aiTrigger = ref<HTMLElement | null>(null);
const aiOpen = ref(false);
const showLanguages = ref(false);
const showCustom = ref(false);
const instruction = ref('');
const processing = ref(false);
const aiPos = ref({ top: 0, left: 0 });
const suggestion = ref<{ from: number; to: number; original: string; content: string } | null>(null);

function selectedText() {
  const { from, to } = props.editor.state.selection;
  return props.editor.state.doc.textBetween(from, to, ' ').trim();
}
function sourceText() {
  return selectedText() || props.editor.state.doc.textContent.trim();
}
function placeAiMenu() {
  const rect = aiTrigger.value?.getBoundingClientRect();
  if (!rect) return;
  const width = 230;
  const height = 278;
  const margin = 10;
  const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
  const below = rect.bottom + height + margin <= window.innerHeight;
  aiPos.value = { left, top: below ? rect.bottom + 8 : Math.max(margin, rect.top - height - 8) };
}
function closeAiMenu() {
  aiOpen.value = false;
  showLanguages.value = false;
}
async function toggleAiMenu() {
  aiOpen.value = !aiOpen.value;
  showLanguages.value = false;
  if (aiOpen.value) {
    await nextTick();
    placeAiMenu();
  }
}
function onViewportChange() {
  if (aiOpen.value) placeAiMenu();
  if (popover.value) closePopover();
}
window.addEventListener('resize', onViewportChange);
window.addEventListener('scroll', onViewportChange, true);
onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, true);
  props.editor?.off('transaction', onTx);
  props.editor?.off('selectionUpdate', onTx);
});

async function runAction(action: WritingAction, text = sourceText(), customInstruction?: string) {
  if (!text) {
    toast.error(isZh.value ? '请先输入或选中内容' : 'Enter or select some content first');
    return;
  }
  const orgId = authStore.currentOrganizationId;
  if (!orgId) return;
  const { from, to } = props.editor.state.selection;
  suggestion.value = { from, to, original: text, content: '' };
  processing.value = true;
  closeAiMenu();
  try {
    await streamWriteText(orgId, action, text, {
      onToken: (token) => { if (suggestion.value) suggestion.value.content += token; },
    }, customInstruction);
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
  const { from, to } = props.editor.state.selection;
  processing.value = true;
  closeAiMenu();
  try {
    const result = await translateText(orgId, text, language as Parameters<typeof translateText>[2]);
    suggestion.value = { from, to, original: text, content: result.translatedText };
  } catch {
    toast.error(isZh.value ? '翻译失败，请重试' : 'Translation failed. Please try again.');
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
  <div class="et-toolbar" role="toolbar" :aria-label="isZh ? '编辑器工具栏' : 'Editor toolbar'">
    <!-- 撤销 / 重做 -->
    <div class="et-group">
      <button type="button" class="et-btn" :title="isZh ? '撤销' : 'Undo'" @click="chain().undo().run()">
        <svg viewBox="0 0 24 24"><path :d="icons.undo" /></svg>
      </button>
      <button type="button" class="et-btn" :title="isZh ? '重做' : 'Redo'" @click="chain().redo().run()">
        <svg viewBox="0 0 24 24"><path :d="icons.redo" /></svg>
      </button>
    </div>

    <!-- 格式刷 / 清除格式 -->
    <div class="et-group">
      <button type="button" class="et-btn" :class="{ active: editor.storage.formatPainter?.isActive }" :title="isZh ? '格式刷' : 'Format painter'" @click="toggleFormatPainter">
        <svg viewBox="0 0 24 24"><path :d="icons.brush" /></svg>
      </button>
      <button type="button" class="et-btn" :title="isZh ? '清除格式' : 'Clear formatting'" @click="clearFormat">
        <svg viewBox="0 0 24 24"><path :d="icons.eraser" /></svg>
      </button>
    </div>

    <!-- 字体 / 字号 -->
    <div class="et-group">
      <select class="et-select et-font" :value="currentFontFamily()" :title="isZh ? '字体' : 'Font'" @change="setFontFamily(($event.target as HTMLSelectElement).value)">
        <option v-for="f in FONT_FAMILIES" :key="f.value" :value="f.value">{{ f.label }}</option>
      </select>
      <select class="et-select et-size" :value="currentFontSize()" :title="isZh ? '字号' : 'Font size'" @change="setFontSize(($event.target as HTMLSelectElement).value)">
        <option v-for="s in FONT_SIZES" :key="s" :value="s">{{ s.replace('px', '') }}</option>
      </select>
    </div>

    <!-- 文本格式 -->
    <div class="et-group">
      <button type="button" class="et-btn" :class="{ active: active('bold') }" title="加粗" @click="chain().toggleBold().run()">
        <svg viewBox="0 0 24 24"><path :d="icons.bold" /></svg>
      </button>
      <button type="button" class="et-btn" :class="{ active: active('italic') }" title="斜体" @click="chain().toggleItalic().run()">
        <svg viewBox="0 0 24 24"><path :d="icons.italic" /></svg>
      </button>
      <button type="button" class="et-btn" :class="{ active: active('underline') }" title="下划线" @click="chain().toggleUnderline().run()">
        <svg viewBox="0 0 24 24"><path :d="icons.underline" /></svg>
      </button>
      <button type="button" class="et-btn" :class="{ active: active('strike') }" title="删除线" @click="chain().toggleStrike().run()">
        <svg viewBox="0 0 24 24"><path :d="icons.strike" /></svg>
      </button>
      <button type="button" class="et-btn" :class="{ active: active('code') }" :title="isZh ? '行内代码' : 'Inline code'" @click="chain().toggleCode().run()">
        <svg viewBox="0 0 24 24"><path :d="icons.code" /></svg>
      </button>
    </div>

    <!-- 文字颜色 / 高亮 -->
    <div class="et-group">
      <button :ref="(el) => setAnchor('text', el)" type="button" class="et-btn et-color-btn" :class="{ active: popover === 'text' }" :title="isZh ? '文字颜色' : 'Text color'" @click="openPopover('text', 176, 96)">
        <span class="et-a">A</span>
        <span class="et-color-bar" :style="{ background: attr('textStyle', 'color') || 'var(--color-text-primary)' }" />
      </button>
      <button :ref="(el) => setAnchor('bg', el)" type="button" class="et-btn et-color-btn" :class="{ active: popover === 'bg' }" :title="isZh ? '高亮' : 'Highlight'" @click="openPopover('bg', 176, 96)">
        <span class="et-a et-a-hl">A</span>
        <span class="et-color-bar" :style="{ background: attr('highlight', 'color') || '#fff3a3' }" />
      </button>
    </div>

    <!-- 标题 -->
    <div class="et-group">
      <select class="et-select et-heading" :value="currentHeadingLevel()" :title="isZh ? '段落样式' : 'Paragraph style'" @change="setHeading(Number(($event.target as HTMLSelectElement).value))">
        <option v-for="h in HEADINGS" :key="h.level" :value="h.level">{{ h.label }}</option>
      </select>
    </div>

    <!-- 列表 -->
    <div class="et-group">
      <button type="button" class="et-btn" :class="{ active: active('bulletList') }" :title="isZh ? '项目符号' : 'Bullet list'" @click="chain().toggleBulletList().run()">
        <svg viewBox="0 0 24 24"><path :d="icons.bullet" /></svg>
      </button>
      <button type="button" class="et-btn" :class="{ active: active('orderedList') }" :title="isZh ? '编号列表' : 'Numbered list'" @click="chain().toggleOrderedList().run()">
        <svg viewBox="0 0 24 24"><path :d="icons.ordered" /></svg>
      </button>
      <button type="button" class="et-btn" :class="{ active: active('taskList') }" :title="isZh ? '待办事项' : 'Task list'" @click="chain().toggleTaskList().run()">
        <svg viewBox="0 0 24 24"><path :d="icons.task" /></svg>
      </button>
    </div>

    <!-- 对齐 -->
    <div class="et-group">
      <button type="button" class="et-btn" :class="{ active: alignActive('left') }" :title="isZh ? '左对齐' : 'Align left'" @click="setAlign('left')">
        <svg viewBox="0 0 24 24"><path :d="icons.alignLeft" /></svg>
      </button>
      <button type="button" class="et-btn" :class="{ active: alignActive('center') }" :title="isZh ? '居中' : 'Align center'" @click="setAlign('center')">
        <svg viewBox="0 0 24 24"><path :d="icons.alignCenter" /></svg>
      </button>
      <button type="button" class="et-btn" :class="{ active: alignActive('right') }" :title="isZh ? '右对齐' : 'Align right'" @click="setAlign('right')">
        <svg viewBox="0 0 24 24"><path :d="icons.alignRight" /></svg>
      </button>
      <button type="button" class="et-btn" :class="{ active: alignActive('justify') }" :title="isZh ? '两端对齐' : 'Justify'" @click="setAlign('justify')">
        <svg viewBox="0 0 24 24"><path :d="icons.alignJustify" /></svg>
      </button>
    </div>

    <!-- 链接 / 表格 / 图片 / 导入 -->
    <div class="et-group">
      <button :ref="(el) => setAnchor('link', el)" type="button" class="et-btn" :class="{ active: active('link') || popover === 'link' }" :title="isZh ? '链接' : 'Link'" @click="openPopover('link', 280, 92)">
        <svg viewBox="0 0 24 24"><path :d="icons.link" /></svg>
      </button>
      <button type="button" class="et-btn" :title="isZh ? '表格' : 'Table'" @click="insertTable">
        <svg viewBox="0 0 24 24"><path :d="icons.table" /></svg>
      </button>
      <button type="button" class="et-btn" :title="isZh ? '图片' : 'Image'" @click="pickImage">
        <svg viewBox="0 0 24 24"><path :d="icons.image" /><path :d="icons.imageDot" /></svg>
      </button>
      <button type="button" class="et-btn" :title="isZh ? '导入 Markdown' : 'Import Markdown'" @click="emit('import')">
        <svg viewBox="0 0 24 24"><path :d="icons.upload" /></svg>
      </button>
    </div>

    <!-- AI 下拉（最右） -->
    <button v-if="aiEnabled" ref="aiTrigger" type="button" class="et-ai-trigger" :class="{ active: aiOpen }" :aria-expanded="aiOpen" @click="toggleAiMenu">
      <svg class="ai-bolt" viewBox="0 0 24 24"><path :d="icons.ai" /></svg>
      <span class="ai-label">AI</span>
      <svg class="ai-caret" viewBox="0 0 24 24"><path :d="icons.chevron" /></svg>
    </button>

    <input ref="fileInput" type="file" accept="image/*" hidden @change="onImageSelected" />
  </div>

  <Teleport to="body">
    <!-- 颜色弹层 -->
    <div v-if="popover === 'text' || popover === 'bg'" class="et-popover et-color-pop" :style="{ top: `${popPos.top}px`, left: `${popPos.left}px` }" @click.stop>
      <div class="et-swatches">
        <button v-for="c in (popover === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS)" :key="c" type="button" class="et-swatch" :style="{ background: c }" :title="c" @click="popover === 'text' ? setColor(c) : setHighlight(c)" />
      </div>
      <button type="button" class="et-clear" @click="popover === 'text' ? clearColor() : clearHighlight()">
        {{ isZh ? '清除' : 'Clear' }}
      </button>
    </div>

    <!-- 链接弹层 -->
    <div v-if="popover === 'link'" class="et-popover et-link-pop" :style="{ top: `${popPos.top}px`, left: `${popPos.left}px` }" @click.stop>
      <input v-model="linkUrl" class="et-link-input" placeholder="https://" @keydown.enter.prevent="applyLink" />
      <button type="button" class="et-link-apply" @click="applyLink">{{ isZh ? '确定' : 'Apply' }}</button>
    </div>

    <div v-if="popover" class="et-popover-backdrop" @click="closePopover" />

    <!-- AI 菜单 -->
    <div v-if="aiOpen" class="ai-toolbar-menu" :style="{ top: `${aiPos.top}px`, left: `${aiPos.left}px` }" role="menu">
      <button type="button" role="menuitem" @click="runAction('expand')"><span class="menu-ico"><svg viewBox="0 0 24 24"><path :d="icons.aiContinue" /></svg></span>{{ isZh ? '继续写作' : 'Continue writing' }}</button>
      <button type="button" role="menuitem" @click="runAction('improve')"><span class="menu-ico"><svg viewBox="0 0 24 24"><path :d="icons.aiPolish" /></svg></span>{{ isZh ? '润色文本' : 'Polish text' }}</button>
      <button type="button" role="menuitem" @click="runAction('summarise')"><span class="menu-ico"><svg viewBox="0 0 24 24"><path :d="icons.aiSummary" /></svg></span>{{ isZh ? '总结内容' : 'Summarise' }}</button>
      <button type="button" role="menuitem" @click="showCustom = true; closeAiMenu()"><span class="menu-ico"><svg viewBox="0 0 24 24"><path :d="icons.aiCustom" /></svg></span>{{ isZh ? '自定义 AI' : 'Custom AI' }}</button>
      <div class="menu-line" />
      <button type="button" role="menuitem" class="has-arrow" @click="showLanguages = !showLanguages"><span class="menu-ico"><svg viewBox="0 0 24 24"><path :d="icons.aiTranslate" /></svg></span>{{ isZh ? '翻译' : 'Translate' }}<b>›</b></button>
      <div v-if="showLanguages" class="language-submenu">
        <button v-for="language in SUPPORTED_LANGUAGES" :key="language" type="button" @click="translate(language)">{{ language }}</button>
      </div>
    </div>

    <div v-if="showCustom" class="custom-overlay" @click.self="showCustom = false">
      <section class="custom-dialog" role="dialog" aria-modal="true">
        <h2>{{ isZh ? '自定义 AI 指令' : 'Custom AI instruction' }}</h2>
        <div class="custom-source"><span>{{ isZh ? '选中内容：' : 'Selected text:' }}</span><p>{{ sourceText() || (isZh ? '将在当前位置生成内容' : 'Content will be generated at the cursor') }}</p></div>
        <input v-model="instruction" autofocus :placeholder="isZh ? '请输入 AI 指令，例如：优化这段文字、翻译...' : 'Enter an instruction, e.g. improve this text...'" @keydown.enter.prevent="submitCustom" />
        <footer><button type="button" @click="showCustom = false">{{ isZh ? '取消' : 'Cancel' }}</button><button type="button" :disabled="!instruction.trim()" @click="submitCustom">{{ isZh ? '执行' : 'Run' }}</button></footer>
      </section>
    </div>

    <div v-if="suggestion" class="ai-result" role="dialog">
      <header><strong>{{ processing ? (isZh ? 'AI 正在生成...' : 'AI is writing...') : (isZh ? 'AI 建议' : 'AI suggestion') }}</strong><button type="button" @click="suggestion = null">×</button></header>
      <p>{{ suggestion.content || '...' }}</p>
      <footer><button type="button" @click="suggestion = null">{{ isZh ? '拒绝' : 'Reject' }}</button><button type="button" :disabled="processing" @click="acceptSuggestion">{{ isZh ? '接受替换' : 'Accept' }}</button></footer>
    </div>
  </Teleport>
</template>

<style scoped>
.et-toolbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  align-items: center;
  gap: 3px;
  min-height: 48px;
  padding: 7px var(--space-8);
  margin: calc(-1 * var(--space-8)) calc(-1 * var(--space-8)) 0;
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 1px 4px rgb(0 0 0 / 5%);
  scrollbar-width: thin;
}
.et-toolbar::-webkit-scrollbar { height: 6px; }
.et-toolbar::-webkit-scrollbar-thumb { background: var(--color-border-strong); border-radius: 3px; }
@media (max-width: 767px) {
  .et-toolbar {
    padding: 7px var(--space-4);
    margin: calc(-1 * var(--space-4)) calc(-1 * var(--space-4)) 0;
  }
}
.et-group {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 0 5px;
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
}
.et-group:last-of-type { border-right: none; }
.et-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  color: var(--color-text-primary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 5px;
}
.et-btn:hover { background: var(--color-hover); }
.et-btn.active { color: var(--color-accent); background: var(--color-accent-subtle); }
.et-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.et-select {
  height: 32px;
  padding: 0 6px;
  font: inherit;
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  flex-shrink: 0;
}
.et-select:hover { background: var(--color-hover); }
.et-select:focus { border-color: var(--color-accent); outline: none; }
.et-font { width: 118px; }
.et-size { width: 58px; }
.et-heading { width: 72px; }
.et-color-btn { position: relative; flex-direction: column; gap: 0; }
.et-a { font-size: 15px; font-weight: 700; line-height: 1; }
.et-a-hl { background: #fff3a3; color: #2c2f2c; border-radius: 2px; padding: 0 2px; }
.et-color-bar { width: 18px; height: 3px; margin-top: 2px; border-radius: 2px; }
.et-ai-trigger {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 10px;
  margin-left: auto;
  flex-shrink: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}
.et-ai-trigger:hover { background: var(--color-hover); }
.et-ai-trigger.active { color: var(--color-accent); background: var(--color-accent-subtle); border-color: var(--color-accent); }
.ai-bolt { width: 16px; height: 16px; fill: var(--color-accent); }
.ai-label { line-height: 1; }
.ai-caret { width: 13px; height: 13px; fill: none; stroke: var(--color-text-tertiary); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
@media (max-width: 640px) {
  .et-ai-trigger { margin-left: 0; }
}
</style>

<style>
/* 弹层（Teleport 到 body，非 scoped） */
.et-popover-backdrop { position: fixed; inset: 0; z-index: 1099; }
.et-popover {
  position: fixed;
  z-index: 1100;
  padding: 10px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 14px 28px rgb(0 0 0 / 16%);
}
.et-swatches { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.et-swatch { width: 24px; height: 24px; cursor: pointer; border: 1px solid var(--color-border); border-radius: 5px; }
.et-swatch:hover { transform: scale(1.08); }
.et-clear { width: 100%; margin-top: 8px; padding: 5px; font: inherit; font-size: 13px; color: var(--color-text-secondary); cursor: pointer; background: transparent; border: 1px solid var(--color-border); border-radius: 5px; }
.et-clear:hover { background: var(--color-hover); }
.et-link-pop { display: flex; gap: 6px; width: 280px; }
.et-link-input { flex: 1; height: 34px; padding: 0 10px; font: inherit; color: var(--color-text-primary); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 5px; box-sizing: border-box; }
.et-link-input:focus { border-color: var(--color-accent); outline: none; }
.et-link-apply { padding: 0 14px; font: inherit; color: #fff; cursor: pointer; background: var(--color-accent); border: 0; border-radius: 5px; }

.ai-toolbar-menu { position: fixed; z-index: 1101; width: 208px; padding: 6px; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 8px; box-shadow: 0 14px 28px rgb(0 0 0 / 16%); }
.ai-toolbar-menu > button { display: flex; gap: 10px; align-items: center; width: 100%; height: 34px; padding: 0 9px; font: inherit; font-size: 13.5px; color: var(--color-text-primary); text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 5px; }
.ai-toolbar-menu > button:hover { background: var(--color-hover); }
.ai-toolbar-menu > button > span.menu-ico { display: grid; width: 18px; place-items: center; color: var(--color-text-secondary); }
.ai-toolbar-menu > button > span.menu-ico svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.ai-toolbar-menu .has-arrow b { margin-left: auto; font-size: 18px; font-weight: 400; color: var(--color-text-tertiary); }
.menu-line { height: 1px; margin: 6px 4px; background: var(--color-border); }
.language-submenu { position: absolute; top: 0; right: calc(100% + 6px); left: auto; width: 150px; max-height: 260px; padding: 6px; overflow-y: auto; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 8px; box-shadow: 0 14px 28px rgb(0 0 0 / 16%); }
.language-submenu button { display: block; width: 100%; padding: 7px 8px; font-size: 13.5px; color: var(--color-text-primary); text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 4px; }
.language-submenu button:hover { background: var(--color-hover); }
.custom-overlay { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 20px; background: rgb(0 0 0 / 22%); }
.custom-dialog { width: min(500px, 100%); padding: 22px; background: var(--color-surface-raised); border-radius: 8px; box-shadow: 0 18px 45px rgb(0 0 0 / 24%); }
.custom-dialog h2 { margin: 0 0 18px; font-size: 19px; color: var(--color-accent); }
.custom-source { padding: 12px; margin-bottom: 16px; background: color-mix(in srgb, var(--color-warning) 12%, var(--color-surface)); border: 1px solid color-mix(in srgb, var(--color-warning) 45%, var(--color-border)); border-radius: 5px; }
.custom-source span { font-size: 13px; color: var(--color-text-secondary); }
.custom-source p { margin: 6px 0 0; line-height: 1.45; color: var(--color-text-primary); }
.custom-dialog input { width: 100%; height: 44px; padding: 0 12px; font: inherit; color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: 5px; box-sizing: border-box; }
.custom-dialog footer, .ai-result footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.custom-dialog footer button, .ai-result footer button { padding: 7px 13px; font: inherit; cursor: pointer; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 4px; }
.custom-dialog footer button:last-child, .ai-result footer button:last-child { color: white; background: var(--color-accent); border-color: var(--color-accent); }
.custom-dialog button:disabled, .ai-result button:disabled { opacity: .45; cursor: default; }
.ai-result { position: fixed; right: 20px; bottom: 20px; z-index: 1102; width: min(420px, calc(100vw - 40px)); padding: 15px; background: var(--color-surface-raised); border: 1px solid var(--color-accent); border-radius: 8px; box-shadow: 0 14px 35px rgb(0 0 0 / 20%); }
.ai-result header { display: flex; justify-content: space-between; }
.ai-result header button { font-size: 20px; cursor: pointer; background: none; border: 0; }
.ai-result p { max-height: 220px; overflow: auto; line-height: 1.55; white-space: pre-wrap; }
.cursor-format-painter { cursor: copy !important; }
</style>
