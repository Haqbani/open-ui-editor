import { Inspector } from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { useEffect, useState } from "react";
import { resolveBlockTarget } from "../blocks/commands";
import { Icon } from "../shell/icons";
import { Breadcrumb } from "./Breadcrumb";
import { ButtonInspector } from "./ButtonInspector";
import { CodeInspector } from "./CodeInspector";
import { ColumnsInspector } from "./ColumnsInspector";
import { DataTableInspector } from "./DataTableInspector";
import { DividerInspector } from "./DividerInspector";
import { DocumentInspector } from "./DocumentInspector";
import { FooterInspector } from "./FooterInspector";
import { HtmlInspector } from "./HtmlInspector";
import { InspectorHeadingHost } from "./InspectorChrome";
import { useInspectorLayout } from "./InspectorFrame";
import { ListInspector } from "./ListInspector";
import { MediaInspector } from "./MediaInspector";
import { QuoteInspector } from "./QuoteInspector";
import { SectionInspector } from "./SectionInspector";
import { SocialLinksInspector } from "./SocialLinksInspector";
import { selectedBlock } from "./style-adapter";
import { TextInspector } from "./TextInspector";
export function InspectorRouter({ editor }: { editor: Editor | null }) {
  const layout = useInspectorLayout();
  const [headingHost, setHeadingHost] = useState<HTMLDivElement | null>(null);
  const [paletteFocused, setPaletteFocused] = useState(false);
  useEffect(() => {
    // Public FocusScopes retain the command selection. DOM focus independently
    // routes the observed palette/Page-style display, without changing selection.
    const routeFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(
          '[data-testid="insertion-palette"], .insertion-menu, .block-action-handle, .block-actions-popup',
        )
      )
        setPaletteFocused(true);
      else if (
        editor?.view.dom.contains(target) &&
        !(editor.state.selection instanceof NodeSelection)
      )
        setPaletteFocused(false);
    };
    // A direct editor pointer action is explicit inspection intent, including
    // atoms whose NodeSelection can be identical before and after the click.
    const routePointer = () => setPaletteFocused(false);
    const routePalette = () => setPaletteFocused(true);
    const routeSelection = () => {
      // Handle actions refocus with a NodeSelection. Keep their Page style context
      // until writing resumes; breadcrumb NodeSelections retain normal inspection.
      if (
        editor?.isFocused &&
        !(editor.state.selection instanceof NodeSelection)
      )
        setPaletteFocused(false);
    };
    editor?.view.dom.addEventListener("palette-command", routePalette);
    document.addEventListener("focusin", routeFocus);
    editor?.view.dom.addEventListener("pointerdown", routePointer);
    editor?.on("selectionUpdate", routeSelection);
    return () => {
      editor?.view.dom.removeEventListener("palette-command", routePalette);
      document.removeEventListener("focusin", routeFocus);
      editor?.view.dom.removeEventListener("pointerdown", routePointer);
      editor?.off("selectionUpdate", routeSelection);
    };
  }, [editor]);
  if (!editor) return null;
  const family = (pos: number) => {
    const target = resolveBlockTarget(editor, pos);
    if (!target) return null;
    if (target.nodeType === "htmlContent")
      return <HtmlInspector editor={editor} target={target} />;
    if (target.nodeType === "footer")
      return <FooterInspector editor={editor} target={target} />;
    if (target.nodeType === "socialLinks")
      return (
        <SocialLinksInspector
          key={target.pos}
          editor={editor}
          target={target}
        />
      );
    if (["image", "youtube", "twitter"].includes(target.nodeType))
      return (
        <MediaInspector
          key={`${target.nodeType}:${target.pos}`}
          editor={editor}
          target={target}
        />
      );
    if (
      ["twoColumns", "threeColumns", "fourColumns", "columnsColumn"].includes(
        target.nodeType,
      )
    )
      return (
        <ColumnsInspector
          key={`${target.nodeType}:${target.pos}`}
          editor={editor}
          target={target}
        />
      );
    if (
      ["dataTable", "dataTableRow", "dataTableCell"].includes(target.nodeType)
    )
      return <DataTableInspector editor={editor} target={target} />;
    if (target.nodeType === "paragraph") {
      const $pos = editor.state.doc.resolve(target.pos);
      if ($pos.parent.type.name === "columnsColumn")
        return family($pos.before());
    }
    if (["bulletList", "orderedList", "listItem"].includes(target.nodeType))
      return (
        <ListInspector
          key={`${target.nodeType}:${target.pos}`}
          editor={editor}
          target={target}
        />
      );
    if (target.nodeType === "codeBlock")
      return (
        <CodeInspector
          key={`${target.nodeType}:${target.pos}`}
          editor={editor}
          target={target}
        />
      );
    if (target.nodeType === "button")
      return (
        <ButtonInspector
          key={`${target.nodeType}:${target.pos}`}
          editor={editor}
          target={target}
        />
      );
    if (target.nodeType === "horizontalRule")
      return (
        <DividerInspector
          key={`${target.nodeType}:${target.pos}`}
          editor={editor}
          target={target}
        />
      );
    if (target.nodeType === "blockquote")
      return (
        <QuoteInspector
          key={`${target.nodeType}:${target.pos}`}
          editor={editor}
          target={target}
        />
      );
    return null;
  };
  return (
    <InspectorHeadingHost.Provider value={headingHost}>
      <Inspector.Root
        data-testid="editor-inspector"
        className="editor-inspector"
      >
        <div className="inspector-fixed-header">
          <div className="inspector-top">
            {paletteFocused ? (
              <nav className="inspector-breadcrumb" aria-label="Selected block">
                <button type="button" aria-label="Page style">
                  Page style
                </button>
              </nav>
            ) : (
              <Breadcrumb editor={editor} />
            )}
            <button
              type="button"
              className="icon-button"
              aria-label={
                layout?.pinned === false ? "Pin sidebar" : "Hide sidebar"
              }
              onClick={layout?.hideOrPin}
            >
              <Icon name="Hide sidebar" size={16} />
            </button>
          </div>
          <div ref={setHeadingHost} className="inspector-heading-host" />
        </div>
        <div className="inspector-scroll">
          {paletteFocused ? (
            <DocumentInspector editor={editor} />
          ) : (
            <>
              <Inspector.Document>
                {() => <DocumentInspector editor={editor} />}
              </Inspector.Document>
              <Inspector.Node>
                {(context) =>
                  family(
                    editor.state.selection instanceof NodeSelection &&
                      editor.state.selection.node.type.name === "footer"
                      ? editor.state.selection.from
                      : context.nodePos.pos,
                  ) ??
                  (context.nodeType === "section" ? (
                    <SectionInspector
                      key={context.nodePos.pos}
                      editor={editor}
                      context={context}
                    />
                  ) : (
                    <TextInspector
                      key={context.nodePos.pos}
                      editor={editor}
                      context={context}
                    />
                  ))
                }
              </Inspector.Node>
              <Inspector.Text>
                {(context) =>
                  family(selectedBlock(editor)?.pos ?? -1) ?? (
                    <TextInspector editor={editor} context={context} />
                  )
                }
              </Inspector.Text>
            </>
          )}
        </div>
      </Inspector.Root>
    </InspectorHeadingHost.Provider>
  );
}
