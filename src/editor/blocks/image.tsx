import { EmailNode } from "@react-email/editor/core";
import type {
  AnyExtension,
  NodeViewRendererProps,
  Node as TiptapNode,
} from "@tiptap/core";
import { mergeAttributes } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { useContext } from "react";
import { closeEditorHistory } from "../history/history-boundary";
import { inlineCss } from "./content-style";
import { DataTableCellEmailContext } from "./email-image-context";

function parseDimension(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return;
  const match = String(value)
    .trim()
    .match(/^(\d+(?:\.\d+)?)(%)?$/);
  if (!match) return;
  const numeric = Number(match[1]);
  if (Number.isFinite(numeric))
    return { value: numeric, percentage: match[2] === "%" };
}
export function normalizeStoredImageHeight(value: unknown) {
  const parsed = parseDimension(value);
  if (!parsed || parsed.percentage || parsed.value <= 0) return;
  const rounded = Math.round(parsed.value);
  return rounded >= 1 ? rounded : undefined;
}
export function pixelDimension(value: unknown) {
  return normalizeStoredImageHeight(value) !== undefined;
}
export function resolveEmailImageDimensions(width: unknown, height: unknown) {
  const parsed = parseDimension(width);
  return {
    width:
      parsed &&
      (parsed.percentage ? parsed.value > 0 : Math.round(parsed.value) >= 1)
        ? parsed.percentage
          ? `${parsed.value}%`
          : Math.round(parsed.value)
        : undefined,
    height: normalizeStoredImageHeight(height),
  };
}
function imageView({ node, editor, getPos }: NodeViewRendererProps) {
  const wrapper = document.createElement("div"),
    image = document.createElement("img"),
    handles = document.createElement("div");
  wrapper.className = "resizable-image-container relative leading-none";
  wrapper.style.position = "relative";
  wrapper.style.lineHeight = "0";
  image.className = "node-image";
  image.draggable = false;
  handles.className = "image-resize-handles";
  handles.style.cssText =
    "position:absolute;pointer-events:none;border:2px solid #3b82f6;border-radius:2px;display:none";
  const directions = ["top", "right", "bottom", "left"] as const;
  for (const direction of directions) {
    const handle = document.createElement("div");
    handle.className = "image-resize-handle";
    handle.dataset.direction = direction;
    handle.style.cssText = `position:absolute;pointer-events:auto;background:#3b82f6;border-radius:999px;box-shadow:0 0 0 2px white;cursor:${direction === "left" || direction === "right" ? "ew" : "ns"}-resize`;
    if (direction === "left" || direction === "right") {
      handle.style[direction] = "-5px";
      handle.style.top = "50%";
      handle.style.transform = "translateY(-50%)";
    } else {
      handle.style[direction] = "-5px";
      handle.style.left = "50%";
      handle.style.transform = "translateX(-50%)";
    }
    handles.appendChild(handle);
  }
  wrapper.append(image, handles);
  let current = node,
    resizing: {
      direction: string;
      x: number;
      y: number;
      width: number;
      height: number;
      ratio: number;
      lastWidth: number;
      lastHeight: number;
    } | null = null;
  const geometry = () => {
    const width = image.offsetWidth,
      height = image.offsetHeight;
    handles.style.left = `${image.offsetLeft}px`;
    handles.style.top = `${image.offsetTop}px`;
    handles.style.width = `${width}px`;
    handles.style.height = `${height}px`;
    const size = Math.min(0.35 * Math.min(width, height), 40);
    for (const child of handles.children) {
      const handle = child as HTMLElement,
        horizontal = ["left", "right"].includes(handle.dataset.direction ?? "");
      handle.style.width = `${horizontal ? 8 : size}px`;
      handle.style.height = `${horizontal ? size : 8}px`;
    }
  };
  const containerWidth = () => {
    const width = String(current.attrs.width || "100%");
    if (width.includes("%")) {
      wrapper.style.width = width;
      image.style.width = "100%";
    } else {
      wrapper.style.width = "";
      if (image.offsetWidth > 0) {
        const style = getComputedStyle(wrapper);
        wrapper.style.width = `${image.offsetWidth + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)}px`;
      }
    }
  };
  const apply = () => {
    image.src = current.attrs.src;
    image.alt = current.attrs.alt || "";
    image.title = current.attrs.title || "";
    image.style.cssText = String(current.attrs.style || "");
    image.style.maxWidth = "100%";
    const width = String(current.attrs.width || "100%");
    image.style.width =
      width === "auto" || width.includes("%") || width.includes("px")
        ? width
        : `${width}px`;
    image.classList.toggle("animate-pulse", !!current.attrs.uploadId);
    if (current.attrs.uploadId && !image.complete)
      wrapper.classList.add(
        "animate-pulse",
        "min-h-24",
        "rounded-md",
        "bg-current/10",
      );
    else
      wrapper.classList.remove(
        "animate-pulse",
        "min-h-24",
        "rounded-md",
        "bg-current/10",
      );
    image.style.height = "auto";
    if (pixelDimension(current.attrs.height))
      image.style.aspectRatio = `${parseFloat(width)} / ${parseFloat(current.attrs.height)}`;
    const align = current.attrs.alignment || "left";
    wrapper.style.marginLeft = ["center", "right"].includes(align)
      ? "auto"
      : "0";
    wrapper.style.marginRight = align === "right" ? "0" : "auto";
    containerWidth();
    geometry();
  };
  const selection = () => {
    const pos = getPos();
    const selected =
      editor.state.selection instanceof NodeSelection &&
      editor.state.selection.from === pos &&
      editor.isEditable &&
      !current.attrs.uploadId;
    handles.style.display = selected ? "block" : "none";
    if (selected) geometry();
  };
  const contentWidth = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    return (
      element.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight)
    );
  };
  const move = (event: MouseEvent) => {
    if (!resizing) return;
    const r = resizing,
      lock = !event.metaKey,
      horizontal = ["left", "right"].includes(r.direction);
    let width = horizontal
      ? r.width + (r.direction === "right" ? 1 : -1) * (event.clientX - r.x)
      : r.width;
    let height = horizontal
      ? lock
        ? width / r.ratio
        : r.height
      : r.height + (r.direction === "bottom" ? 1 : -1) * (event.clientY - r.y);
    if (!horizontal && lock) width = height * r.ratio;
    let maxWidth = contentWidth(editor.view.dom);
    for (
      let parent = wrapper.parentElement;
      parent && parent !== editor.view.dom;
      parent = parent.parentElement
    ) {
      const measured = contentWidth(parent);
      if (measured > 0 && measured < maxWidth) maxWidth = measured;
    }
    width = Math.max(10, Math.min(width, maxWidth));
    if (lock) {
      height = width / r.ratio;
      if (height < 10) {
        height = 10;
        width = Math.min(height * r.ratio, maxWidth);
      }
    }
    height = Math.max(10, height);
    r.lastWidth = Math.round(width);
    r.lastHeight = Math.round(height);
    const style = getComputedStyle(wrapper);
    wrapper.style.width = `${r.lastWidth + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)}px`;
    image.style.width = `${r.lastWidth}px`;
    image.style.height = `${r.lastHeight}px`;
    geometry();
  };
  const up = () => {
    const r = resizing;
    resizing = null;
    wrapper.classList.remove("is-resizing");
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    const pos = getPos();
    if (r && pos !== undefined) {
      editor.view.dispatch(
        closeEditorHistory(editor.state.tr).setMeta("addToHistory", false),
      );
      editor
        .chain()
        .setNodeSelection(pos)
        .updateAttributes("image", { width: r.lastWidth, height: r.lastHeight })
        .setNodeSelection(pos)
        .run();
      editor.view.dispatch(
        closeEditorHistory(editor.state.tr).setMeta("addToHistory", false),
      );
    }
  };
  const down = (event: MouseEvent) => {
    const handle = event.target as HTMLElement;
    if (
      !handle.classList.contains("image-resize-handle") ||
      current.attrs.uploadId
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const rect = image.getBoundingClientRect();
    resizing = {
      direction: handle.dataset.direction ?? "right",
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height,
      ratio: rect.width / rect.height,
      lastWidth: Math.round(rect.width),
      lastHeight: Math.round(rect.height),
    };
    wrapper.classList.add("is-resizing");
    document.body.style.cursor = handle.style.cursor;
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
  wrapper.addEventListener("mousedown", down);
  image.addEventListener("load", () => {
    wrapper.classList.remove(
      "animate-pulse",
      "min-h-24",
      "rounded-md",
      "bg-current/10",
    );
    containerWidth();
    geometry();
  });
  editor.on("selectionUpdate", selection);
  editor.on("focus", selection);
  apply();
  selection();
  return {
    dom: wrapper,
    update(next: typeof node) {
      if (next.type.name !== "image") return false;
      current = next;
      apply();
      selection();
      return true;
    },
    selectNode: selection,
    deselectNode: () => {
      if (!resizing) handles.style.display = "none";
    },
    destroy() {
      editor.off("selectionUpdate", selection);
      editor.off("focus", selection);
      wrapper.removeEventListener("mousedown", down);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    },
  };
}
export function extendImage(image: AnyExtension) {
  return EmailNode.from(
    (image as TiptapNode).extend({
      draggable: false,
      addAttributes() {
        return {
          ...this.parent?.(),
          width: {
            default: "100%",
            parseHTML: (element) =>
              element.getAttribute("width") || element.style.width || "auto",
            renderHTML: (attrs) =>
              attrs.width && attrs.width !== "auto"
                ? { width: attrs.width }
                : {},
          },
          height: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("height") || element.style.height || null,
            renderHTML: (attrs) =>
              attrs.height ? { height: attrs.height } : {},
          },
          href: {
            default: "",
            parseHTML: (element) =>
              element.closest("a")?.getAttribute("href") || "",
            renderHTML: (attrs) => (attrs.href ? { href: attrs.href } : {}),
          },
          alignment: { default: "left" },
          uploadId: {
            default: null,
            renderHTML: () => ({}),
            parseHTML: () => null,
          },
          uploadStartedAt: {
            default: null,
            renderHTML: () => ({}),
            parseHTML: () => null,
          },
        };
      },
      renderHTML({ HTMLAttributes }) {
        const { href, ...attributes } = HTMLAttributes;
        const img: [string, Record<string, unknown>] = [
          "img",
          mergeAttributes(this.options.HTMLAttributes, attributes),
        ];
        return href ? ["a", { href }, img] : img;
      },
      addNodeView: () => imageView,
    }),
    ({ node, style }) => {
      const cell = useContext(DataTableCellEmailContext);
      const attrs = node.attrs ?? {},
        own = inlineCss(attrs.style),
        merged: import("react").CSSProperties = {
          ...style,
          height: "auto",
          ...own,
        };
      if (cell && !("maxWidth" in own)) merged.maxWidth = "100%";
      if (!cell && pixelDimension(attrs.width) && !("maxWidth" in own))
        delete merged.maxWidth;
      if (pixelDimension(attrs.height) && !("height" in own))
        delete merged.height;
      const img = (
        /* biome-ignore lint/performance/noImgElement: email/static editor image must retain the source URL and standard img output. */
        <img
          alt={attrs.alt}
          className={attrs.class || undefined}
          src={attrs.src}
          width={resolveEmailImageDimensions(attrs.width, attrs.height).width}
          height={resolveEmailImageDimensions(attrs.width, attrs.height).height}
          style={{
            display: "block",
            outline: "none",
            border: "none",
            textDecoration: "none",
            ...merged,
          }}
        />
      );
      const content = attrs.href ? (
        <a
          href={attrs.href}
          target="_blank"
          style={{ color: "#067df7", textDecorationLine: "none" }}
          rel="noopener"
        >
          {img}
        </a>
      ) : (
        img
      );
      const alignment = attrs.align || attrs.alignment || cell?.align;
      return alignment ? (
        <table
          align="center"
          width="100%"
          border={0}
          cellPadding="0"
          cellSpacing="0"
          role="presentation"
        >
          <tbody style={{ width: "100%" }}>
            <tr style={{ width: "100%" }}>
              <td align={alignment} data-id="__react-email-column">
                {content}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        content
      );
    },
  );
}
