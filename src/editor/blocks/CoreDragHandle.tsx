import type { Editor } from "@tiptap/core";
import type { NestedOptions } from "@tiptap/extension-drag-handle";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { useCallback, useEffect, useRef, useState } from "react";
import { closeEditorHistory } from "../history/history-boundary";
import { BlockChrome } from "./BlockChrome";
import {
  getEditorSessionRevision,
  isCoreBlock,
  type LegacyBlockTarget,
  resolveBlock,
} from "./commands";
import { beginNativeBlockDrag, endNativeBlockDrag } from "./toolbar-drop";

const structural = new Set([
  "body",
  "bulletList",
  "columnsColumn",
  "container",
  "dataTableCell",
  "dataTableRow",
  "footer",
  "globalContent",
  "orderedList",
  "previewText",
  "section",
  "tableCell",
  "tableHeader",
  "tableRow",
]);
const nested: NestedOptions = {
  defaultRules: false,
  edgeDetection: { edges: ["left", "top"], threshold: -16, strength: 200 },
  rules: [
    {
      id: "excludeStructuralNodes",
      evaluate: ({ node }) => (structural.has(node.type.name) ? 1000 : 0),
    },
    {
      id: "excludeListItemChildren",
      evaluate: ({ node, parent }) =>
        parent?.type.name === "listItem" && node.type.name !== "image"
          ? 1000
          : 0,
    },
    {
      id: "excludeDataTableCellChildren",
      evaluate: ({ parent }) =>
        parent?.type.name === "dataTableCell" ? 1000 : 0,
    },
    {
      id: "nestedDepthLimit",
      evaluate: ({ depth }) => (depth < 12 ? 0 : 1000),
    },
  ],
};
const positionConfig = {
  placement: "left-start" as const,
  strategy: "absolute" as const,
};
const guardKey = new PluginKey("coreBlockDropGuard");
export function CoreDragHandle({
  editor,
  onEditWithAi,
}: {
  editor: Editor;
  onEditWithAi?: (
    editor: Editor,
    target: import("./commands").BlockTarget,
  ) => void;
}) {
  const [description, setDescription] = useState("");
  const handle = useRef<HTMLDivElement>(null);
  const alignHandle = useCallback(
    (pos: number) => {
      const inner = handle.current;
      if (inner) {
        // Fast Refresh preserves DOM attributes written by the previous owner.
        // Clear the obsolete inner layer as the positioned wrapper takes over.
        delete inner.dataset.validTarget;
        delete inner.dataset.textSelectionActive;
        inner.style.removeProperty("transform");
        inner.style.removeProperty("margin-left");
      }
      const wrapper = inner?.parentElement;
      if (!wrapper) return;
      const selection = editor.state.selection;
      wrapper.dataset.textSelectionActive = String(
        selection instanceof TextSelection &&
          !selection.empty &&
          (editor.view.hasFocus() ||
            !!document.activeElement?.closest("[data-re-bubble-menu]")),
      );
      wrapper.style.transform = "translateY(0px)";
      wrapper.style.marginLeft = "";
      if (pos < 0 || pos >= editor.state.doc.content.size) return;
      const node = editor.state.doc.nodeAt(pos);
      if (!node || structural.has(node.type.name)) return;
      const $pos = editor.state.doc.resolve(pos);
      if (
        node.type.name === "listItem" &&
        $pos.parent.type.name === "bulletList"
      )
        wrapper.style.marginLeft = "-16px";
      const outer = editor.view.nodeDOM(pos);
      if (!(outer instanceof HTMLElement)) return;
      let dom: HTMLElement = outer;
      if (
        node.type.name === "section" ||
        ($pos.depth > 0 && $pos.node($pos.depth - 1)?.type.name === "section")
      )
        return;
      const section = (element: HTMLElement) =>
        element.tagName === "SECTION" || element.dataset.nodeType === "section";
      for (
        ;
        node.type.name !== "listItem" &&
        dom.parentElement &&
        dom.parentElement !== editor.view.dom &&
        dom.parentElement.dataset.type !== "container" &&
        !section(dom);
      )
        dom = dom.parentElement;
      if (section(dom)) return;
      // The replica's paragraph NodeView has React wrappers; production's
      // paragraph is the direct semantic node. Use that box and its padding.
      if (node.type.name === "paragraph" && dom === outer)
        dom = outer.querySelector<HTMLElement>("p.node-paragraph") ?? outer;
      const rect = dom.getBoundingClientRect(),
        height = wrapper.offsetHeight,
        style = getComputedStyle(dom);
      let offset = 0;
      if (
        dom.clientHeight -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom) <
        height
      )
        offset = (rect.height - height) / 2;
      else if (!node.isAtom)
        try {
          const caret = editor.view.coordsAtPos(pos + 1);
          offset = caret.top - rect.top;
          if (node.type.name === "heading")
            offset += (caret.bottom - caret.top - height) / 2;
        } catch {}
      wrapper.style.transform = `translateY(${offset}px)`;
    },
    [editor],
  );
  const hovered = useRef<LegacyBlockTarget | null>(null),
    source = useRef<LegacyBlockTarget | null>(null),
    pinned = useRef<LegacyBlockTarget | null>(null);
  useEffect(() => {
    const mapSource = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.getMeta("uiEvent") === "drop")
        queueMicrotask(() => {
          if (!editor.isDestroyed)
            editor.view.dispatch(
              closeEditorHistory(editor.state.tr).setMeta(
                "addToHistory",
                false,
              ),
            );
        });
    };
    const guard = new Plugin({
      key: guardKey,
      state: {
        init: () => null,
        apply(transaction) {
          if (transaction.docChanged)
            for (const ref of [hovered, source, pinned]) {
              if (!ref.current) continue;
              const mapped = transaction.mapping.mapResult(ref.current.pos, 1);
              ref.current = mapped.deleted
                ? null
                : {
                    ...ref.current,
                    pos: mapped.pos,
                    revision:
                      (ref.current.revision ??
                        getEditorSessionRevision(editor)) + 1,
                  };
            }
          return null;
        },
      },
    });
    editor.registerPlugin(guard, (plugin, plugins) => [plugin, ...plugins]);
    editor.on("transaction", mapSource);
    const updateSelection = () => alignHandle(hovered.current?.pos ?? -1);
    updateSelection();
    editor.on("selectionUpdate", updateSelection);
    document.addEventListener("focusin", updateSelection);
    return () => {
      editor.off("transaction", mapSource);
      editor.off("selectionUpdate", updateSelection);
      document.removeEventListener("focusin", updateSelection);
      if (!editor.isDestroyed) editor.unregisterPlugin(guardKey);
    };
  }, [editor, alignHandle]);
  return (
    <DragHandle
      editor={editor}
      nested={nested}
      computePositionConfig={positionConfig}
      className="source-drag-handle"
      onNodeChange={({ node, pos }) => {
        hovered.current =
          node && isCoreBlock(node.type.name) && !structural.has(node.type.name)
            ? {
                pos,
                type: node.type.name,
                revision: getEditorSessionRevision(editor),
              }
            : null;
        if (hovered.current) pinned.current = null;
        setDescription(hovered.current?.type ?? "");
        if (handle.current?.parentElement)
          handle.current.parentElement.dataset.validTarget = String(
            !!hovered.current,
          );
        alignHandle(pos);
      }}
      onElementDragStart={() => {
        const target = hovered.current;
        source.current = target && resolveBlock(editor, target) ? target : null;
        if (source.current) beginNativeBlockDrag(editor, source.current);
        editor.view.dispatch(
          closeEditorHistory(editor.state.tr).setMeta("addToHistory", false),
        );
      }}
      onElementDragEnd={() => {
        source.current = null;
        endNativeBlockDrag(editor);
      }}
    >
      <div
        ref={handle}
        className="block-handle-alignment"
        onPointerDownCapture={(event) => {
          if (
            event.target instanceof Node &&
            event.currentTarget.contains(event.target)
          )
            pinned.current = hovered.current;
        }}
      >
        <BlockChrome
          editor={editor}
          onEditWithAi={onEditWithAi}
          description={description}
          getTarget={() => {
            const current = pinned.current ?? hovered.current;
            return current && resolveBlock(editor, current) ? current : null;
          }}
        />
      </div>
    </DragHandle>
  );
}
