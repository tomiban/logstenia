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
  marker?: 'lime' | 'ink';
}

export interface AxisTickProps {
  x?: number | string;
  y?: number | string;
  index?: number;
  payload?: { value?: unknown };
  data?: ChartDatum[];
}

/** How many bars may skip their date label: a `dd/mm` under every bar collides on a 390px phone. */
function labelStride(count: number): number {
  return count > 8 ? Math.ceil(count / 6) : 1;
}

/**
 * Axis tick that prints the value above the date, with a marker for the current period. Every bar
 * keeps its value — that is the data — while the date is printed on a stride and always on the last
 * bar, so the axis stays legible at phone width.
 */
export function ValueTick({ x = 0, y = 0, index = 0, payload, data = [] }: AxisTickProps) {
  const item = data[index];
  const label = item?.label ?? (typeof payload?.value === 'string' ? payload.value : undefined);
  const stride = labelStride(data.length);
  /* Align the stride to the last bar: it always prints, and the label before it keeps its distance. */
  const showLabel = (data.length - 1 - index) % stride === 0;
  /* The first and last labels would hang off the plot area if they stayed centred. */
  const anchor = index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle';
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor={anchor} dy={12} className="metric text-foreground" fill="currentColor" fontSize={12}>
        {item?.amount ?? 0}
      </text>
      <text textAnchor={anchor} dy={26} className="label-status text-muted-foreground" fill="currentColor" fontSize={10}>
        {showLabel ? label : ''}
      </text>
      {item?.marker === 'lime' ? (
        <rect x={-4} y={32} width={8} height={8} fill="var(--voltage-lime)" />
      ) : item?.marker === 'ink' ? (
        <rect x={-4} y={32} width={8} height={8} className="fill-foreground" />
      ) : null}
    </g>
  );
}
