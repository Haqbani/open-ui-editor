import { expect, test } from "vitest";
import { applySaveResult } from "../../src/editor/storage/save-state";
import type { SaveState } from "../../src/editor/types";

// Break caught: a result for an older revision marks newer edits saved or failed.
test("olderSaveResultDoesNotMarkNewRevisionSaved", () => {
  const current: SaveState = { revision: 2, savedRevision: 0, status: "dirty" };
  expect(applySaveResult(current, { ok: true, revision: 1 })).toMatchObject({
    revision: 2,
    savedRevision: 1,
    status: "dirty",
  });
  expect(
    applySaveResult(current, { ok: false, revision: 1, reason: "unavailable" }),
  ).toEqual(current);
});

test.each(["dirty", "saving", "failed"] as const)(
  "current success marks %s revision saved without mutating state",
  (status) => {
    const current: SaveState = { revision: 2, savedRevision: 1, status };
    expect(applySaveResult(current, { ok: true, revision: 2 })).toEqual({
      revision: 2,
      savedRevision: 2,
      status: "saved",
    });
    expect(current).toEqual({ revision: 2, savedRevision: 1, status });
  },
);

test.each(["unavailable", "stale"] as const)(
  "current %s failure marks unsaved revision failed",
  (reason) => {
    expect(
      applySaveResult(
        { revision: 3, savedRevision: 1, status: "saving" },
        { ok: false, revision: 3, reason },
      ),
    ).toEqual({ revision: 3, savedRevision: 1, status: "failed" });
  },
);

test.each(["saving", "failed", "saved"] as const)(
  "older success preserves %s status and never lowers saved revision",
  (status) => {
    const current: SaveState = { revision: 3, savedRevision: 2, status };
    expect(applySaveResult(current, { ok: true, revision: 1 })).toEqual(
      current,
    );
  },
);

test("older success can advance savedRevision while latest save continues", () => {
  expect(
    applySaveResult(
      { revision: 3, savedRevision: 0, status: "saving" },
      { ok: true, revision: 2 },
    ),
  ).toEqual({ revision: 3, savedRevision: 2, status: "saving" });
});

test("duplicate failure cannot erase a confirmed current save", () => {
  const current: SaveState = { revision: 2, savedRevision: 2, status: "saved" };
  expect(
    applySaveResult(current, { ok: false, revision: 2, reason: "unavailable" }),
  ).toEqual(current);
});

test("results beyond the current revision cannot mark it saved or failed", () => {
  const current: SaveState = { revision: 2, savedRevision: 0, status: "dirty" };
  expect(applySaveResult(current, { ok: true, revision: 3 })).toEqual(current);
  expect(
    applySaveResult(current, { ok: false, revision: 3, reason: "unavailable" }),
  ).toEqual(current);
});
