/**
 * FormatPainter Extension - 格式刷
 * @description 采样当前选区样式并应用到目标选区。移植自 Tiptap UI Kit，
 * 适配 LibreDiary：移除对协作人数存储的依赖，保留单次/连续模式与本地缓存。
 */
import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formatPainter: {
      /** 开启格式刷并采样当前选区样式。mode: 1 单次（默认），2 连续 */
      startFormatPainting: (mode?: 1 | 2) => ReturnType;
      /** 将采样到的样式应用到当前选区 */
      applyFormat: () => ReturnType;
      /** 取消格式刷状态并清除缓存 */
      cancelFormatPainting: () => ReturnType;
    };
  }
}

export interface FormatPainterStorage {
  isActive: boolean;
  isContinuous: boolean;
  formats: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    subscript?: boolean;
    superscript?: boolean;
    color?: string | null;
    highlight?: string | null;
    fontFamily?: string | null;
    fontSize?: string | null;
    textAlign?: 'left' | 'center' | 'right' | 'justify' | null;
  };
}

type FormatPainterFormats = FormatPainterStorage['formats'];

const STORAGE_KEY = 'librediary-format-painter';

function sampleFormats(editor: Editor): FormatPainterFormats | null {
  try {
    const textStyle = editor.getAttributes('textStyle') as {
      color?: string;
      fontFamily?: string;
      fontSize?: string;
    };
    const highlight = editor.getAttributes('highlight') as { color?: string };
    const paragraph = editor.getAttributes('paragraph') as {
      textAlign?: 'left' | 'center' | 'right' | 'justify';
    };
    const heading = editor.getAttributes('heading') as {
      textAlign?: 'left' | 'center' | 'right' | 'justify';
    };
    return {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      subscript: editor.isActive('subscript'),
      superscript: editor.isActive('superscript'),
      color: textStyle?.color ?? null,
      fontFamily: textStyle?.fontFamily ?? null,
      fontSize: textStyle?.fontSize ?? null,
      highlight: highlight?.color ?? null,
      textAlign: paragraph?.textAlign ?? heading?.textAlign ?? null,
    };
  } catch {
    return null;
  }
}

function saveFormats(formats: FormatPainterFormats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formats));
  } catch {
    /* ignore */
  }
}

function loadFormats(): FormatPainterFormats | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? (JSON.parse(data) as FormatPainterFormats) : null;
  } catch {
    return null;
  }
}

function clearStoredFormats(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function updateCursorStyle(editor: Editor, add: boolean): void {
  try {
    const dom = editor.view.dom as HTMLElement;
    dom.classList.toggle('cursor-format-painter', add);
  } catch {
    /* ignore */
  }
}

export const FormatPainter = Extension.create<Record<string, never>, FormatPainterStorage>({
  name: 'formatPainter',

  addStorage() {
    return {
      isActive: false,
      isContinuous: false,
      formats: loadFormats() || {},
    } as FormatPainterStorage;
  },

  addCommands() {
    return {
      startFormatPainting:
        (mode?: 1 | 2) =>
        ({ editor }) => {
          const sel = editor.state.selection;
          if (!sel || sel.empty) return false;
          const formats = sampleFormats(editor);
          if (!formats) return false;
          this.storage.formats = formats;
          this.storage.isActive = true;
          this.storage.isContinuous = mode === 2;
          saveFormats(formats);
          updateCursorStyle(editor, true);
          return true;
        },

      applyFormat:
        () =>
        ({ editor }) => {
          if (!this.storage.isActive) return false;
          const sel = editor.state.selection;
          if (!sel || sel.empty) return false;

          let formats = this.storage.formats;
          if (!formats || Object.keys(formats).length === 0) {
            const saved = loadFormats();
            if (saved) {
              this.storage.formats = saved;
              formats = saved;
            }
          }
          if (!formats || Object.keys(formats).length === 0) return false;

          const { from, to } = editor.state.selection;
          try {
            const chain = editor.chain().focus();

            formats.bold ? chain.setMark('bold') : chain.unsetMark('bold');
            formats.italic ? chain.setMark('italic') : chain.unsetMark('italic');
            formats.underline ? chain.setMark('underline') : chain.unsetMark('underline');
            formats.strike ? chain.setMark('strike') : chain.unsetMark('strike');

            chain.unsetMark('subscript').unsetMark('superscript');
            if (formats.subscript) chain.setMark('subscript');
            else if (formats.superscript) chain.setMark('superscript');

            const textStyleAttrs: Record<string, string> = {};
            if (formats.color) textStyleAttrs.color = formats.color;
            if (formats.fontFamily) textStyleAttrs.fontFamily = formats.fontFamily;
            if (formats.fontSize) textStyleAttrs.fontSize = formats.fontSize;
            if (Object.keys(textStyleAttrs).length > 0) {
              chain.setMark('textStyle', textStyleAttrs);
            } else {
              chain.unsetMark('textStyle');
            }

            if (formats.highlight) {
              (chain as unknown as { setHighlight: (a: { color: string }) => void }).setHighlight({
                color: formats.highlight,
              });
            } else {
              (chain as unknown as { unsetHighlight?: () => void }).unsetHighlight?.();
            }

            chain.run();

            if (formats.textAlign) {
              editor.chain().focus().setTextSelection({ from, to }).setTextAlign(formats.textAlign).run();
            }
          } catch {
            return false;
          }

          if (!this.storage.isContinuous) {
            this.storage.isActive = false;
            updateCursorStyle(editor, false);
          }
          return true;
        },

      cancelFormatPainting:
        () =>
        ({ editor }) => {
          this.storage.isActive = false;
          this.storage.isContinuous = false;
          this.storage.formats = {};
          clearStoredFormats();
          updateCursorStyle(editor, false);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const ext = this;
    return [
      new Plugin({
        props: {
          handleKeyDown(_view, event: KeyboardEvent) {
            const storage = ext.storage as FormatPainterStorage;
            if (storage.isActive && event.key === 'Escape') {
              ext.editor?.commands.cancelFormatPainting();
              return true;
            }
            return false;
          },
          handleDOMEvents: {
            mouseup: () => {
              const storage = ext.storage as FormatPainterStorage;
              if (storage.isActive && ext.editor) {
                requestAnimationFrame(() => {
                  if (!storage.isActive || !ext.editor) return;
                  try {
                    if (!ext.editor.state.selection.empty) {
                      ext.editor.commands.applyFormat();
                    }
                  } catch {
                    /* ignore */
                  }
                });
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});
