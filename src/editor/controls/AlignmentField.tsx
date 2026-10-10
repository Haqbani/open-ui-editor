import { Icon } from "../shell/icons";
export function AlignmentField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="segmented alignment" aria-label="Alignment">
      {(["left", "center", "right"] as const).map((align) => (
        <button
          key={align}
          type="button"
          aria-label={`Align ${align}`}
          aria-pressed={value === align}
          onClick={() => onChange(align)}
        >
          <Icon name={`Align ${align}`} />
        </button>
      ))}
    </fieldset>
  );
}
