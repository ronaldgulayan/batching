import React, { useEffect, useState } from "react";
import { TextInput, CloseButton, type TextInputProps } from "@mantine/core";

export function parseDateShortcut(input: string): string {
  const clean = input.trim();
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  if (!clean) {
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  }

  const digits = clean.replace(/\D/g, "");
  const currentYear = today.getFullYear();

  const formatDateIfValid = (y: number, m: number, d: number): string | null => {
    if (m < 1 || m > 12) return null;
    const daysInMonth = new Date(y, m, 0).getDate();
    if (d < 1 || d > daysInMonth) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  };

  if (digits.length === 4) {
    const m = Number(digits.substring(0, 2));
    const d = Number(digits.substring(2, 4));
    const formatted = formatDateIfValid(currentYear, m, d);
    if (formatted) return formatted;
  } else if (digits.length === 6) {
    const m = Number(digits.substring(0, 2));
    const d = Number(digits.substring(2, 4));
    const yy = Number(digits.substring(4, 6));
    const y = 2000 + yy;
    const formatted = formatDateIfValid(y, m, d);
    if (formatted) return formatted;
  } else if (digits.length === 8) {
    const m = Number(digits.substring(0, 2));
    const d = Number(digits.substring(2, 4));
    const y = Number(digits.substring(4, 8));
    const formatted = formatDateIfValid(y, m, d);
    if (formatted) return formatted;
  }

  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = clean.match(isoRegex);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const formatted = formatDateIfValid(y, m, d);
    if (formatted) return formatted;
  }

  const parsedTime = Date.parse(clean);
  if (!isNaN(parsedTime)) {
    const parsedDate = new Date(parsedTime);
    return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
  }

  return `${currentYear}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

type Props = Omit<TextInputProps, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
};

export function DateShortcutInput({ value, onChange, clearable = false, ...props }: Props) {
  const [localVal, setLocalVal] = useState(value);

  // Synchronize internal input value with the value prop from parent
  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const commitValue = (val: string) => {
    if (!val.trim()) {
      if (clearable) {
        setLocalVal("");
        onChange("");
      } else {
        const formatted = parseDateShortcut("");
        setLocalVal(formatted);
        onChange(formatted);
      }
      return;
    }
    const formatted = parseDateShortcut(val);
    setLocalVal(formatted);
    onChange(formatted);
  };

  const handleBlur = () => {
    commitValue(localVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitValue(localVal);
    }
  };

  const rightSection = (clearable && localVal) ? (
    <CloseButton
      size="sm"
      onClick={() => {
        setLocalVal("");
        onChange("");
      }}
      aria-label="Clear date"
    />
  ) : null;

  return (
    <TextInput
      {...props}
      type="text"
      placeholder="e.g. 0721 or YYYY-MM-DD"
      value={localVal}
      onChange={(e) => setLocalVal(e.currentTarget.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      rightSection={rightSection}
    />
  );
}
