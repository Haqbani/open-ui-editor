import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react-dom";
import type { Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { closeEditorHistory } from "../history/history-boundary";
import type { ApplicationSlashItem as SlashCommandItem } from "./slash-commands";
import {
  applicationSlashCommands,
  filterApplicationCommands,
} from "./slash-commands";

const key = new PluginKey("slash-command-v2");
export function SlashPalette({ editor }: { editor: Editor }) {
  const [state, setState] = useState<SuggestionProps<SlashCommandItem> | null>(
    null,
  );
  const [index, setIndex] = useState(0);
  const latest = useRef(state),
    selected = useRef(index),
    command = useRef<((item: SlashCommandItem) => void) | null>(null);
  latest.current = state;
  selected.current = index;
  const { refs, floatingStyles } = useFloating({
    open: !!state,
    placement: "bottom-start",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state?.clientRect)
      refs.setReference({
        getBoundingClientRect: () => state.clientRect?.() ?? new DOMRect(),
      });
  }, [state, refs]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the committed active row must be scrolled after selection or result changes.
  useEffect(() => {
    const element = list.current?.querySelector<HTMLElement>(
      '[data-selected="true"]',
    );
    if (element && list.current) {
      const top = element.offsetTop,
        bottom = top + element.offsetHeight,
        scroller = list.current;
      if (top < scroller.scrollTop + 5) scroller.scrollTop = top - 5;
      else if (bottom > scroller.scrollTop + scroller.clientHeight - 5)
        scroller.scrollTop = bottom - scroller.clientHeight + 5;
    }
  }, [index, state]);
  useEffect(() => {
    let guard = false,
      resetFrame = 0,
      exitFrame = 0;
    const items = applicationSlashCommands();
    const update = (props: SuggestionProps<SlashCommandItem>) => {
      command.current = props.command;
      setState(props);
      setIndex(0);
    };
    const plugin = Suggestion<SlashCommandItem>({
      editor,
      pluginKey: key,
      char: "/",
      allowSpaces: true,
      allow: ({ editor }) =>
        !guard &&
        !(
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement
        ) &&
        !editor.isActive("codeBlock"),
      items: ({ query, editor }) =>
        filterApplicationCommands(items, query, editor),
      command: ({ editor, range, props }) => {
        if (props.title === "Start from a prompt...") {
          guard = true;
          resetFrame = requestAnimationFrame(() => {
            guard = false;
          });
        }
        editor.view.dispatch(closeEditorHistory(editor.state.tr));
        props.command({ editor, range });
      },
      render: () => ({
        onStart: update,
        onUpdate: update,
        onExit: () => {
          setState(null);
          exitFrame = requestAnimationFrame(() => {
            command.current = null;
          });
        },
        onKeyDown: ({ event }) => {
          if (event.key === "Escape") {
            setState(null);
            return true;
          }
          const current = latest.current?.items ?? [];
          if (!current.length) return false;
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            setIndex(
              (i) =>
                (i + (event.key === "ArrowUp" ? -1 : 1) + current.length) %
                current.length,
            );
            return true;
          }
          if (event.key === "Enter") {
            const item = current[selected.current];
            if (item) command.current?.(item);
            return true;
          }
          return false;
        },
      }),
    });
    editor.registerPlugin(plugin, (newPlugin, plugins) => [
      newPlugin,
      ...plugins,
    ]);
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        guard = true;
        resetFrame = requestAnimationFrame(() => {
          guard = false;
        });
      } else if (event.key === "/" && latest.current) {
        const prompt = latest.current.items.find(
          (item) => item.title === "Start from a prompt...",
        );
        if (prompt) {
          event.preventDefault();
          command.current?.(prompt);
        }
      }
    };
    editor.view.dom.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(resetFrame);
      cancelAnimationFrame(exitFrame);
      editor.unregisterPlugin(key);
      editor.view.dom.removeEventListener("keydown", onKey, true);
    };
  }, [editor]);
  if (!state?.items.length) return null;
  return createPortal(
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className="slash-positioner"
    >
      <div
        ref={list}
        data-testid="slash-command-list"
        className="slash-list control-popup"
        role="listbox"
        aria-label="Insert block"
      >
        {state.items.map((item, i) => (
          <div key={item.title}>
            {!state.query.trim() &&
              item.category !== "Ai" &&
              state.items[i - 1]?.category !== item.category && (
                <div className="slash-category">{item.category}</div>
              )}
            <button
              type="button"
              role="option"
              aria-selected={i === index}
              data-selected={i === index}
              data-testid={`slash-command-item-${item.title.toLowerCase().replaceAll(" ", "-")}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => command.current?.(item)}
              onMouseEnter={() => setIndex(i)}
            >
              {item.icon}
              <span>{item.title}</span>
              {item.shortcut && <kbd>{item.shortcut}</kbd>}
            </button>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
