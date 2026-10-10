import { Select } from "@base-ui/react/select";
import { EditorFocusScope } from "@react-email/editor/ui";
import { FloatingInspectorLayer } from "../inspector/InspectorFrame";
import { Icon } from "../shell/icons";
export function ChoiceField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <Select.Trigger className="field-surface choice-field" aria-label={label}>
        <Select.Value>{(v) => options[String(v)] ?? String(v)}</Select.Value>
        <Icon name="Chevron down" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="control-positioner">
          <EditorFocusScope>
            <Select.Popup className="control-popup">
              <FloatingInspectorLayer>
                {Object.entries(options).map(([key, label]) => (
                  <Select.Item key={key} value={key} className="control-option">
                    <Select.ItemText>{label}</Select.ItemText>
                  </Select.Item>
                ))}
              </FloatingInspectorLayer>
            </Select.Popup>
          </EditorFocusScope>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
