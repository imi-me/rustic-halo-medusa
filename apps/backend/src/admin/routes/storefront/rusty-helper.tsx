import { useId, useState } from "react";
import { adminRequest } from "../../lib/inline-edit";
import type {
  HomepageSuggestion,
  SuggestionInput,
} from "../../../lib/storefront-content/suggestions";
type Field = Exclude<keyof HomepageSuggestion, "note">;
const definitions: Record<
  SuggestionInput["kind"],
  {
    key: Field;
    label: string;
    max: number;
    multiline?: boolean;
    required?: boolean;
  }[]
> = {
  section: [
    { key: "eyebrow", label: "Small label", max: 100 },
    {
      key: "title",
      label: "Heading",
      max: 160,
      multiline: true,
      required: true,
    },
    { key: "description", label: "Description", max: 600, multiline: true },
    { key: "action", label: "Button text", max: 80, required: true },
  ],
  search: [
    { key: "seoTitle", label: "Search title", max: 100, required: true },
    {
      key: "seoDescription",
      label: "Search description",
      max: 320,
      multiline: true,
      required: true,
    },
  ],
  alt: [
    {
      key: "alt",
      label: "Image description",
      max: 300,
      multiline: true,
      required: true,
    },
  ],
};
export type RustyContext = Pick<SuggestionInput, "title" | "description"> &
  Partial<Pick<SuggestionInput, "eyebrow" | "action" | "alt" | "photo">> & { destination?: string };
export const RustyHelper = ({
  kind,
  context,
  apply,
}: {
  kind: SuggestionInput["kind"];
  context: RustyContext;
  apply: (patch: Partial<HomepageSuggestion>) => void;
}) => {
  const id = useId(),
    [brief, setBrief] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [proposal, setProposal] = useState<{
      value: HomepageSuggestion;
      snapshot: string;
    } | null>(null),
    [chosen, setChosen] = useState<Field[]>([]);
  const snapshot = JSON.stringify(context),
    fields = definitions[kind],
    changed = !!proposal && proposal.snapshot !== snapshot;
  const invalid =
    !!proposal &&
    fields.some(
      (f) =>
        chosen.includes(f.key) &&
        (proposal.value[f.key].length > f.max ||
          (f.required && !proposal.value[f.key].trim()))
    );
  const generate = async () => {
    setBusy(true);
    setError("");
    setProposal(null);
    try {
      const data = await adminRequest("/admin/storefront-content/suggest", {
        kind,
        brief,
        title: context.title,
        description: context.description,
        eyebrow: context.eyebrow || "",
        action: context.action || "",
        alt: context.alt || "",
        photo: kind === "alt" ? context.photo || "" : "",
      });
      setProposal({ value: data.suggestion, snapshot });
      setChosen(fields.map((f) => f.key));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="hp-rusty-helper">
      <summary>
        Ask Rusty ·{" "}
        {kind === "alt"
          ? "Describe this image"
          : kind === "search"
          ? "Help with search wording"
          : "Help write this section"}
      </summary>
      <label className="hp-field" htmlFor={id}>
        <span>
          {kind === "alt"
            ? "Anything Rusty should know about this image?"
            : "What would you like to say?"}
        </span>
        <textarea
          id={id}
          rows={2}
          value={brief}
          maxLength={1500}
          placeholder={
            kind === "alt"
              ? "Optional: explain an unfamiliar motif or important lettering…"
              : "For example: introduce our fall collection in a warm, simple way…"
          }
          onChange={(e) => setBrief(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || (kind === "alt" && !context.photo)}
        onClick={() => void generate()}
      >
        {busy ? "Rusty is writing…" : "Suggest wording"}
      </button>
      <p className="hp-footnote">
        {kind === "alt"
          ? "This image and its section details"
          : "This section’s wording and your brief"}{" "}
        are sent to your configured Ask Rusty service when you ask. Review the
        suggestion before using it. Nothing saves or publishes automatically.
      </p>
      {error && (
        <p className="hp-error" role="alert">
          {error}
        </p>
      )}
      {proposal && (
        <div className="hp-rusty-proposal">
          <h4>Review Rusty’s suggestion</h4>
          <p>Choose which wording to use. You can edit it here first.</p>
          {fields.map((f) => (
            <div key={f.key}>
              <label className="hp-toggle">
                <input
                  type="checkbox"
                  checked={chosen.includes(f.key)}
                  onChange={(e) =>
                    setChosen((c) =>
                      e.target.checked
                        ? [...c, f.key]
                        : c.filter((k) => k !== f.key)
                    )
                  }
                />
                <span>Use {f.label.toLowerCase()}</span>
              </label>
              <label className="hp-field">
                <span>Suggested {f.label.toLowerCase()}</span>
                {f.multiline ? (
                  <textarea
                    aria-label={`Suggested ${f.label.toLowerCase()}`}
                    rows={3}
                    value={proposal.value[f.key]}
                    maxLength={f.max}
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        value: { ...proposal.value, [f.key]: e.target.value },
                      })
                    }
                  />
                ) : (
                  <input
                    aria-label={`Suggested ${f.label.toLowerCase()}`}
                    value={proposal.value[f.key]}
                    maxLength={f.max}
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        value: { ...proposal.value, [f.key]: e.target.value },
                      })
                    }
                  />
                )}
                <small>
                  {proposal.value[f.key].length} / {f.max} characters
                </small>
              </label>
            </div>
          ))}
          {proposal.value.note && <p>{proposal.value.note}</p>}
          {changed && (
            <p role="status">
              This section changed after Rusty started. Ask for a fresh
              suggestion to keep your latest edits.
            </p>
          )}
          <div className="hp-header-actions">
            <button
              type="button"
              disabled={!chosen.length || changed || invalid || busy}
              onClick={() => {
                if (!changed && !invalid) {
                  apply(
                    Object.fromEntries(
                      chosen.map((key) => [key, proposal.value[key]])
                    )
                  );
                  setProposal(null);
                }
              }}
            >
              Use selected wording in draft
            </button>
            <button type="button" onClick={() => setProposal(null)}>
              Dismiss suggestion
            </button>
          </div>
          <small>
            You can still review the page before saving or publishing.
          </small>
        </div>
      )}
    </details>
  );
};
