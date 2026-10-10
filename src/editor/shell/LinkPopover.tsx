import { EditorFocusScope } from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { type RefObject, useEffect, useRef, useState } from "react";
import { normalizeButtonLink } from "../blocks/basic-family";
import {
  type BlockTarget,
  getEditorSessionRevision,
  resolveBlock,
  resolveBlockTarget,
} from "../blocks/commands";
import { closeEditorHistory } from "../history/history-boundary";
import { Icon } from "./icons";
import { ToolbarTooltip } from "./ToolbarTooltip";
export function ApplicationCheck({ size }: { size: number }) {
  return (
    <svg
      className="application-check"
      aria-hidden="true"
      fill="none"
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        d="M20 7 9.36 17.63a.5.5 0 0 1-.723-.019L4 12.5"
      />
    </svg>
  );
}
export type LinkSession = {
  from: number;
  to: number;
  revision: number;
  target: BlockTarget | null;
  element: "link" | "button" | "image";
  href: string;
};
export function captureLinkSession(
  editor: Editor,
  element: LinkSession["element"] = "link",
): LinkSession {
  const { from, to } = editor.state.selection;
  return {
    from,
    to,
    revision: getEditorSessionRevision(editor),
    element,
    target: element === "link" ? null : resolveBlockTarget(editor),
    href: String(editor.getAttributes(element).href ?? ""),
  };
}
export function applyLinkSession(
  editor: Editor,
  session: LinkSession,
  input: string,
) {
  if (
    editor.isDestroyed ||
    getEditorSessionRevision(editor) !== session.revision
  )
    return false;
  const href = normalizeButtonLink(input.trim()) ?? "";
  const chain = editor.chain().command(({ tr }) => {
    closeEditorHistory(tr);
    return true;
  });
  if (session.element !== "link") {
    if (!session.target || !resolveBlock(editor, session.target)) return false;
    if (session.element === "image") chain.setNodeSelection(session.target.pos);
    else chain.setTextSelection({ from: session.from, to: session.to });
    chain.updateAttributes(session.element, { href }).run();
  } else if (!href)
    chain
      .setTextSelection({ from: session.from, to: session.to })
      .unsetLink()
      .run();
  else if (session.from === session.to)
    chain
      .setTextSelection({ from: session.from, to: session.to })
      .extendMarkRange("link")
      .setLink({ href })
      .setTextSelection({ from: session.from, to: session.to })
      .run();
  else
    chain
      .setTextSelection({ from: session.from, to: session.to })
      .setLink({ href })
      .run();
  return true;
}
export function LinkPopover({
  editor,
  session,
  onClose,
  boundary,
}: {
  editor: Editor;
  session: LinkSession;
  onClose: () => void;
  boundary?: RefObject<HTMLElement | null>;
}) {
  const initial = session.href === "#" ? "" : session.href;
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null),
    form = useRef<HTMLFormElement>(null);
  const submit = useRef<(value?: string) => void>(() => {});
  submit.current = (next = value) => {
    const trimmed = next.trim(),
      valid = normalizeButtonLink(trimmed);
    const applied = applyLinkSession(editor, session, trimmed);
    onClose();
    if (applied) {
      editor.view.focus();
      if (valid === null)
        editor.view.dom.dispatchEvent(
          new CustomEvent("media-error", {
            detail:
              "Enter a valid value. Links must be either a valid URL or a variable.",
          }),
        );
      setTimeout(() => {
        if (!editor.isDestroyed) editor.commands.focus();
      }, 0);
    }
  };
  useEffect(() => {
    // The public Mod-k producer schedules editor.focus() on the next frame.
    // Focus the mounted form after that command settles, otherwise it steals
    // focus back from the input opened by the same keyboard event.
    let focus = 0;
    const focusFrame = requestAnimationFrame(() => {
      focus = window.setTimeout(() => input.current?.focus(), 0);
    });
    const outside = (event: MouseEvent) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        (boundary?.current ?? form.current)?.contains(target) ||
        target.closest("[cmdk-root], [data-base-ui-portal]")
      )
        return;
      submit.current();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (editor.getAttributes("link").href === "#")
        editor.chain().unsetLink().run();
      onClose();
      editor.commands.blur();
    };
    document.addEventListener("mousedown", outside);
    window.addEventListener("keydown", onEscape);
    return () => {
      cancelAnimationFrame(focusFrame);
      clearTimeout(focus);
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("keydown", onEscape);
    };
  }, [editor, onClose, boundary]);
  return (
    <EditorFocusScope>
      <form
        ref={form}
        className="application-link-form"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          submit.current();
        }}
      >
        <input
          ref={input}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Paste a link"
          aria-label="Paste a link"
          data-1p-ignore="true"
        />
        {initial ? (
          <button
            type="button"
            aria-label="Remove link"
            onClick={() => submit.current("")}
          >
            <svg
              aria-hidden="true"
              fill="none"
              width="16"
              height="16"
              viewBox="0 0 24 24"
            >
              <path
                fill="currentColor"
                d="M6.343 9.585a1 1 0 0 1 .707 1.708l-1.414 1.414a4 4 0 1 0 5.656 5.656l1.414-1.414a1.001 1.001 0 0 1 1.415 1.414l-1.415 1.414a6 6 0 1 1-8.485-8.484l1.415-1.415c.187-.187.442-.293.707-.293m9.193-7.121a6 6 0 0 1 4.242 10.243l-1.414 1.414a1 1 0 0 1-1.414-1.414l1.414-1.414a4 4 0 0 0 0-5.657 4 4 0 0 0-5.657 0L11.293 7.05a1 1 0 0 1-1.414-1.414l1.414-1.414a6 6 0 0 1 4.243-1.758"
              />
            </svg>
          </button>
        ) : (
          <button type="submit" aria-label="Apply link">
            <ApplicationCheck size={16} />
          </button>
        )}
      </form>
    </EditorFocusScope>
  );
}
export function ApplicationLinkSelector({
  editor,
  open,
  setOpen,
  element = "link",
}: {
  editor: Editor;
  open: boolean;
  setOpen: (open: boolean) => void;
  element?: LinkSession["element"];
}) {
  const session = useRef<LinkSession | null>(null);
  const boundary = useRef<HTMLDivElement>(null);
  if (open && !session.current)
    session.current = captureLinkSession(editor, element);
  if (!open) session.current = null;
  return (
    <div ref={boundary} className="application-link-selector">
      <ToolbarTooltip of="link" disabled={open}>
        <button
          type="button"
          aria-label="Add link"
          aria-expanded={open}
          aria-pressed={!!editor.getAttributes(element).href}
          onClick={() => setOpen(!open)}
        >
          <Icon name="Header Link" size={16} />
        </button>
      </ToolbarTooltip>
      {open && session.current && (
        <LinkPopover
          editor={editor}
          session={session.current}
          boundary={boundary}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
