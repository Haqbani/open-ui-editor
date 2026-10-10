import { expect, test } from "vitest";
import { createDocumentContract } from "../../src/editor/document-contract";
import { createReferenceDocument } from "../../src/editor/reference-document";
import {
  readDraft,
  writeDraft as writeWithContract,
} from "../../src/editor/storage/draft-store";
import type { DraftStorage, TemplateDraft } from "../../src/editor/types";
import { createEditorExtensions } from "../helpers/extensions";

const contract = createDocumentContract(createEditorExtensions());
const writeDraft = (storage: DraftStorage, draft: TemplateDraft) =>
  writeWithContract(storage, draft, contract);
function draft(revision = 0, text = "Welcome"): TemplateDraft {
  const document = createReferenceDocument();
  document.content![1].content![0].content![0].text = text;
  return {
    id: "neutral-template",
    title: "Local template",
    metadata: {
      from: "Editor <editor@example.com>",
      replyTo: "reply@example.com",
      subject: "A neutral subject",
      previewText: "Preview text",
    },
    document,
    revision,
  };
}
function storage(): DraftStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}
// Invalid fixtures supply raw data at the storage boundary, without a production key constant.
function rawStorage(value: string): DraftStorage {
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}

// Break caught: omitting any draft field or normalizing document styles loses edits on reload.
test("roundTripsDraftAndMetadata", () => {
  const local = storage();
  const original = draft(3);
  original.document.content![1].content![0].attrs = {
    style: "padding-top: 0px; width: auto;",
  };
  original.metadata.replyTo = "";
  const before = structuredClone(original);
  expect(writeDraft(local, original)).toEqual({ ok: true, revision: 3 });
  expect(readDraft(local, original.id, contract)).toEqual({
    kind: "loaded",
    draft: before,
  });
  expect(original).toEqual(before);
});

// Break caught: a late write overwrites the newest text or metadata.
test("lateSaveDoesNotReplaceLatestDraft", () => {
  const local = storage();
  const newest = draft(2, "Newest text");
  newest.metadata.subject = "Newest subject";
  expect(writeDraft(local, newest)).toEqual({ ok: true, revision: 2 });
  expect(writeDraft(local, draft(1, "Old text"))).toEqual({
    ok: false,
    revision: 1,
    reason: "stale",
  });
  expect(readDraft(local, newest.id, contract)).toEqual({
    kind: "loaded",
    draft: newest,
  });
});

test("missing records are explicit", () => {
  expect(readDraft(storage(), "absent", contract)).toEqual({ kind: "missing" });
});

test("revisions advance for one draft without interfering with another", () => {
  const local = storage();
  writeDraft(local, draft(1, "Before"));
  const latest = draft(2, "After");
  const other = { ...draft(0, "Other draft"), id: "second-template" };
  expect(writeDraft(local, latest)).toEqual({ ok: true, revision: 2 });
  expect(writeDraft(local, other)).toEqual({ ok: true, revision: 0 });
  expect(readDraft(local, latest.id, contract)).toEqual({
    kind: "loaded",
    draft: latest,
  });
  expect(readDraft(local, other.id, contract)).toEqual({
    kind: "loaded",
    draft: other,
  });
});

test("local records cannot collide with unprefixed application keys", () => {
  const local = storage();
  local.setItem("neutral-template", "Unrelated application data");
  expect(writeDraft(local, draft())).toEqual({ ok: true, revision: 0 });
  expect(local.getItem("neutral-template")).toBe("Unrelated application data");
  expect(readDraft(local, "neutral-template", contract)).toMatchObject({
    kind: "loaded",
  });
});

test.each(["", "{broken", "null", "[]", "{}"])(
  "malformed storage %j is invalid, never missing",
  (value) => {
    expect(readDraft(rawStorage(value), "neutral-template", contract)).toEqual({
      kind: "invalid",
      raw: value,
      message: expect.any(String),
    });
  },
);

test.each([
  { id: "another-template" },
  { title: 42 },
  { metadata: { from: "", replyTo: "", subject: "" } },
  { metadata: { from: 42, replyTo: "", subject: "", previewText: "" } },
  { metadata: null },
  { revision: -1 },
  { revision: 1.5 },
  { revision: Number.MAX_SAFE_INTEGER + 1 },
  { revision: "2" },
])("rejects malformed draft envelope %j", (patch) => {
  expect(
    readDraft(
      rawStorage(JSON.stringify({ ...draft(), ...patch })),
      "neutral-template",
      contract,
    ),
  ).toMatchObject({ kind: "invalid", message: expect.any(String) });
});

test.each([
  { type: "paragraph" },
  {
    ...createReferenceDocument(),
    content: [
      createReferenceDocument().content![0],
      { type: "container", content: [{ type: "unknownNode" }] },
    ],
  },
])("validates loaded documents before approval %j", (document) => {
  expect(
    readDraft(
      rawStorage(JSON.stringify({ ...draft(), document })),
      "neutral-template",
      contract,
    ),
  ).toMatchObject({ kind: "invalid", message: expect.any(String) });
});

test("read exceptions are unavailable with an explanatory message", () => {
  const local: DraftStorage = {
    getItem: () => {
      throw new Error("Storage is disabled");
    },
    setItem: () => {},
  };
  expect(readDraft(local, "neutral-template", contract)).toEqual({
    kind: "unavailable",
    message: expect.stringContaining("Storage is disabled"),
  });
});

test.each(["read", "write"])(
  "%s exceptions preserve the attempted draft and revision",
  (operation) => {
    const local: DraftStorage = {
      getItem: () => {
        if (operation === "read") throw new Error("Disabled");
        return null;
      },
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    };
    const attempted = draft(4, "Unsaved text");
    const before = structuredClone(attempted);
    expect(writeDraft(local, attempted)).toEqual({
      ok: false,
      revision: 4,
      reason: "unavailable",
    });
    expect(attempted).toEqual(before);
  },
);

test.each(["{broken", JSON.stringify({ ...draft(9), revision: "9" })])(
  "does not overwrite an unreadable existing record %j",
  (value) => {
    const local = rawStorage(value);
    expect(writeDraft(local, draft(4))).toEqual({
      ok: false,
      revision: 4,
      reason: "unavailable",
    });
    expect(local.getItem("neutral-template")).toBe(value);
  },
);

test("serialization failures keep both the stored and in-memory drafts", () => {
  const local = storage();
  const saved = draft(1);
  writeDraft(local, saved);
  const attempted = draft(2);
  attempted.document.content!.push(attempted.document);
  expect(writeDraft(local, attempted)).toEqual({
    ok: false,
    revision: 2,
    reason: "unavailable",
  });
  expect(readDraft(local, saved.id, contract)).toEqual({
    kind: "loaded",
    draft: saved,
  });
  expect(attempted.document.content![2]).toBe(attempted.document);
});

test("schemaRejectedStoredBytesSurviveRevisionCatchUp", () => {
  const invalid = draft(2);
  invalid.document.content![1].content!.push({
    type: "unrecognizedSavedBlock",
  });
  const raw = JSON.stringify(invalid, null, 2);
  const local = rawStorage(raw);
  expect(readDraft(local, invalid.id, contract).kind).toBe("invalid");
  for (const revision of [1, 2, 3, 9]) {
    expect(writeDraft(local, draft(revision)).ok).toBe(false);
    expect(local.getItem(invalid.id)).toBe(raw);
  }
});

test("writerRejectsNonCanonicalLiveDataBeforeSerialization", () => {
  const local = storage();
  const saved = draft(1);
  writeDraft(local, saved);
  const invalid = draft(2);
  invalid.document.content![0].attrs!.data.styles[0].inputs[0].value =
    undefined;
  expect(writeDraft(local, invalid).ok).toBe(false);
  expect(readDraft(local, saved.id, contract)).toEqual({
    kind: "loaded",
    draft: saved,
  });
});
