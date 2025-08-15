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

export default function GexMassChart({
  title,
  data,
  spot,
  callResistance,
  putSupport,
  yDescending = true,
}: {
  title: string;
  data: Array<{ strike: number; call: number; put: number }>;
  spot: number;
  callResistance?: number | null;
  putSupport?: number | null;
  yDescending?: boolean;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[220px] rounded-2xl p-4 border border-neutral-800/60 flex items-center justify-center text-sm text-neutral-400">
        {title}: sem dados
      </div>
    );
  }

  const fg = "var(--foreground)";
  const grid = "rgba(237,237,237,0.15)";
  const green = "#22c55e"; // calls (direita)
  const red = "#ef4444"; // puts (esquerda)

  const fmt = (v: number) =>
    Math.abs(v) >= 1e9
      ? (v / 1e9).toFixed(1) + "B"
      : (v / 1e6).toFixed(1) + "M";

  const sorted = yDescending
    ? [...data].sort((a, b) => b.strike - a.strike)
    : data;

  function fmtBig(n: number) {
    const v = Math.abs(n);
    if (v >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return (n / 1e6).toFixed(2) + "M";
    return n.toLocaleString();
  }
  function MassTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as {
      strike: number;
      call: number;
      put: number;
    };
    const call = d.call ?? 0;
    const put = d.put ?? 0;
    const net = call + put; // net GEX

    return (
      <div
        style={{
          background: "#111",
          border: "1px solid #333",
          color: "#eee",
          padding: "8px 10px",
          borderRadius: 6,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{d.strike}</div>
        <div style={{ color: "#22c55e" }}>
          Call mass: {fmtBig(Math.abs(call))}
        </div>
        <div style={{ color: "#ef4444" }}>
          Put mass: {fmtBig(Math.abs(put))}
        </div>
        <div
          style={{ marginTop: 6, borderTop: "1px solid #333", paddingTop: 6 }}
        >
          Net GEX:{" "}
          <span style={{ color: net >= 0 ? "#22c55e" : "#ef4444" }}>
            {fmtBig(net)}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-[520px] rounded-2xl p-4 shadow border border-neutral-800/60 bg-[var(--background)]">
      <div className="text-sm font-medium mb-2" style={{ color: fg }}>
        {title}
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={sorted}
          layout="vertical"
          stackOffset="sign"
          margin={{ left: 80, right: 120, top: 8, bottom: 8 }}
        >
          <CartesianGrid stroke={grid} />
          <XAxis
            type="number"
            domain={["auto", "auto"]}
            tick={{ fill: fg, fontSize: 12 }}
            axisLine={{ stroke: grid }}
            tickLine={{ stroke: grid }}
            tickFormatter={fmt}
            tickMargin={8}
          />
          <YAxis
            type="category"
            dataKey="strike"
            width={88}
            tick={{ fill: fg, fontSize: 12 }}
            axisLine={{ stroke: grid }}
            tickLine={{ stroke: grid }}
            tickMargin={6}
            padding={{ top: 6, bottom: 6 }}
            interval="preserveStartEnd"
          />
          <Tooltip content={<MassTooltip />} />
          <Legend wrapperStyle={{ color: fg }} />

          <Bar dataKey="call" name="Call mass" fill={green} barSize={10} />
          <Bar dataKey="put" name="Put mass" fill={red} barSize={10} />

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
