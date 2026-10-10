import type { Editor } from "@tiptap/core";
import { useState } from "react";
import type { BlockTarget } from "../blocks/commands";
import { socialPlatform } from "../blocks/social-hosts";
import { SOCIAL_LINKS } from "../blocks/social-platforms";
import { getEditorStorage } from "../storage/editor-storage";
import { InspectorHeading } from "./InspectorChrome";
import { InspectorNodeTitle } from "./InspectorNodeTitle";
import { LayoutControls } from "./LayoutControls";
import { useFamilyTarget } from "./use-family-target";
export function SocialLinksInspector({
  editor,
  target,
}: {
  editor: Editor;
  target: BlockTarget;
}) {
  const original = editor.state.doc.nodeAt(target.pos)?.attrs.links ?? {};
  const [entries, setEntries] = useState(() =>
    SOCIAL_LINKS.flatMap((p) =>
      original[p.value]
        ? [{ type: p.value as string, url: String(original[p.value]) }]
        : [],
    ),
  );
  const [input, setInput] = useState("");
  const { get, accept } = useFamilyTarget(editor, target, (node) => {
    const links = node?.attrs.links ?? {};
    setEntries(
      SOCIAL_LINKS.flatMap((p) =>
        links[p.value]
          ? [{ type: p.value as string, url: String(links[p.value]) }]
          : [],
      ),
    );
    setInput("");
  });
  const commit = (next: typeof entries) => {
    const node = get();
    if (node?.type.name !== "socialLinks") return;
    const links = Object.fromEntries(
      SOCIAL_LINKS.map((p) => [
        p.value,
        next.find((e) => e.type === p.value)?.url || false,
      ]),
    );
    try {
      getEditorStorage(editor).setItem(
        "open-ui-editor-social-links",
        JSON.stringify(links),
      );
    } catch {}
    setEntries(next);
    editor.view.dispatch(
      next.length
        ? editor.state.tr.setNodeMarkup(target.pos, null, {
            ...node.attrs,
            links,
          })
        : editor.state.tr.delete(target.pos, target.pos + node.nodeSize),
    );
    accept();
  };
  const add = (value = input) => {
    const type = socialPlatform(value);
    if (!type || !value) return;
    commit([...entries.filter((e) => e.type !== type), { type, url: value }]);
    setInput("");
  };
  const edit = (index: number) => {
    if (!get() || !entries[index]) return;
    const value = entries[index].url.trim(),
      type = socialPlatform(value);
    if (!value) {
      commit(entries.filter((_, i) => i !== index));
      return;
    }
    if (!type) {
      const persisted = editor.state.doc.nodeAt(target.pos)?.attrs.links?.[
        entries[index].type
      ];
      setEntries(
        entries.map((e, i) =>
          i === index ? { ...e, url: persisted || "" } : e,
        ),
      );
      return;
    }
    commit(
      entries
        .map((e, i) => (i === index ? { type, url: value } : e))
        .filter((e, i) => i === index || e.type !== type),
    );
  };
  return (
    <div className="inspector-content">
      <InspectorHeading>
        <InspectorNodeTitle type="socialLinks">Social Links</InspectorNodeTitle>
      </InspectorHeading>
      <h3>Links</h3>
      {entries.map((entry, index) => (
        <div className="control-row" key={entry.type}>
          {/* biome-ignore lint/performance/noImgElement: standard img preserves the captured editor/email asset URL and dimensions. */}
          <img
            src={SOCIAL_LINKS.find((p) => p.value === entry.type)?.icon}
            alt={SOCIAL_LINKS.find((p) => p.value === entry.type)?.label}
            width={24}
            height={24}
          />
          <input
            className="field-surface"
            aria-label={`${entry.type} URL`}
            value={entry.url}
            onChange={(event) =>
              setEntries(
                entries.map((e, i) =>
                  i === index ? { ...e, url: event.target.value } : e,
                ),
              )
            }
            onBlur={() => edit(index)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                edit(index);
              }
            }}
          />
          <button
            aria-label="Remove social link"
            type="button"
            onClick={() => commit(entries.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <div className="control-row">
        <input
          className="field-surface"
          aria-label="Add social link"
          placeholder="Add social link..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onPaste={(e) => {
            const value = e.clipboardData.getData("text");
            if (socialPlatform(value)) {
              e.preventDefault();
              add(value);
            }
          }}
        />
        <button
          type="button"
          aria-label="Add social link"
          onClick={() => add()}
        >
          +
        </button>
      </div>
      <LayoutControls
        editor={editor}
        pos={target.pos}
        background={false}
        groups={{}}
      />
    </div>
  );
}
