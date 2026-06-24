import { useMemo, useState } from 'react';
import { TextInput, type TextInputProps } from '@mantine/core';

type Props = Omit<TextInputProps, 'value' | 'onChange' | 'onKeyDown'> & {
  value: string;
  suggestions: readonly string[];
  onValueChange: (value: string) => void;
  onCommit?: (value: string) => void;
  submitOnEnter?: () => void;
};

export function SuggestionTextInput({
  value,
  suggestions,
  onValueChange,
  onCommit,
  submitOnEnter,
  ...props
}: Props) {
  const [opened, setOpened] = useState(false);

  const visibleSuggestions = useMemo(() => {
    const cleaned = value.trim().toLowerCase();
    const filtered = cleaned
      ? suggestions.filter((suggestion) => suggestion.toLowerCase().includes(cleaned))
      : suggestions;
    return filtered.slice(0, 8);
  }, [suggestions, value]);

  function firstMatch() {
    const cleaned = value.trim().toLowerCase();
    if (!cleaned) return visibleSuggestions[0] ?? '';
    return (
      visibleSuggestions.find((suggestion) => suggestion.toLowerCase().startsWith(cleaned)) ??
      visibleSuggestions[0] ??
      ''
    );
  }

  function commitValue(nextValue: string) {
    if (!nextValue) return false;
    onValueChange(nextValue);
    onCommit?.(nextValue);
    setOpened(false);
    return true;
  }

  return (
    <div className="suggestionField">
      <TextInput
        {...props}
        value={value}
        onFocus={() => setOpened(true)}
        onChange={(event) => {
          onValueChange(event.currentTarget.value);
          setOpened(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpened(false);
            const exact = suggestions.find((suggestion) => suggestion.toLowerCase() === value.trim().toLowerCase());
            if (exact) onCommit?.(exact);
          }, 120);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            commitValue(firstMatch());
            return;
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            const matched = commitValue(firstMatch());
            if (!matched) onCommit?.(value);
            submitOnEnter?.();
          }

          if (event.key === 'Escape') {
            setOpened(false);
          }
        }}
      />
      {opened && visibleSuggestions.length > 0 && (
        <div className="suggestionMenu">
          {visibleSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="suggestionOption"
              onMouseDown={(event) => {
                event.preventDefault();
                commitValue(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
