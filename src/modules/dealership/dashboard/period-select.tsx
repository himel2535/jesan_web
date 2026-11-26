'use client';

/**
 * A period choice for one KPI card. A native `<select>` keeps keyboard and screen-reader
 * behaviour for free; it is 40px tall to meet the touch-target rule.
 */
export function PeriodSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="h-10 w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-surface)] px-2 text-sm text-[var(--dash-fg)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
