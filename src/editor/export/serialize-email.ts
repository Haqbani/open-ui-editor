import { composeReactEmail } from "@react-email/editor/core";
import type { Editor, EditorEvents } from "@tiptap/core";
import { createDocumentContract, validateDocument } from "../document-contract";
import type { DocumentIssue } from "../types";

export type ExportResult =
  | {
      ok: true;
      revision: number;
      html: string;
      unformattedHtml: string;
      text: string;
    }
  | { ok: false; revision: number; issues: DocumentIssue[] };

/** Compose from the one live editor, rejecting any document mutation across the await. */
export async function serializeEmail(
  editor: Editor,
  previewText: string,
  revision: number,
): Promise<ExportResult> {
  let changed = false;
  const onTransaction = ({
    transaction,
    appendedTransactions,
  }: EditorEvents["transaction"]) => {
    if (
      transaction.docChanged ||
      appendedTransactions.some((tr) => tr.docChanged)
    )
      changed = true;
  };
  const onDestroy = () => {
    changed = true;
  };
  const invalid = (message: string): ExportResult => ({
    ok: false,
    revision,
    issues: [{ path: "$", code: "invalid-node", message }],
  });
  editor.on("transaction", onTransaction);
  editor.on("destroy", onDestroy);
  try {
    const document = editor.getJSON();
    // Resolved node/mark classes determine export support; the live schema also includes global attributes.
    const contract = createDocumentContract(
      editor.extensionManager.extensions.filter(
        (extension) => extension.type !== "extension",
      ),
    );
    const validated = validateDocument(document, {
      ...contract,
      schema: editor.schema,
    });
    if (!validated.ok) return { ok: false, revision, issues: validated.issues };
    if (changed)
      return invalid(
        "The document changed during email export. Generate it again.",
      );
    const output = await composeReactEmail({ editor, preview: previewText });
    if (changed)
      return invalid(
        "The document changed during email export. Generate it again.",
      );
    return {
      ok: true,
      revision,
      html: output.html,
      unformattedHtml: output.unformattedHtml,
      text: output.text,
    };
  } catch (error) {
    return invalid(
      error instanceof Error ? error.message : "Email export failed.",
    );
  } finally {
    editor.off("transaction", onTransaction);
    editor.off("destroy", onDestroy);
  }
}
