import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TextInput, type TextInputProps } from '@mantine/core';

type Props = Omit<TextInputProps, 'value' | 'onChange'> & {
  value: string;
  suggestions: readonly string[];
  onValueChange: (value: string) => void;
  onCommit?: (value: string) => void;
  submitOnEnter?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
};

export function SuggestionTextInput({
  value,
  suggestions,
  onValueChange,
  onCommit,
  submitOnEnter,
  inputRef,
  ...props
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [opened, setOpened] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);

  const visibleSuggestions = useMemo(() => {
    const cleaned = (value || '').trim().toLowerCase();
    const filtered = cleaned
      ? suggestions.filter((s) => s && s.toLowerCase().includes(cleaned))
      : suggestions.filter(Boolean);
    return filtered.slice(0, 50);
  }, [suggestions, value]);

  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < 220 && rect.top > 220;
    const dropdownWidth = Math.max(rect.width, 220);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - dropdownWidth - 8));

    setCoords({
      top: showAbove ? undefined : rect.bottom + 4,
      bottom: showAbove ? window.innerHeight - rect.top + 4 : undefined,
      left,
      width: dropdownWidth,
    });
  };

  useLayoutEffect(() => {
    if (opened) {
      updatePosition();
    }
  }, [opened, value, visibleSuggestions.length]);

  useEffect(() => {
    if (!opened) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpened(false);
      setHighlightedIndex(-1);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [opened]);

  function firstMatch() {
    const cleaned = (value || '').trim().toLowerCase();
    if (!cleaned) return visibleSuggestions[0] ?? '';
    return (
      visibleSuggestions.find((s) => s.toLowerCase().startsWith(cleaned)) ??
      visibleSuggestions[0] ??
      ''
    );
  }

  function commitValue(nextValue: string) {
    if (!nextValue) return false;
    onValueChange(nextValue);
    onCommit?.(nextValue);
    setOpened(false);
    setHighlightedIndex(-1);
    return true;
  }

  return (
    <div ref={containerRef} className="suggestionField" style={{ position: 'relative', width: '100%' }}>
      <TextInput
        {...props}
        ref={inputRef}
        value={value}
        onFocus={() => {
          setOpened(true);
          updatePosition();
        }}
        onClick={() => {
          setOpened(true);
          updatePosition();
        }}
        onChange={(event) => {
          onValueChange(event.currentTarget.value);
          setOpened(true);
          setHighlightedIndex(0);
          updatePosition();
        }}
        onBlur={() => {
          const exact = suggestions.find(
            (suggestion) => suggestion.toLowerCase() === value.trim().toLowerCase()
          );
          if (exact) onCommit?.(exact);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            if (opened) {
              event.preventDefault();
              setHighlightedIndex((prev) =>
                prev < visibleSuggestions.length - 1 ? prev + 1 : 0
              );
              return;
            } else if (event.altKey) {
              event.preventDefault();
              setOpened(true);
              setHighlightedIndex(0);
              updatePosition();
              return;
            }
          }

          if (event.key === 'ArrowUp') {
            if (opened) {
              event.preventDefault();
              setHighlightedIndex((prev) =>
                prev > 0 ? prev - 1 : visibleSuggestions.length - 1
              );
              return;
            } else if (event.altKey) {
              event.preventDefault();
              setOpened(true);
              setHighlightedIndex(visibleSuggestions.length - 1);
              updatePosition();
              return;
            }
          }

          if (event.key === 'Tab') {
            if (opened && highlightedIndex >= 0 && visibleSuggestions[highlightedIndex]) {
              commitValue(visibleSuggestions[highlightedIndex]);
            } else if (opened) {
              commitValue(firstMatch());
            }
            props.onKeyDown?.(event);
            return;
          }

          if (event.key === 'Enter') {
            if (opened && highlightedIndex >= 0 && visibleSuggestions[highlightedIndex]) {
              commitValue(visibleSuggestions[highlightedIndex]);
              submitOnEnter?.();
            } else {
              const matched = commitValue(firstMatch());
              if (!matched) {
                onCommit?.(value);
                setOpened(false);
              }
              submitOnEnter?.();
            }
            props.onKeyDown?.(event);
            return;
          }

          if (event.key === 'Escape') {
            setOpened(false);
            setHighlightedIndex(-1);
            props.onKeyDown?.(event);
            return;
          }

          props.onKeyDown?.(event);
        }}
      />
      {opened && visibleSuggestions.length > 0 && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="suggestionMenu"
          style={{
            position: 'fixed',
            top: coords.top !== undefined ? `${coords.top}px` : 'auto',
            bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 99999,
          }}
        >
          {visibleSuggestions.map((suggestion, idx) => (
            <button
              key={`${suggestion}-${idx}`}
              type="button"
              className={`suggestionOption ${idx === highlightedIndex ? 'active' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                commitValue(suggestion);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              {suggestion}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
