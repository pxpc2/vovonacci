"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from "recharts";

export default function GexChart({
  title,
  data, // [{ strike, pos, neg }]
  spot,
  callResistance,
  putSupport,
}: {
  title: string;
  data: Array<{ strike: number; pos: number; neg: number }>;
  spot: number;
  callResistance?: number | null;
  putSupport?: number | null;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[220px] rounded-2xl p-4 border border-neutral-800/60 flex items-center justify-center text-sm text-neutral-400">
        {title}: sem dados
      </div>
    );
  }

  // dark-mode friendly
  const fg = "var(--foreground)";
  const grid = "rgba(237,237,237,0.15)";
  const green = "#22c55e"; // positive GEX
  const red = "#ef4444"; // negative GEX

  const fmt = (v: number) =>
    Math.abs(v) >= 1e9
      ? (v / 1e9).toFixed(1) + "B"
      : (v / 1e6).toFixed(1) + "M";

  return (
    <div className="w-full h-[520px] rounded-2xl p-4 shadow border border-neutral-800/60 bg-[var(--background)]">
      <div className="text-sm font-medium mb-2" style={{ color: fg }}>
        {title}
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          layout="vertical"
          margin={{ left: 80, right: 120, top: 8, bottom: 8 }} // more room for ticks + labels
        >
          <CartesianGrid stroke={grid} />
          <XAxis
            type="number"
            tick={{ fill: fg, fontSize: 12 }}
            axisLine={{ stroke: grid }}
            tickLine={{ stroke: grid }}
            tickFormatter={fmt}
            tickMargin={8}
            domain={[0, "auto"]}
          />
          <YAxis
            type="category"
            dataKey="strike"
            width={88} // wider so numbers don't crowd
            tick={{ fill: fg, fontSize: 12 }}
            axisLine={{ stroke: grid }}
            tickLine={{ stroke: grid }}
            tickMargin={6}
            padding={{ top: 6, bottom: 6 }}
            interval="preserveStartEnd" // let Recharts skip crowded ticks
            reversed
          />
          <Tooltip
            contentStyle={{
              background: "#111",
              border: "1px solid #333",
              color: "#eee",
            }}
            labelStyle={{ color: "#ddd" }}
            formatter={(v: any) => [Number(v).toLocaleString(), "GEX"]}
          />
          <Legend wrapperStyle={{ color: fg }} />

          <Bar
            dataKey="pos"
            stackId="a"
            name="gex positivo"
            fill={green}
            fillOpacity={0.9}
            barSize={10}
          />
          <Bar
            dataKey="neg"
            stackId="a"
            name="gex negativo"
            fill={red}
            fillOpacity={0.9}
            barSize={10}
          />

          {spot && (
            <ReferenceLine
              y={spot}
              stroke="#a3a3a3"
              strokeDasharray="4 4"
              label={{
                value: `Spot ${spot}`,
                position: "right",
                fill: fg,
                fontSize: 12,
                dx: 6,
              }}
            />
          )}
          {callResistance && (
            <ReferenceLine
              y={callResistance}
              stroke="#ef4444"
              strokeDasharray="6 3"
              label={{
                value: `CR ${callResistance}`,
                position: "right",
                fill: fg,
                fontSize: 12,
                dx: 6,
              }}
            />
          )}
          {putSupport && (
            <ReferenceLine
              y={putSupport}
              stroke="#22c55e"
              strokeDasharray="6 3"
              label={{
                value: `PS ${putSupport}`,
                position: "right",
                fill: fg,
                fontSize: 12,
                dx: 6,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
