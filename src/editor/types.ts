import type { JSONContent } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";

export type DocumentContract = {
  schema: Schema;
  serializableNodes: ReadonlySet<string>;
  serializableMarks: ReadonlySet<string>;
};
export type DocumentIssue = {
  path: string;
  code:
    | "invalid-root"
    | "invalid-node"
    | "unsupported-node"
    | "unsupported-mark"
    | "invalid-style";
  message: string;
};
export type DocumentValidation =
  | { ok: true; document: JSONContent }
  | { ok: false; issues: DocumentIssue[] };
export type RuntimeThemeInput = {
  label: string;
  type: "text" | "number" | "color" | "select";
  value?: string | number;
  prop: string;
  classReference: string;
  unit?: string;
  options?: Record<string, string>;
  placeholder?: string;
  category?: string;
};
export type RuntimeThemePanel = {
  id: string;
  title: string;
  classReference?: string;
  category?: string;
  inputs: RuntimeThemeInput[];
};

export type TemplateMetadata = {
  from: string;
  replyTo: string;
  subject: string;
  previewText: string;
};
export type TemplateDraft = {
  id: string;
  title: string;
  metadata: TemplateMetadata;
  document: JSONContent;
  /** The editing controller increments this on every document/metadata edit. */
  revision: number;
};
export type DraftStorage = Pick<Storage, "getItem" | "setItem">;
export type SaveResult =
  | { ok: true; revision: number }
  | { ok: false; revision: number; reason: "stale" | "unavailable" };
export type SaveState = {
  revision: number;
  savedRevision: number;
  status: "dirty" | "saving" | "saved" | "failed";
};
