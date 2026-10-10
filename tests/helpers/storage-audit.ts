// Installed lib0/Yjs module initialization is authorized to read these keys.
// No other read or any write/removal/clear is allowed on the isolated fixture.
const dependencyReads = new Set([
  "getItem:production",
  "getItem:no-color",
  "getItem:node_env",
]);
export function unexpectedBrowserStorageCalls(calls: readonly string[]) {
  return calls.filter((call) => !dependencyReads.has(call));
}
