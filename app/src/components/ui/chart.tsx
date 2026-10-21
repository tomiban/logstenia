// Chart primitives shared by the metrics and progress screens.
// Recharts renders SVG, so colors travel through `currentColor` (or a Tailwind
// fill-*/stroke-* class) to stay theme aware. Recharts' own props (fill/stroke on
// dots and bars) take literal colors, so those use the token vars directly.

export interface ChartTooltipEntry {
  value?: number | string;
  payload?: { label?: string };
}

export function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const caption = label ?? entry.payload?.label;
  return (
    <div className="border border-border bg-card px-3 py-2">
      {caption ? <div className="label-caps text-muted-foreground">{caption}</div> : null}
      <div className="metric text-base text-foreground">
        {entry.value}
        {unit ? <span className="label-caps ml-1 text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  );
}

export interface ChartDatum {
  label?: string;
  amount?: number;
  current?: boolean;
}

export interface AxisTickProps {
  x?: number | string;
  y?: number | string;
  index?: number;
  payload?: { value?: unknown };
  data?: ChartDatum[];
}

/** Axis tick that prints the value above the date, with a marker for the current period. */
export function ValueTick({ x = 0, y = 0, index = 0, payload, data = [] }: AxisTickProps) {
  const item = data[index];
  const label = item?.label ?? (typeof payload?.value === 'string' ? payload.value : undefined);
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" dy={12} className="metric text-foreground" fill="currentColor" fontSize={12}>
        {item?.amount ?? 0}
      </text>
      <text textAnchor="middle" dy={26} className="label-status text-muted-foreground" fill="currentColor" fontSize={10}>
        {label}
      </text>
      {item?.current ? <rect x={-4} y={32} width={8} height={8} fill="var(--voltage-lime)" /> : null}
    </g>
  );
}
