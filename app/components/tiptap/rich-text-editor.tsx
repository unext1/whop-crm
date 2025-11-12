import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import { EditorContent, type Extension, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import { TipTapFloatingMenu } from '~/components/tiptap/extensions/floating-menu';
import { FloatingToolbar } from '~/components/tiptap/extensions/floating-toolbar';
import { cn } from '~/utils';
import './tiptap.css';
import { EditorToolbar } from './toolbars/editor-toolbar';

const createExtensions = (placeholderText: string) => [
  StarterKit.configure({
    orderedList: {
      HTMLAttributes: {
        class: 'list-decimal',
      },
    },
    bulletList: {
      HTMLAttributes: {
        class: 'list-disc',
      },
    },
    heading: {
      levels: [1, 2, 3, 4],
    },
  }),
  Placeholder.configure({
    emptyNodeClass: 'is-editor-empty',
    placeholder: ({ node }) => {
      switch (node.type.name) {
        case 'heading':
          return `Heading ${node.attrs.level}`;
        case 'detailsSummary':
          return 'Section title';
        case 'codeBlock':
          // never show the placeholder when editing code
          return '';
        default:
          return placeholderText;
      }
    },
    includeChildren: false,
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  TextStyle,
  Subscript,
  Superscript,
  Underline,
  Link,
  Highlight.configure({
    multicolor: true,
  }),
  Typography,
];

interface RichTextEditorProps {
  className?: string;
  value?: string; // HTML content
  onChange?: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function RichTextEditor({
  className,
  value = '',
  onChange,
  placeholder = "Write, type '/' for commands",
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createExtensions(placeholder) as Extension[],
    content: value || '',
    editable,
    editorProps: {
      attributes: {
        class: 'max-w-full focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
    },
  });

  // Update editor content when value prop changes (but not from user edits)
  useEffect(() => {
    if (editor && value !== undefined) {
      const currentHtml = editor.getHTML();
      // Only update if the value is different to avoid infinite loops
      if (currentHtml !== value) {
        editor.commands.setContent(value || '', { emitUpdate: false });
      }
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        'relative w-full max-w-full overflow-x-hidden overflow-y-scroll scrollbar-thin border bg-card text-foreground',
        editable && 'pb-[60px] sm:pb-0',
        className,
      )}
    >
      {editable && <EditorToolbar editor={editor} />}
      {editable && <FloatingToolbar editor={editor} />}
      {editable && <TipTapFloatingMenu editor={editor} />}
      <EditorContent editor={editor} className="w-full max-w-full cursor-text scrollbar-thin text-foreground sm:p-6" />
    </div>
  );
}

// Keep the demo component for backward compatibility
export function RichTextEditorDemo({ className }: { className?: string }) {
  return <RichTextEditor className={cn('flex-1 h-full', className)} />;
}
