import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { Editor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useAuthStore } from '@/stores/auth';
import { i18n } from '@/i18n';
import { FormatPainter } from '../extensions/FormatPainter';

vi.mock('@/services/writing.service', () => ({
  streamWriteText: vi.fn(),
}));
vi.mock('@/services/translation.service', () => ({
  translateText: vi.fn(),
  SUPPORTED_LANGUAGES: ['English', 'Chinese (Simplified)'] as const,
}));
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import EditorToolbar from '../EditorToolbar.vue';

function createRealEditor(content = '<p>Hello world</p>') {
  return new Editor({
    content,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      FormatPainter,
    ],
  });
}

function setupAuthStore(aiEnabled = true) {
  const store = useAuthStore();
  store.currentOrganizationId = 'org-123';
  store.organizations = [
    {
      id: 'org-123',
      name: 'Test Org',
      slug: 'test-org',
      aiEnabled,
      isEncrypted: false,
      allowedDomains: [],
      logoUrl: null,
      accentColor: null,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  ];
}

describe('EditorToolbar (real editor)', () => {
  let editor: Editor;

  beforeEach(() => {
    setActivePinia(createPinia());
    // Titles switch on locale; pin to zh-CN so selectors are deterministic.
    (i18n.global.locale as unknown as { value: string }).value = 'zh-CN';
    setupAuthStore(true);
    editor = createRealEditor();
    // Select all text so mark commands apply
    editor.commands.selectAll();
  });

  afterEach(() => {
    editor.destroy();
    (i18n.global.locale as unknown as { value: string }).value = 'en-GB';
  });

  function mountToolbar() {
    return mount(EditorToolbar, {
      props: { editor: editor as unknown as never },
    });
  }

  it('renders the toolbar with grouped controls and the AI trigger', () => {
    const wrapper = mountToolbar();
    expect(wrapper.find('.et-toolbar').exists()).toBe(true);
    expect(wrapper.findAll('.et-group').length).toBeGreaterThanOrEqual(8);
    expect(wrapper.find('.et-ai-trigger').exists()).toBe(true);
    wrapper.unmount();
  });

  it('toggles bold on the real editor when the bold button is clicked', async () => {
    const wrapper = mountToolbar();
    const boldBtn = wrapper.find('button[title="加粗"]');
    expect(boldBtn.exists()).toBe(true);
    await boldBtn.trigger('click');
    expect(editor.isActive('bold')).toBe(true);
    wrapper.unmount();
  });

  it('toggles underline — proving StarterKit underline is wired', async () => {
    const wrapper = mountToolbar();
    await wrapper.find('button[title="下划线"]').trigger('click');
    expect(editor.isActive('underline')).toBe(true);
    wrapper.unmount();
  });

  it('applies a text color via the Color extension', async () => {
    const wrapper = mountToolbar();
    // open text-color popover (Teleported to body)
    await wrapper.find('.et-color-btn').trigger('click');
    const swatch = document.body.querySelector('.et-color-pop .et-swatch') as HTMLElement | null;
    expect(swatch).not.toBeNull();
    swatch!.click();
    await Promise.resolve();
    expect(editor.getAttributes('textStyle').color).toBeTruthy();
    wrapper.unmount();
  });

  it('sets a heading level through the paragraph-style select', async () => {
    const wrapper = mountToolbar();
    const select = wrapper.find('select.et-heading');
    (select.element as HTMLSelectElement).value = '1';
    await select.trigger('change');
    expect(editor.getHTML()).toContain('<h1');
    wrapper.unmount();
  });

  it('applies center alignment', async () => {
    const wrapper = mountToolbar();
    await wrapper.find('button[title="居中"]').trigger('click');
    expect(editor.isActive({ textAlign: 'center' })).toBe(true);
    wrapper.unmount();
  });

  it('inserts a table', async () => {
    const wrapper = mountToolbar();
    await wrapper.find('button[title="表格"]').trigger('click');
    expect(editor.isActive('table')).toBe(true);
    wrapper.unmount();
  });

  it('sets a font family through the font select', async () => {
    const wrapper = mountToolbar();
    await wrapper.find('select.et-font').setValue('Georgia');
    expect(editor.getAttributes('textStyle').fontFamily).toBe('Georgia');
    wrapper.unmount();
  });

  it('exposes the format painter command without throwing', async () => {
    const wrapper = mountToolbar();
    // has a selection, so sampling should succeed and activate
    await wrapper.find('button[title="格式刷"]').trigger('click');
    expect(editor.storage.formatPainter.isActive).toBe(true);
    wrapper.unmount();
  });

  it('hides the AI trigger when AI is disabled for the org', () => {
    setActivePinia(createPinia());
    setupAuthStore(false);
    const wrapper = mountToolbar();
    expect(wrapper.find('.et-ai-trigger').exists()).toBe(false);
    wrapper.unmount();
  });
});
