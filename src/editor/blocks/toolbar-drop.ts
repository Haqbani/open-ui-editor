import { type Editor, Extension, type JSONContent } from "@tiptap/core";
import {
  Fragment,
  type Node as ProseMirrorNode,
  type Slice,
} from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey, Selection } from "@tiptap/pm/state";
import { dropPoint } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  dispatchBlockTransaction,
  getEditorSessionRevision,
  type LegacyBlockTarget,
  resolveBlock,
} from "./commands";
import { getBlockDefinitions } from "./registry";
export const TOOLBAR_DRAG_MIME = "application/x-open-ui-editor-block";
export const TOOLBAR_DRAG_INLINE_MIME =
  "application/x-open-ui-editor-block-inline";
export type ToolbarCommand = {
  inline?: boolean;
  create?: (editor: Editor) => JSONContent | JSONContent[] | null;
  runAt?: (editor: Editor, pos: number) => boolean;
};
const custom = new WeakMap<Editor, Map<string, ToolbarCommand>>();
const active = new WeakMap<Editor, { commandId: string; revision: number }>();
/** Task3 asset and Task4 variable definitions register on their owning editor. */
export function registerToolbarCommand(
  editor: Editor,
  id: string,
  command: ToolbarCommand,
) {
  let map = custom.get(editor);
  if (!map) {
    map = new Map();
    custom.set(editor, map);
  }
  map.set(id, command);
  return () => {
    map?.delete(id);
  };
}
function commandFor(editor: Editor, id: string): ToolbarCommand | undefined {
  const entry = custom.get(editor)?.get(id);
  if (entry) return entry;
  const definition = getBlockDefinitions().find((d) => d.dragId === id);
  if (definition?.runDragAt) return { runAt: definition.runDragAt };
  return definition?.createDragContent
    ? { create: definition.createDragContent }
    : undefined;
}
export function beginToolbarDrag(editor: Editor, commandId: string) {
  if (!commandFor(editor, commandId)) return false;
  active.set(editor, { commandId, revision: getEditorSessionRevision(editor) });
  return true;
}
export function endToolbarDrag(editor: Editor) {
  active.delete(editor);
}
export function insertToolbarAt(
  editor: Editor,
  commandId: string,
  pos: number,
  revision: number,
  inline = false,
) {
  const command = commandFor(editor, commandId);
  if (
    !command ||
    !!command.inline !== inline ||
    revision !== getEditorSessionRevision(editor) ||
    !Number.isInteger(pos) ||
    pos < 0 ||
    pos > editor.state.doc.content.size
  )
    return false;
  const $pos = editor.state.doc.resolve(pos);
  if (
    $pos.depth < 1 ||
    $pos.node(1).type.name !== "container" ||
    $pos.index(0) !== 1
  )
    return false;
  for (let d = 1; d <= $pos.depth; d++)
    if ($pos.node(d).type.name === "dataTableCell") return false;
  if (
    (inline && !$pos.parent.inlineContent) ||
    (!inline && $pos.parent.inlineContent)
  )
    return false;
  if (command.runAt) return command.runAt(editor, pos);
  const content = command.create?.(editor);
  if (!content) return false;
  let node: import("@tiptap/pm/model").Node;
  if (Array.isArray(content)) {
    try {
      const nodes = content.map((item) => editor.schema.nodeFromJSON(item));
      nodes.forEach((n) => {
        n.check();
      });
      const fragment = Fragment.fromArray(nodes);
      const at = editor.state.doc.resolve(pos);
      if (
        at.parent.inlineContent ||
        !at.parent.canReplace(at.index(), at.index(), fragment)
      )
        return false;
      return dispatchBlockTransaction(
        editor,
        editor.state.tr.insert(pos, fragment),
      );
    } catch {
      return false;
    }
  }
  try {
    node = editor.schema.nodeFromJSON(content);
    node.check();
  } catch {
    return false;
  }
  if (node.isInline !== inline) return false;
  if (!$pos.parent.canReplace($pos.index(), $pos.index(), Fragment.from(node)))
    return false;
  const tr = editor.state.tr.insert(pos, node);
  tr.setSelection(
    Selection.near(tr.doc.resolve(pos + (inline ? node.nodeSize : 1))),
  ).setStoredMarks(null);
  return dispatchBlockTransaction(editor, tr);
}
// A mounted editor retains its plugin closures when the UI helper is refreshed.
// Keep their shared native session on that editor, under a stable private key.
const nativeDragKey = Symbol.for("open-ui-editor.nativeBlockDrag");
type NativeDragEditor = Editor & {
  [nativeDragKey]?: LegacyBlockTarget;
};
export function beginNativeBlockDrag(
  editor: Editor,
  target: LegacyBlockTarget,
) {
  (editor as NativeDragEditor)[nativeDragKey] = { ...target };
}
export function endNativeBlockDrag(editor: Editor) {
  delete (editor as NativeDragEditor)[nativeDragKey];
}

export type DropTarget = {
  pos: number;
  anchorPos: number;
  side: "before" | "after";
  parentPos: number;
};
const structural = new Set([
  "bulletList",
  "orderedList",
  "dataTable",
  "dataTableRow",
  "dataTableCell",
  "twoColumns",
  "threeColumns",
  "fourColumns",
  "globalContent",
  "listItem",
  "previewText",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
]);
function closedBlocks(slice: Slice | null | undefined) {
  if (!slice || slice.openStart || slice.openEnd || !slice.content.childCount)
    return false;
  let valid = true;
  slice.content.forEach((node) => {
    if (!node.isBlock) valid = false;
  });
  return valid;
}
function acceptsDrop(parent: ProseMirrorNode, slice: Slice | null) {
  if (parent.inlineContent) return false;
  const only = (name: string) => {
    if (!closedBlocks(slice)) return false;
    let valid = true;
    slice?.content.forEach((node) => {
      if (node.type.name !== name) valid = false;
    });
    return valid;
  };
  if (["bulletList", "orderedList"].includes(parent.type.name))
    return only("listItem");
  if (parent.type.name === "listItem") return only("image");
  return !structural.has(parent.type.name);
}
export function toolbarBlockTarget(
  editor: Editor,
  x: number,
  y: number,
  previous: DropTarget | null = null,
  slice: Slice | null = null,
): DropTarget | null {
  const bounds = editor.view.dom.getBoundingClientRect();
  // Palette drops outside the editor keep their existing non-mutating boundary.
  if (
    !slice &&
    (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom)
  )
    return null;
  const hit = editor.view.posAtCoords({
    left: Math.max(bounds.left + 8, Math.min(bounds.right - 8, x)),
    top: Math.max(bounds.top + 8, Math.min(bounds.bottom - 8, y)),
  });
  if (!hit) return null;
  const $pos = editor.state.doc.resolve(hit.pos);
  for (let d = $pos.depth; d > 0; d--)
    if ($pos.node(d).type.name === "dataTableCell") return null;
  if (
    $pos.depth < 1 ||
    $pos.node(1).type.name !== "container" ||
    $pos.index(0) !== 1
  )
    return null;
  const fitTarget = (target: DropTarget): DropTarget | null => {
    if (!slice) return target;
    const pos = dropPoint(editor.state.doc, target.pos, slice);
    if (pos === null) return null;
    if (pos === target.pos) return target;
    const $point = editor.state.doc.resolve(pos);
    const parentPos = $point.depth > 0 ? $point.before($point.depth) : -1;
    const before = $point.nodeBefore;
    return !$point.nodeAfter && before
      ? { pos, anchorPos: pos - before.nodeSize, side: "after", parentPos }
      : { pos, anchorPos: pos, side: "before", parentPos };
  };
  const empty = hit.inside >= 0 ? editor.state.doc.nodeAt(hit.inside) : null;
  if (
    empty &&
    !empty.isTextblock &&
    !empty.isAtom &&
    !empty.childCount &&
    !structural.has(empty.type.name)
  )
    return fitTarget({
      pos: hit.inside + 1,
      anchorPos: hit.inside,
      side: "before",
      parentPos: hit.inside,
    });
  const candidate = (
    pos: number,
    size: number,
    depth: number,
  ): DropTarget | null => {
    const dom = editor.view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return null;
    const rect = dom.getBoundingClientRect();
    const mid = (rect.top + rect.bottom) / 2;
    let side: "before" | "after" = y < mid ? "before" : "after";
    if (
      previous?.anchorPos === pos &&
      previous.side !== side &&
      Math.abs(y - mid) <= 8
    )
      side = previous.side;
    const $anchor = editor.state.doc.resolve(pos);
    return fitTarget({
      pos: side === "before" ? pos : pos + size,
      anchorPos: pos,
      side,
      parentPos: depth > 1 ? $anchor.before(depth - 1) : -1,
    });
  };
  if (acceptsDrop($pos.parent, slice)) {
    if ($pos.nodeAfter && !$pos.nodeAfter.isInline)
      return candidate($pos.pos, $pos.nodeAfter.nodeSize, $pos.depth + 1);
    if ($pos.nodeBefore && !$pos.nodeBefore.isInline)
      return candidate(
        $pos.pos - $pos.nodeBefore.nodeSize,
        $pos.nodeBefore.nodeSize,
        $pos.depth + 1,
      );
  }
  for (let d = $pos.depth; d > 1; d--) {
    if (!acceptsDrop($pos.node(d - 1), slice)) continue;
    const target = candidate($pos.before(d), $pos.node(d).nodeSize, d);
    if (target) return target;
  }
  return null;
}
const dropKey = new PluginKey<DecorationSet>("toolbarDrop");
export const ToolbarDrop = Extension.create({
  name: "toolbarDrop",
  addProseMirrorPlugins() {
    const editor = this.editor;
    let marker: HTMLDivElement | null = null,
      previous: DropTarget | null = null;
    let targetFrame = 0;
    let scrollFrame = 0,
      scrollSince = 0,
      pointerX = 0,
      pointerY = 0,
      scrollHost: HTMLElement | null = null;
    let flashTimer: ReturnType<typeof setTimeout> | null = null;
    const show = () => {
      if (!previous) return;
      const view = editor.view,
        at = view.state.doc.resolve(previous.pos);
      const box = (pos: number) => {
        const dom = view.nodeDOM(pos);
        return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
      };
      const before = at.nodeBefore
        ? box(previous.pos - at.nodeBefore.nodeSize)
        : null;
      const after = at.nodeAfter ? box(previous.pos) : null;
      const parent =
        previous.parentPos >= 0 ? view.nodeDOM(previous.parentPos) : view.dom;
      const parentDOM =
        parent instanceof HTMLElement
          ? previous.parentPos >= 0 &&
            view.state.doc.nodeAt(previous.parentPos)?.type.name === "section"
            ? (parent.querySelector<HTMLElement>("section.node-section") ??
              parent)
            : parent
          : view.dom;
      const parentBox = parentDOM.getBoundingClientRect(),
        style = getComputedStyle(parentDOM);
      const paddingLeft = parseFloat(style.paddingLeft) || 0,
        paddingRight = parseFloat(style.paddingRight) || 0;
      const y =
        before && after
          ? (before.bottom + after.top) / 2
          : before
            ? before.bottom + 3
            : after
              ? after.top - 3
              : (parentBox.top + parentBox.bottom) / 2;
      if (!marker) {
        marker = document.createElement("div");
        marker.dataset.testid = "block-drop-indicator";
        marker.setAttribute("aria-hidden", "true");
        marker.className = "editor-block-drop-indicator";
        const owner = view.dom.offsetParent;
        if (!(owner instanceof HTMLElement)) return;
        owner.append(marker);
      }
      const owner = marker.parentElement;
      if (!owner) return;
      const ownerRect = owner.getBoundingClientRect();
      Object.assign(marker.style, {
        left: `${parentBox.left + paddingLeft - ownerRect.left - owner.clientLeft + owner.scrollLeft}px`,
        top: `${y - ownerRect.top - owner.clientTop + owner.scrollTop - 2}px`,
        width: `${Math.max(0, parentBox.width - paddingLeft - paddingRight)}px`,
      });
      editor.view.dom.offsetParent?.setAttribute("data-block-dragging", "true");
    };
    const stopScroll = () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      scrollSince = 0;
      scrollHost = null;
    };
    const clear = () => {
      if (targetFrame) cancelAnimationFrame(targetFrame);
      targetFrame = 0;
      marker?.remove();
      marker = null;
      previous = null;
      editor.view.dom.offsetParent?.removeAttribute("data-block-dragging");
    };
    const updateTarget = () => {
      previous = toolbarBlockTarget(
        editor,
        pointerX,
        pointerY,
        previous,
        editor.view.dragging?.slice ?? null,
      );
      if (previous) show();
      else clear();
    };
    // The deployed BlockDropCursor resolves at most once per animation frame.
    // Drop consumes that last resolved target; the final pointer event may arrive
    // before another frame. Keep one shared target owner for palette/native drag.
    const scheduleTarget = () => {
      if (targetFrame) return;
      targetFrame = requestAnimationFrame(() => {
        targetFrame = 0;
        updateTarget();
      });
    };
    const autoScroll = () => {
      scrollFrame = 0;
      if (!scrollHost) return;
      const rect = scrollHost.getBoundingClientRect();
      const top = pointerY - rect.top,
        bottom = rect.bottom - pointerY;
      const direction = top < 96 ? -1 : 1;
      const distance = top < 96 ? top : bottom;
      if (distance >= 96) {
        stopScroll();
        return;
      }
      if (!scrollSince) scrollSince = performance.now();
      if (performance.now() - scrollSince >= 180) {
        const proximity = Math.min(1, Math.max(0, 1 - distance / 96));
        const oldTop = scrollHost.scrollTop;
        scrollHost.scrollTop += direction * 24 * proximity ** 2;
        if (oldTop === scrollHost.scrollTop) return;
        scheduleTarget();
      }
      scrollFrame = requestAnimationFrame(autoScroll);
    };
    const flash = (from: number, to: number) => {
      editor.view.dispatch(
        editor.state.tr
          .setMeta("blockDropFlash", { from, to })
          .setMeta("addToHistory", false),
      );
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flashTimer = null;
        if (!editor.isDestroyed)
          editor.view.dispatch(
            editor.state.tr
              .setMeta("blockDropFlash", "clear")
              .setMeta("addToHistory", false),
          );
      }, 300);
    };
    const end = () => {
      clear();
      stopScroll();
      endToolbarDrag(editor);
      endNativeBlockDrag(editor);
    };
    return [
      new Plugin({
        key: dropKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, decorations) {
            const flash = tr.getMeta("blockDropFlash");
            if (flash === "clear") return DecorationSet.empty;
            if (flash) {
              const nodes: Decoration[] = [];
              tr.doc.nodesBetween(
                flash.from,
                Math.min(flash.to, tr.doc.content.size),
                (node, pos) => {
                  if (pos < flash.from || !node.isBlock) return;
                  nodes.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      class: "editor-drop-flash",
                    }),
                  );
                  return false;
                },
              );
              return DecorationSet.create(tr.doc, nodes);
            }
            return decorations.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => dropKey.getState(state),
          handleDOMEvents: {
            dragover(view, event) {
              const palette =
                !!event.dataTransfer?.types.includes(TOOLBAR_DRAG_MIME);
              const native =
                view.dragging?.move === true &&
                closedBlocks(view.dragging.slice);
              if (!palette && !native) return false;
              event.preventDefault();
              if (event.dataTransfer)
                event.dataTransfer.dropEffect = palette ? "copy" : "move";
              pointerX = event.clientX;
              pointerY = event.clientY;
              if (!scrollHost)
                for (let p = view.dom.parentElement; p; p = p.parentElement) {
                  if (/auto|scroll/.test(getComputedStyle(p).overflowY)) {
                    scrollHost = p;
                    break;
                  }
                }
              if (!scrollFrame && scrollHost)
                scrollFrame = requestAnimationFrame(autoScroll);
              if (
                event.dataTransfer?.types.includes(TOOLBAR_DRAG_INLINE_MIME)
              ) {
                clear();
                return true;
              }
              scheduleTarget();
              return true;
            },
            dragleave(view, event) {
              const parent = view.dom.offsetParent;
              const rect = parent?.getBoundingClientRect();
              if (
                parent &&
                ((event.relatedTarget instanceof Node &&
                  parent.contains(event.relatedTarget)) ||
                  (rect &&
                    event.clientX > rect.left &&
                    event.clientX < rect.right &&
                    event.clientY > rect.top &&
                    event.clientY < rect.bottom))
              )
                return false;
              clear();
              stopScroll();
              return false;
            },
          },
          handleDrop(view, event, slice, moved) {
            const palette =
              !!event.dataTransfer?.types.includes(TOOLBAR_DRAG_MIME);
            if (!palette && (!moved || !closedBlocks(slice))) return false;
            event.preventDefault();
            if (!palette) {
              const source = (editor as NativeDragEditor)[nativeDragKey],
                selected = view.state.selection;
              const current = source && resolveBlock(editor, source);
              const target =
                previous ??
                toolbarBlockTarget(
                  editor,
                  event.clientX,
                  event.clientY,
                  null,
                  slice,
                );
              if (
                source &&
                current &&
                target &&
                selected instanceof NodeSelection &&
                selected.from === source.pos &&
                slice.content.childCount === 1 &&
                slice.content.firstChild &&
                current.node.eq(slice.content.firstChild) &&
                !(target.pos >= selected.from && target.pos <= selected.to)
              ) {
                const tr = view.state.tr.deleteSelection(),
                  pos = tr.mapping.map(target.pos),
                  at = tr.doc.resolve(pos);
                if (
                  at.depth >= 1 &&
                  at.node(1).type.name === "container" &&
                  at.index(0) === 1 &&
                  at.parent.canReplace(at.index(), at.index(), slice.content)
                ) {
                  tr.insert(pos, slice.content)
                    .setSelection(NodeSelection.create(tr.doc, pos))
                    .setMeta("uiEvent", "drop");
                  if (dispatchBlockTransaction(editor, tr, false))
                    flash(pos, pos + slice.content.size);
                }
              }
              end();
              return true;
            }
            let id: unknown;
            try {
              id = JSON.parse(
                event.dataTransfer?.getData(TOOLBAR_DRAG_MIME) ?? "",
              ).commandId;
            } catch {
              end();
              return true;
            }
            const session = active.get(editor),
              inline = !!event.dataTransfer?.types.includes(
                TOOLBAR_DRAG_INLINE_MIME,
              );
            const bounds = view.dom.getBoundingClientRect();
            const inside =
              event.clientX >= bounds.left &&
              event.clientX <= bounds.right &&
              event.clientY >= bounds.top &&
              event.clientY <= bounds.bottom;
            const pos = inside
              ? inline
                ? view.posAtCoords({ left: event.clientX, top: event.clientY })
                    ?.pos
                : toolbarBlockTarget(
                    editor,
                    event.clientX,
                    event.clientY,
                    previous,
                  )?.pos
              : undefined;
            if (
              typeof id === "string" &&
              session?.commandId === id &&
              pos !== undefined
            ) {
              const inserted = insertToolbarAt(
                editor,
                id,
                pos,
                session.revision,
                inline,
              );
              if (inserted && !inline) {
                const node = editor.state.doc.nodeAt(pos);
                if (node) flash(pos, pos + node.nodeSize);
              }
            }
            end();
            return true;
          },
        },
        view() {
          const cancelOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") end();
          };
          const drop = () => queueMicrotask(end);
          document.addEventListener("dragend", end);
          document.addEventListener("drop", drop);
          document.addEventListener("keydown", cancelOnEscape);
          return {
            update(view, prev) {
              if (view.state.doc !== prev.doc) clear();
            },
            destroy() {
              end();
              if (flashTimer) clearTimeout(flashTimer);
              custom.delete(editor);
              document.removeEventListener("dragend", end);
              document.removeEventListener("drop", drop);
              document.removeEventListener("keydown", cancelOnEscape);
            },
          };
        },
      }),
    ];
  },
});
