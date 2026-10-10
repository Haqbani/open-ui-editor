import type { NodeViewProps } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { useLayoutEffect, useRef } from "react";

export function useSemanticStyle<T extends HTMLElement>(
  node: NodeViewProps["node"],
  applyAlignment = true,
) {
  const ref = useRef<T>(null);
  // Heading level changes replace the semantic element even when its CSS is unchanged.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reapply CSS to the new heading element
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.cssText =
      typeof node.attrs.style === "string" ? node.attrs.style : "";
    const align = node.attrs.align || node.attrs.alignment;
    if (applyAlignment && ["left", "center", "right"].includes(align))
      element.style.textAlign = align;
  }, [
    applyAlignment,
    node.attrs.style,
    node.attrs.align,
    node.attrs.alignment,
    node.attrs.level,
  ]);
  return ref;
}
export function ParagraphView(props: NodeViewProps) {
  const ref = useSemanticStyle<HTMLParagraphElement>(props.node);
  return (
    <NodeViewWrapper data-core-block="paragraph" className="core-block">
      <p ref={ref} className={`node-paragraph ${props.node.attrs.class ?? ""}`}>
        <NodeViewContent<"span"> as="span" />
      </p>
    </NodeViewWrapper>
  );
}
export function HeadingView(props: NodeViewProps) {
  const ref = useSemanticStyle<HTMLHeadingElement>(props.node),
    level = props.node.attrs.level;
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return (
    <NodeViewWrapper data-core-block="heading" className="core-block">
      <Tag
        ref={ref}
        className={`node-h${level} ${props.node.attrs.class ?? ""}`}
      >
        <NodeViewContent />
      </Tag>
    </NodeViewWrapper>
  );
}
export function SectionView(props: NodeViewProps) {
  const ref = useSemanticStyle<HTMLElement>(props.node);
  return (
    <NodeViewWrapper data-core-block="section" className="core-block">
      <section
        ref={ref}
        data-type="section"
        className={`node-section ${props.node.attrs.class ?? ""}`}
      >
        <NodeViewContent />
      </section>
    </NodeViewWrapper>
  );
}
