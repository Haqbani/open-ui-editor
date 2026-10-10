import { EmailMark, EmailNode } from "@react-email/editor/core";
import {
  type Extensions,
  flattenExtensions,
  getSchemaByResolvedExtensions,
  type JSONContent,
  sortExtensions,
} from "@tiptap/core";
import type { MarkSpec, NodeSpec } from "@tiptap/pm/model";
import { isSafeUrl } from "./services/safe-url";
import { collectThemeIssues } from "./theme-adapter";
import type {
  DocumentContract,
  DocumentIssue,
  DocumentValidation,
} from "./types";

export type {
  DocumentContract,
  DocumentIssue,
  DocumentValidation,
} from "./types";

/** A schema name alone is insufficient: export requires an email-aware class. */
export function createDocumentContract(
  extensions: Extensions,
): DocumentContract {
  const registered = flattenExtensions(extensions);
  const seen = new Set<string>();
  for (const extension of registered) {
    if (seen.has(extension.name))
      throw new Error(`Duplicate extension registration: ${extension.name}`);
    seen.add(extension.name);
  }
  const resolved = sortExtensions(registered);
  const schema = getSchemaByResolvedExtensions(resolved);
  const serializableNodes = new Set(["doc", "globalContent", "text"]);
  const serializableMarks = new Set<string>();
  for (const extension of resolved) {
    if (
      extension instanceof EmailNode &&
      typeof extension.config.renderToReactEmail === "function"
    )
      serializableNodes.add(extension.name);
    if (
      extension instanceof EmailMark &&
      typeof extension.config.renderToReactEmail === "function"
    )
      serializableMarks.add(extension.name);
  }
  return { schema, serializableNodes, serializableMarks };
}

function record(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

/** Run all structural/capability checks on raw data before ProseMirror can drop fields. */
export function validateDocument(
  value: unknown,
  contract: DocumentContract,
): DocumentValidation {
  const issues: DocumentIssue[] = [];
  const fail = (path: string, code: DocumentIssue["code"], message: string) =>
    issues.push({ path, code, message });
  const active = new WeakSet<object>();

  function jsonData(
    data: unknown,
    path: string,
    code: DocumentIssue["code"],
  ): void {
    if (
      data === null ||
      typeof data === "string" ||
      typeof data === "boolean" ||
      (typeof data === "number" && Number.isFinite(data))
    )
      return;
    if (!Array.isArray(data) && !record(data)) {
      fail(path, code, "Expected serializable JSON data.");
      return;
    }
    if (active.has(data)) {
      fail(path, code, "Cyclic data cannot be persisted.");
      return;
    }
    active.add(data);
    for (const [key, child] of Object.entries(data))
      jsonData(
        child,
        Array.isArray(data) ? `${path}[${key}]` : `${path}.${key}`,
        code,
      );
    if (Object.getOwnPropertySymbols(data).length)
      fail(path, code, "Symbol fields cannot be persisted.");
    active.delete(data);
  }

  function attributes(
    attrs: unknown,
    spec: NodeSpec | MarkSpec | undefined,
    path: string,
  ): void {
    if (!record(attrs)) {
      fail(path, "invalid-node", "Expected attributes to be an object.");
      return;
    }
    for (const [key, child] of Object.entries(attrs)) {
      const at = `${path}.${key}`;
      if (!spec?.attrs || !Object.hasOwn(spec.attrs, key))
        fail(at, "invalid-node", "Unknown schema attribute.");
      if (key === "style" && child !== null && typeof child !== "string")
        fail(
          at,
          "invalid-style",
          "Inline style must be a CSS string or inherited null.",
        );
      jsonData(
        child,
        at,
        key === "style" || key === "data" ? "invalid-style" : "invalid-node",
      );
    }
  }

  function globalData(attrs: unknown, path: string): void {
    const data = record(attrs) ? attrs.data : undefined;
    if (!record(data)) {
      fail(
        `${path}.data`,
        "invalid-style",
        "Expected global document metadata.",
      );
      return;
    }
    if (data.theme !== "basic" && data.theme !== "minimal")
      fail(`${path}.data.theme`, "invalid-style", "Unknown document theme.");
    if (typeof data.css !== "string")
      fail(`${path}.data.css`, "invalid-style", "Global CSS must be a string.");
    issues.push(...collectThemeIssues(data.styles, `${path}.data.styles`));
  }

  function visit(node: unknown, path: string): void {
    if (!record(node)) {
      fail(path, "invalid-node", "Expected a node object.");
      return;
    }
    if (active.has(node)) {
      fail(path, "invalid-node", "Cyclic document content.");
      return;
    }
    active.add(node);
    const type = node.type;
    if (
      (type === "image" || type === "youtube" || type === "twitter") &&
      record(node.attrs)
    ) {
      const source =
        node.attrs[type === "image" ? "src" : "internal_imageSource"];
      if (typeof source === "string" && /^blob:/i.test(source))
        fail(
          `${path}.attrs`,
          "invalid-node",
          "Transient image uploads are not durable email assets.",
        );
    }
    if (typeof type !== "string")
      fail(`${path}.type`, "invalid-node", "Node type must be a string.");
    else {
      if (!contract.schema.nodes[type] || !contract.serializableNodes.has(type))
        fail(
          `${path}.type`,
          "unsupported-node",
          `No registered email serializer for node ${type}.`,
        );
      if (
        (type === "doc" && path !== "$") ||
        (type === "globalContent" && path !== "$.content[0]") ||
        (type === "container" && path !== "$.content[1]")
      )
        fail(
          path,
          "invalid-root",
          "Document must contain only the top-level globalContent and one container.",
        );
    }
    for (const key of Object.keys(node))
      if (!["type", "attrs", "content", "marks", "text"].includes(key))
        fail(
          `${path}.${key}`,
          "invalid-node",
          "Unknown node field would be discarded.",
        );
    if (Object.hasOwn(node, "attrs"))
      attributes(
        node.attrs,
        typeof type === "string"
          ? contract.schema.nodes[type]?.spec
          : undefined,
        `${path}.attrs`,
      );
    if (type === "dataTable" && Array.isArray(node.content)) {
      const counts = node.content.map((row) =>
        record(row) && Array.isArray(row.content) ? row.content.length : 0,
      );
      if (
        counts.length < 1 ||
        counts.length > 50 ||
        counts.some((n) => n < 1 || n > 8 || n !== counts[0])
      )
        fail(
          path,
          "invalid-node",
          "DataTable requires a rectangular grid of 1–50 rows and 1–8 columns.",
        );
      if (
        record(node.attrs) &&
        node.attrs.columns != null &&
        node.attrs.columns !== counts[0]
      )
        fail(
          `${path}.attrs.columns`,
          "invalid-node",
          "Declared columns must match the grid.",
        );
    }
    if (type === "globalContent") globalData(node.attrs, `${path}.attrs`);
    if (record(node.attrs)) {
      const attrs = node.attrs;
      // The public legacy Column serializer does not emit table cell spans.
      // Quarantine those raw drafts instead of accepting then silently flattening.
      if (type === "tableCell" || type === "tableHeader")
        for (const span of ["colspan", "rowspan"]) {
          if (attrs[span] != null)
            fail(
              `${path}.attrs.${span}`,
              "unsupported-node",
              "Legacy span-bearing cells require a span-aware serializer.",
            );
        }

      const invalidAttr = (key: string, valid: boolean) => {
        if (Object.hasOwn(attrs, key) && !valid)
          fail(
            `${path}.attrs.${key}`,
            "invalid-node",
            `Invalid ${String(type)} ${key}.`,
          );
      };
      if (
        (type === "paragraph" || type === "heading") &&
        Object.hasOwn(attrs, "ychange")
      )
        invalidAttr("ychange", attrs.ychange === null);
      if (type === "htmlContent")
        invalidAttr("content", typeof attrs.content === "string");
      if (type === "socialLinks")
        invalidAttr(
          "links",
          record(attrs.links) &&
            Object.values(attrs.links).every(
              (value) =>
                value === false ||
                (typeof value === "string" && isSafeUrl(value)),
            ),
        );
      if (type === "youtube" || type === "twitter") {
        for (const key of ["internal_linkHref", "internal_imageSource"])
          invalidAttr(
            key,
            typeof attrs[key] === "string" &&
              (!attrs[key] || isSafeUrl(attrs[key])),
          );
        invalidAttr(
          "alignment",
          ["left", "center", "right"].includes(String(attrs.alignment)),
        );
        invalidAttr(
          type === "youtube"
            ? "internal_includePlayButton"
            : "internal_darkMode",
          typeof attrs[
            type === "youtube"
              ? "internal_includePlayButton"
              : "internal_darkMode"
          ] === "boolean",
        );
        if (type === "twitter")
          invalidAttr(
            "internal_isLoading",
            typeof attrs.internal_isLoading === "boolean",
          );
      }
      if (type === "image")
        invalidAttr(
          "src",
          typeof attrs.src === "string" && (!attrs.src || isSafeUrl(attrs.src)),
        );
      if (type === "bulletList" || type === "orderedList")
        invalidAttr("tight", typeof attrs.tight === "boolean");
      if (type === "orderedList") {
        invalidAttr("start", Number.isSafeInteger(attrs.start));
        invalidAttr(
          "type",
          attrs.type === null || typeof attrs.type === "string",
        );
      }
      if (type === "dataTable") {
        for (const key of ["headerRow", "headerColumn", "striped"])
          invalidAttr(key, typeof attrs[key] === "boolean");
        invalidAttr(
          "borders",
          ["all", "horizontal", "none"].includes(String(attrs.borders)),
        );
      }
      if (type === "dataTableCell")
        invalidAttr(
          "align",
          attrs.align === null ||
            ["left", "center", "right"].includes(String(attrs.align)),
        );
      if (type === "button")
        invalidAttr(
          "href",
          attrs.href === null || typeof attrs.href === "string",
        );
      if (type === "codeBlock")
        for (const key of ["language", "theme"])
          invalidAttr(
            key,
            attrs[key] === null || typeof attrs[key] === "string",
          );
    }

    if (
      type === "heading" &&
      record(node.attrs) &&
      Object.hasOwn(node.attrs, "level") &&
      (!Number.isInteger(node.attrs.level) ||
        Number(node.attrs.level) < 1 ||
        Number(node.attrs.level) > 6)
    )
      fail(
        `${path}.attrs.level`,
        "invalid-node",
        "Heading level must be an integer from 1 to 6.",
      );
    if (
      type === "text" &&
      (typeof node.text !== "string" || node.text.length === 0)
    )
      fail(`${path}.text`, "invalid-node", "Text nodes need nonempty text.");
    if (type !== "text" && Object.hasOwn(node, "text"))
      fail(`${path}.text`, "invalid-node", "Only text nodes carry text.");
    if (type === "doc" && Array.isArray(node.marks) && node.marks.length > 0)
      fail(
        `${path}.marks`,
        "invalid-node",
        "Document envelope cannot carry marks.",
      );
    if (Object.hasOwn(node, "marks")) {
      if (!Array.isArray(node.marks))
        fail(`${path}.marks`, "invalid-node", "Expected marks to be an array.");
      else
        node.marks.forEach((mark: unknown, index: number) => {
          const at = `${path}.marks[${index}]`;
          if (!record(mark)) {
            fail(at, "invalid-node", "Expected a mark object.");
            return;
          }
          if (
            typeof mark.type !== "string" ||
            !contract.schema.marks[mark.type] ||
            !contract.serializableMarks.has(mark.type)
          )
            fail(
              `${at}.type`,
              "unsupported-mark",
              `No registered email serializer for mark ${String(mark.type)}.`,
            );
          for (const key of Object.keys(mark))
            if (key !== "type" && key !== "attrs")
              fail(
                `${at}.${key}`,
                "invalid-node",
                "Unknown mark field would be discarded.",
              );
          if (
            mark.type === "textStyle" &&
            record(mark.attrs) &&
            Object.hasOwn(mark.attrs, "color") &&
            mark.attrs.color !== null &&
            typeof mark.attrs.color !== "string"
          )
            fail(
              `${at}.attrs.color`,
              "invalid-style",
              "Text color must be a CSS string or inherited null.",
            );
          if (Object.hasOwn(mark, "attrs"))
            attributes(
              mark.attrs,
              typeof mark.type === "string"
                ? contract.schema.marks[mark.type]?.spec
                : undefined,
              `${at}.attrs`,
            );
        });
    }
    if (type === "text" && Object.hasOwn(node, "content"))
      fail(
        `${path}.content`,
        "invalid-node",
        "Text nodes cannot have child content.",
      );
    if (Object.hasOwn(node, "content")) {
      if (!Array.isArray(node.content))
        fail(
          `${path}.content`,
          "invalid-node",
          "Expected content to be an array.",
        );
      else
        node.content.forEach((child: unknown, index: number) => {
          visit(child, `${path}.content[${index}]`);
        });
    }
    active.delete(node);
  }

  if (
    !record(value) ||
    value.type !== "doc" ||
    !Array.isArray(value.content) ||
    value.content.length !== 2 ||
    !record(value.content[0]) ||
    value.content[0].type !== "globalContent" ||
    !record(value.content[1]) ||
    value.content[1].type !== "container"
  )
    fail(
      "$",
      "invalid-root",
      "Expected doc content exactly [globalContent, container].",
    );
  // Continue preflight after root failure so unsupported input is diagnosed, never normalized away.
  visit(value, "$");
  if (issues.length) return { ok: false, issues };
  try {
    contract.schema.nodeFromJSON(value).check();
  } catch (error) {
    fail(
      "$",
      "invalid-node",
      error instanceof Error ? error.message : "Invalid schema content.",
    );
    return { ok: false, issues };
  }
  // Return original semantics, including inherited/explicit/automatic data. No schema normalization.
  return { ok: true, document: structuredClone(value) as JSONContent };
}
