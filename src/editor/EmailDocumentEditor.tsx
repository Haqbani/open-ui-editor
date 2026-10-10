"use client";
import type { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { ButtonBubble } from "./blocks/ButtonBubble";
import { CoreDragHandle } from "./blocks/CoreDragHandle";
import { ImageBubble } from "./blocks/ImageBubble";
import { SocialBubble } from "./blocks/SocialBubble";
import { MediaStatus } from "./services/MediaStatus";
import { SlashPalette } from "./shell/SlashPalette";
import { TextBubble } from "./shell/TextBubble";

/** Render only: the controller's useEditor owns this instance and its lifetime. */
export function EmailDocumentEditor({
  editor,
  focusMode = false,
}: {
  editor: Editor | null;
  focusMode?: boolean;
}) {
  return (
    <div data-testid="email-editor">
      <EditorContent editor={editor} />
      {editor && (
        <>
          {!focusMode && <CoreDragHandle editor={editor} />}
          <ImageBubble editor={editor} />
          <ButtonBubble editor={editor} />
          <SocialBubble editor={editor} />
          <TextBubble editor={editor} focusMode={focusMode} />
          <SlashPalette editor={editor} />
          <MediaStatus editor={editor} />
        </>
      )}
    </div>
  );
}
