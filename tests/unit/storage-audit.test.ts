import { expect, test } from "vitest";
import { unexpectedBrowserStorageCalls } from "../helpers/storage-audit";

test("fixture storage audit allows only the three authorized dependency reads", () => {
  expect(
    unexpectedBrowserStorageCalls([
      "getItem:production",
      "getItem:no-color",
      "getItem:node_env",
    ]),
  ).toEqual([]);
  const forbidden = [
    "getItem:theme",
    "getItem:unrelated-preference",
    "getItem:production-extra",
    "getItem:",
    "getItem:open-ui-editor-social-links",
    "setItem:production",
    "removeItem:no-color",
    "clear:",
  ];
  expect(unexpectedBrowserStorageCalls(forbidden)).toEqual(forbidden);
});
