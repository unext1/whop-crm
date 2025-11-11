import type { Editor } from '@tiptap/core';
import { Separator } from '~/components/ui/separator';
import { TooltipProvider } from '~/components/ui/tooltip';
import { AlignmentTooolbar } from './alignment';
import { BlockquoteToolbar } from './blockquote';
import { BoldToolbar } from './bold';
import { BulletListToolbar } from './bullet-list';
import { CodeToolbar } from './code';
import { HeadingsToolbar } from './headings';
import { HorizontalRuleToolbar } from './horizontal-rule';
import { ItalicToolbar } from './italic';
import { LinkToolbar } from './link';
import { OrderedListToolbar } from './ordered-list';
import { RedoToolbar } from './redo';
import { StrikeThroughToolbar } from './strikethrough';
import { ToolbarProvider } from './toolbar-provider';
import { UnderlineToolbar } from './underline';
import { UndoToolbar } from './undo';

import { CodeBlockToolbar } from './code-block';

export const EditorToolbar = ({ editor }: { editor: Editor }) => {
  return (
    <div className="sticky top-0 z-20 w-full max-w-full border-b bg-background block overflow-x-auto">
      <ToolbarProvider editor={editor}>
        <TooltipProvider>
          <div className="flex items-center gap-1 px-2 min-w-max h-fit py-0.5">
            {/* History Group */}
            <UndoToolbar />
            <RedoToolbar />
            <Separator orientation="vertical" className="mx-1 h-7" />

            {/* Text Structure Group */}
            <HeadingsToolbar />
            <BlockquoteToolbar />
            <CodeToolbar />
            <CodeBlockToolbar />
            <Separator orientation="vertical" className="mx-1 h-7" />

            {/* Basic Formatting Group */}
            <BoldToolbar />
            <ItalicToolbar />
            <UnderlineToolbar />
            <StrikeThroughToolbar />
            <LinkToolbar />
            <Separator orientation="vertical" className="mx-1 h-7" />

            {/* Lists & Structure Group */}
            <BulletListToolbar />
            <OrderedListToolbar />
            <HorizontalRuleToolbar />
            <Separator orientation="vertical" className="mx-1 h-7" />

            {/* Alignment Group */}
            <AlignmentTooolbar />
            <Separator orientation="vertical" className="mx-1 h-7" />
          </div>
        </TooltipProvider>
      </ToolbarProvider>
    </div>
  );
};
