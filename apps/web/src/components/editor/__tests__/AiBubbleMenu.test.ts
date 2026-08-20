import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';

// Mock BubbleMenu to render its default slot directly
vi.mock('@tiptap/vue-3/menus', () => ({
  BubbleMenu: {
    name: 'BubbleMenu',
    props: ['editor', 'tippyOptions'],
    template: '<div class="bubble-menu-mock"><slot /></div>',
  },
}));

// Mock translation service
const { mockTranslateText } = vi.hoisted(() => ({
  mockTranslateText: vi.fn(),
}));

vi.mock('@/services/translation.service', () => ({
  translateText: mockTranslateText,
  SUPPORTED_LANGUAGES: [
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Dutch',
    'Russian',
    'Chinese (Simplified)',
    'Chinese (Traditional)',
    'Japanese',
    'Korean',
    'Arabic',
    'Hindi',
    'Turkish',
    'Polish',
    'Swedish',
    'Danish',
    'Norwegian',
    'Finnish',
    'Czech',
    'Greek',
    'Romanian',
    'Hungarian',
    'Thai',
    'Vietnamese',
    'Indonesian',
    'Malay',
    'Filipino',
    'Ukrainian',
    'Punjabi',
  ] as const,
}));

// Mock writing service
const { mockWriteText } = vi.hoisted(() => ({
  mockWriteText: vi.fn(),
}));

vi.mock('@/services/writing.service', () => ({
  writeText: mockWriteText,
  streamWriteText: vi.fn(async (orgId: string, action: string, text: string, callbacks: { onToken: (content: string) => void }) => {
    const result = await mockWriteText(orgId, action, text);
    callbacks.onToken(result.content);
  }),
  WRITING_ACTIONS: ['generate', 'expand', 'summarise', 'improve'] as const,
}));

// Mock toast composable
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

import AiBubbleMenu from '../AiBubbleMenu.vue';

function createMockEditor(selectedText = 'Hello') {
  return {
    state: {
      selection: {
        from: 0,
        to: selectedText.length,
        empty: selectedText.length === 0,
      },
      doc: {
        textBetween: vi.fn().mockReturnValue(selectedText),
      },
    },
    chain: vi.fn().mockReturnValue({
      focus: vi.fn().mockReturnValue({
        insertContentAt: vi.fn().mockReturnValue({
          run: vi.fn(),
        }),
      }),
    }),
  };
}

function setupAuthStore(aiEnabled = true, orgId = 'org-123') {
  const store = useAuthStore();
  store.currentOrganizationId = orgId;
  store.organizations = [
    {
      id: orgId,
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

function mountComponent(
  overrides: {
    editor?: ReturnType<typeof createMockEditor>;
    aiEnabled?: boolean;
    orgId?: string;
  } = {}
) {
  setupAuthStore(overrides.aiEnabled ?? true, overrides.orgId ?? 'org-123');

  return mount(AiBubbleMenu, {
    props: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor: (overrides.editor ?? createMockEditor()) as any,
    },
  });
}

describe('AiBubbleMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  // ===========================================
  // Rendering
  // ===========================================

  it('renders AI trigger button when aiEnabled is true', () => {
    const wrapper = mountComponent();

    expect(wrapper.find('.ai-trigger').exists()).toBe(true);

    wrapper.unmount();
  });

  it('hides when aiEnabled is false', () => {
    const wrapper = mountComponent({ aiEnabled: false });

    expect(wrapper.find('.ai-trigger').exists()).toBe(false);

    wrapper.unmount();
  });

  it('shows main menu with Write and Translate sections when trigger clicked', async () => {
    const wrapper = mountComponent();

    await wrapper.find('.ai-trigger').trigger('click');

    expect(wrapper.find('.ai-menu').exists()).toBe(true);
    expect(wrapper.text()).toContain('Generate');
    expect(wrapper.text()).toContain('Expand');
    expect(wrapper.text()).toContain('Summarise');
    expect(wrapper.text()).toContain('Improve');
    expect(wrapper.text()).toContain('Translate');

    wrapper.unmount();
  });

  it('toggles menu closed when trigger clicked again', async () => {
    const wrapper = mountComponent();

    await wrapper.find('.ai-trigger').trigger('click');
    expect(wrapper.find('.ai-menu').exists()).toBe(true);

    await wrapper.find('.ai-trigger').trigger('click');
    expect(wrapper.find('.ai-menu').exists()).toBe(false);

    wrapper.unmount();
  });

  it('closes menu on Escape', async () => {
    const wrapper = mountComponent();

    await wrapper.find('.ai-trigger').trigger('click');
    expect(wrapper.find('.ai-menu').exists()).toBe(true);

    await wrapper.find('.ai-menu').trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('.ai-menu').exists()).toBe(false);

    wrapper.unmount();
  });

  // ===========================================
  // Translation sub-flow
  // ===========================================

  it('shows language submenu when "Translate to..." clicked', async () => {
    const wrapper = mountComponent();

    await wrapper.find('.ai-trigger').trigger('click');

    const translateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Translate'));
    await translateBtn!.trigger('click');

    expect(wrapper.find('.ai-languages').exists()).toBe(true);

    wrapper.unmount();
  });

  it('shows back button in language submenu', async () => {
    const wrapper = mountComponent();

    await wrapper.find('.ai-trigger').trigger('click');

    const translateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Translate'));
    await translateBtn!.trigger('click');

    expect(wrapper.find('.ai-back-btn').exists()).toBe(true);

    wrapper.unmount();
  });

  it('calls translateText with selected text and chosen language', async () => {
    const editor = createMockEditor('Hello, world!');
    mockTranslateText.mockResolvedValue({ translatedText: 'Hola, mundo!' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');

    const translateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Translate'));
    await translateBtn!.trigger('click');

    const spanishBtn = wrapper.findAll('.language-item').find((btn) => btn.text() === 'Spanish');
    await spanishBtn!.trigger('click');
    await flushPromises();

    expect(mockTranslateText).toHaveBeenCalledWith('org-123', 'Hello, world!', 'Spanish');

    wrapper.unmount();
  });

  it('shows a translation suggestion without changing the selection', async () => {
    const editor = createMockEditor('Hello, world!');
    mockTranslateText.mockResolvedValue({ translatedText: 'Hola, mundo!' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const translateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Translate'));
    await translateBtn!.trigger('click');
    const spanishBtn = wrapper.findAll('.language-item').find((btn) => btn.text() === 'Spanish');
    await spanishBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Translation to Spanish');
    expect(wrapper.text()).toContain('Hola, mundo!');
    expect(editor.chain).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('shows "Translating..." loading state', async () => {
    const editor = createMockEditor('Hello');
    let resolveTranslation!: (value: { translatedText: string }) => void;
    mockTranslateText.mockReturnValue(
      new Promise((resolve) => {
        resolveTranslation = resolve;
      })
    );

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const translateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Translate'));
    await translateBtn!.trigger('click');
    const spanishBtn = wrapper.findAll('.language-item').find((btn) => btn.text() === 'Spanish');
    await spanishBtn!.trigger('click');

    expect(wrapper.find('.ai-loading').exists()).toBe(true);
    expect(wrapper.text()).toContain('Translating...');

    resolveTranslation({ translatedText: 'Hola' });
    await flushPromises();

    expect(wrapper.find('.ai-loading').exists()).toBe(false);

    wrapper.unmount();
  });

  it('does not show a success toast until a translation suggestion is accepted', async () => {
    const editor = createMockEditor('Hello');
    mockTranslateText.mockResolvedValue({ translatedText: 'Hola' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const translateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Translate'));
    await translateBtn!.trigger('click');
    const spanishBtn = wrapper.findAll('.language-item').find((btn) => btn.text() === 'Spanish');
    await spanishBtn!.trigger('click');
    await flushPromises();

    expect(mockToastSuccess).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('shows error toast on translation failure', async () => {
    const editor = createMockEditor('Hello');
    mockTranslateText.mockRejectedValue(new Error('TRANSLATION_FAILED'));

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const translateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Translate'));
    await translateBtn!.trigger('click');
    const spanishBtn = wrapper.findAll('.language-item').find((btn) => btn.text() === 'Spanish');
    await spanishBtn!.trigger('click');
    await flushPromises();

    expect(mockToastError).toHaveBeenCalledWith('Translation failed. Please try again.');

    wrapper.unmount();
  });

  it('closes menus after successful translation', async () => {
    const editor = createMockEditor('Hello');
    mockTranslateText.mockResolvedValue({ translatedText: 'Hola' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const translateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Translate'));
    await translateBtn!.trigger('click');
    const spanishBtn = wrapper.findAll('.language-item').find((btn) => btn.text() === 'Spanish');
    await spanishBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.find('.ai-menu').exists()).toBe(false);
    expect(wrapper.find('.ai-languages').exists()).toBe(false);

    wrapper.unmount();
  });

  it('displays all 31 languages', async () => {
    const wrapper = mountComponent();

    await wrapper.find('.ai-trigger').trigger('click');
    const translateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Translate'));
    await translateBtn!.trigger('click');

    const languageItems = wrapper.findAll('.language-item');
    expect(languageItems.length).toBe(31);

    wrapper.unmount();
  });

  // ===========================================
  // Writing sub-flow (expand/summarise/improve)
  // ===========================================

  it('calls writeText with correct action and selected text for expand', async () => {
    const editor = createMockEditor('Short text');
    mockWriteText.mockResolvedValue({ content: 'Expanded text with more detail' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const expandBtn = wrapper.findAll('.ai-menu-item').find((btn) => btn.text().includes('Expand'));
    await expandBtn!.trigger('click');
    await flushPromises();

    expect(mockWriteText).toHaveBeenCalledWith('org-123', 'expand', 'Short text');

    wrapper.unmount();
  });

  it('calls writeText with correct action for summarise', async () => {
    const editor = createMockEditor('Long text here');
    mockWriteText.mockResolvedValue({ content: 'Summary' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const summariseBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Summarise'));
    await summariseBtn!.trigger('click');
    await flushPromises();

    expect(mockWriteText).toHaveBeenCalledWith('org-123', 'summarise', 'Long text here');

    wrapper.unmount();
  });

  it('calls writeText with correct action for improve', async () => {
    const editor = createMockEditor('Bad grammer text');
    mockWriteText.mockResolvedValue({ content: 'Bad grammar text' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const improveBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Improve'));
    await improveBtn!.trigger('click');
    await flushPromises();

    expect(mockWriteText).toHaveBeenCalledWith('org-123', 'improve', 'Bad grammer text');

    wrapper.unmount();
  });

  it('shows AI content as a suggestion without replacing the selection', async () => {
    const editor = createMockEditor('Short text');
    mockWriteText.mockResolvedValue({ content: 'Expanded content' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const expandBtn = wrapper.findAll('.ai-menu-item').find((btn) => btn.text().includes('Expand'));
    await expandBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Text expanded suggestion');
    expect(wrapper.text()).toContain('Expanded content');
    expect(editor.chain).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('shows action-specific loading state for Expand', async () => {
    const editor = createMockEditor('Short text');
    let resolveWrite!: (value: { content: string }) => void;
    mockWriteText.mockReturnValue(
      new Promise((resolve) => {
        resolveWrite = resolve;
      })
    );

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const expandBtn = wrapper.findAll('.ai-menu-item').find((btn) => btn.text().includes('Expand'));
    await expandBtn!.trigger('click');

    expect(wrapper.find('.ai-loading').exists()).toBe(true);
    expect(wrapper.text()).toContain('Expanding...');

    resolveWrite({ content: 'Expanded' });
    await flushPromises();

    wrapper.unmount();
  });

  it('shows action-specific loading state for Summarise', async () => {
    const editor = createMockEditor('Long text');
    let resolveWrite!: (value: { content: string }) => void;
    mockWriteText.mockReturnValue(
      new Promise((resolve) => {
        resolveWrite = resolve;
      })
    );

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const summariseBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Summarise'));
    await summariseBtn!.trigger('click');

    expect(wrapper.text()).toContain('Summarising...');

    resolveWrite({ content: 'Summary' });
    await flushPromises();

    wrapper.unmount();
  });

  it('shows action-specific loading state for Improve', async () => {
    const editor = createMockEditor('Bad text');
    let resolveWrite!: (value: { content: string }) => void;
    mockWriteText.mockReturnValue(
      new Promise((resolve) => {
        resolveWrite = resolve;
      })
    );

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const improveBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Improve'));
    await improveBtn!.trigger('click');

    expect(wrapper.text()).toContain('Improving...');

    resolveWrite({ content: 'Better text' });
    await flushPromises();

    wrapper.unmount();
  });

  it('shows a success toast after accepting an AI suggestion', async () => {
    const editor = createMockEditor('Short text');
    mockWriteText.mockResolvedValue({ content: 'Expanded text' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const expandBtn = wrapper.findAll('.ai-menu-item').find((btn) => btn.text().includes('Expand'));
    await expandBtn!.trigger('click');
    await flushPromises();

    await wrapper.find('.ai-suggestion-btn--accept').trigger('click');

    expect(editor.chain).toHaveBeenCalled();
    const chainResult = editor.chain();
    const focusResult = chainResult.focus();
    expect(focusResult.insertContentAt).toHaveBeenCalledWith(
      { from: 0, to: 10 },
      'Expanded text'
    );
    expect(mockToastSuccess).toHaveBeenCalledWith('AI suggestion accepted');
    expect(wrapper.find('.ai-suggestion').exists()).toBe(false);

    wrapper.unmount();
  });

  it('shows a summary suggestion', async () => {
    const editor = createMockEditor('Long text');
    mockWriteText.mockResolvedValue({ content: 'Summary' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const summariseBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Summarise'));
    await summariseBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Text summarised suggestion');

    wrapper.unmount();
  });

  it('shows an improvement suggestion', async () => {
    const editor = createMockEditor('Bad text');
    mockWriteText.mockResolvedValue({ content: 'Better text' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const improveBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Improve'));
    await improveBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Text improved suggestion');

    wrapper.unmount();
  });

  it('shows error toast on writing failure', async () => {
    const editor = createMockEditor('Short text');
    mockWriteText.mockRejectedValue(new Error('WRITING_FAILED'));

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const expandBtn = wrapper.findAll('.ai-menu-item').find((btn) => btn.text().includes('Expand'));
    await expandBtn!.trigger('click');
    await flushPromises();

    expect(mockToastError).toHaveBeenCalledWith('Writing failed. Please try again.');

    wrapper.unmount();
  });

  it('closes menu after successful writing action', async () => {
    const editor = createMockEditor('Short text');
    mockWriteText.mockResolvedValue({ content: 'Expanded text' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    expect(wrapper.find('.ai-menu').exists()).toBe(true);

    const expandBtn = wrapper.findAll('.ai-menu-item').find((btn) => btn.text().includes('Expand'));
    await expandBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.find('.ai-menu').exists()).toBe(false);

    wrapper.unmount();
  });

  // ===========================================
  // Generate sub-flow
  // ===========================================

  it('shows prompt input when Generate clicked', async () => {
    const wrapper = mountComponent();

    await wrapper.find('.ai-trigger').trigger('click');
    const generateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Generate'));
    await generateBtn!.trigger('click');

    expect(wrapper.find('.ai-generate').exists()).toBe(true);
    expect(wrapper.find('.ai-generate-input').exists()).toBe(true);

    wrapper.unmount();
  });

  it('shows back button in generate view', async () => {
    const wrapper = mountComponent();

    await wrapper.find('.ai-trigger').trigger('click');
    const generateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Generate'));
    await generateBtn!.trigger('click');

    expect(wrapper.find('.ai-back-btn').exists()).toBe(true);

    wrapper.unmount();
  });

  it('calls writeText with "generate" action and prompt text', async () => {
    const editor = createMockEditor('');
    mockWriteText.mockResolvedValue({ content: 'Generated content about cats' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const generateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Generate'));
    await generateBtn!.trigger('click');

    const input = wrapper.find('.ai-generate-input');
    await input.setValue('Write about cats');

    const submitBtn = wrapper.find('.ai-generate-btn');
    await submitBtn.trigger('click');
    await flushPromises();

    expect(mockWriteText).toHaveBeenCalledWith('org-123', 'generate', 'Write about cats');

    wrapper.unmount();
  });

  it('shows generated content as a suggestion at the cursor position', async () => {
    const editor = createMockEditor('');
    mockWriteText.mockResolvedValue({ content: 'Generated content' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const generateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Generate'));
    await generateBtn!.trigger('click');

    const input = wrapper.find('.ai-generate-input');
    await input.setValue('Write something');

    const submitBtn = wrapper.find('.ai-generate-btn');
    await submitBtn.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Generated suggestion');
    expect(wrapper.text()).toContain('Generated content');
    expect(editor.chain).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('shows "Generating..." loading state', async () => {
    const editor = createMockEditor('');
    let resolveWrite!: (value: { content: string }) => void;
    mockWriteText.mockReturnValue(
      new Promise((resolve) => {
        resolveWrite = resolve;
      })
    );

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const generateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Generate'));
    await generateBtn!.trigger('click');

    const input = wrapper.find('.ai-generate-input');
    await input.setValue('Write something');

    const submitBtn = wrapper.find('.ai-generate-btn');
    await submitBtn.trigger('click');

    expect(wrapper.find('.ai-loading').exists()).toBe(true);
    expect(wrapper.text()).toContain('Generating...');

    resolveWrite({ content: 'Content' });
    await flushPromises();

    wrapper.unmount();
  });

  it('allows a generated suggestion to be rejected', async () => {
    const editor = createMockEditor('');
    mockWriteText.mockResolvedValue({ content: 'Generated content' });

    const wrapper = mountComponent({ editor });

    await wrapper.find('.ai-trigger').trigger('click');
    const generateBtn = wrapper
      .findAll('.ai-menu-item')
      .find((btn) => btn.text().includes('Generate'));
    await generateBtn!.trigger('click');

    const input = wrapper.find('.ai-generate-input');
    await input.setValue('Write something');

    const submitBtn = wrapper.find('.ai-generate-btn');
    await submitBtn.trigger('click');
    await flushPromises();

    expect(wrapper.find('.ai-suggestion').exists()).toBe(true);
    const rejectButton = wrapper
      .findAll('.ai-suggestion-btn')
      .find((button) => button.text() === 'Reject');
    await rejectButton!.trigger('click');

    expect(wrapper.find('.ai-suggestion').exists()).toBe(false);
    expect(editor.chain).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
