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
import { useEffect, useMemo } from "react";

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
  const fg = "var(--foreground)";
  const grid = "rgba(237,237,237,0.15)";
  const green = "#22c55e";
  const red = "#ef4444";
  const amber = "#f59e0b";
  const neutral = "#a3a3a3";

  const merged =
    callResistance != null &&
    putSupport != null &&
    callResistance === putSupport;

  const sorted = useMemo(() => {
    const arr = Array.isArray(data) ? data : [];
    if (!arr.length) return [];
    return yDescending ? [...arr].sort((a, b) => b.strike - a.strike) : arr;
  }, [data, yDescending]);

  if (!sorted.length) {
    return (
      <div className="w-full rounded-2xl p-4 border border-neutral-800/60 flex items-center justify-center text-sm text-neutral-400">
        {title}: sem dados
      </div>
    );
  }

  const fmtAxis = (v: number) =>
    Math.abs(v) >= 1e9
      ? (v / 1e9).toFixed(1) + "B"
      : (v / 1e6).toFixed(1) + "M";

  function fmtBig(n: number) {
    const v = Math.abs(n);
    if (v >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return (n / 1e6).toFixed(2) + "M";
    return n.toLocaleString();
  }

  function MassTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as {
      strike: number;
      call: number;
      put: number;
    };
    const call = d.call ?? 0;
    const put = d.put ?? 0;
    const net = call + put;
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
        <div style={{ color: red }}>Call GEX: {fmtBig(Math.abs(call))}</div>
        <div style={{ color: green }}>Put GEX: {fmtBig(Math.abs(put))}</div>
        <div
          style={{ marginTop: 6, borderTop: "1px solid #333", paddingTop: 6 }}
        >
          Net GEX:{" "}
          <span style={{ color: net >= 0 ? red : green }}>{fmtBig(net)}</span>
        </div>
      </div>
    );
  }

  const labelProps = (text: string, color: string) => ({
    value: text,
    position: "right" as const,
    fill: color,
    fontSize: 12,
    dx: 6,
  });

  return (
    <div className="w-full h-[520px] rounded-2xl p-4 py-6 shadow border border-neutral-800/60 bg-[var(--background)]">
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
            tick={{ fill: fg, fontSize: 16 }}
            axisLine={{ stroke: grid }}
            tickLine={{ stroke: grid }}
            tickFormatter={fmtAxis}
            tickMargin={8}
          />
          <YAxis
            type="category"
            dataKey="strike"
            width={25}
            tick={{ fill: fg, fontSize: 16 }}
            axisLine={{ stroke: grid }}
            tickLine={{ stroke: grid }}
            tickMargin={6}
            padding={{ top: 6, bottom: 6 }}
            interval="preserveStartEnd"
          />
          <Tooltip content={<MassTooltip />} />
          <Legend wrapperStyle={{ color: fg }} />

          <Bar dataKey="call" name="Call gamma" fill={red} barSize={10} />
          <Bar dataKey="put" name="Put gamma" fill={green} barSize={10} />

          {spot && (
            <ReferenceLine
              y={spot}
              stroke={neutral}
              strokeDasharray="4 4"
              label={labelProps(`Spot @ ${spot}`, fg)}
            />
          )}

          {merged ? (
            <ReferenceLine
              y={callResistance as number}
              stroke={amber}
              strokeDasharray="6 3"
              strokeWidth={1.25}
              label={labelProps(
                `PS / CR @ ${(callResistance as number) || ""}`,
                amber
              )}
            />
          ) : (
            <>
              {callResistance != null && (
                <ReferenceLine
                  y={callResistance}
                  stroke={red}
                  strokeDasharray="6 3"
                  strokeWidth={1.25}
                  label={labelProps(`CR @ ${callResistance}`, red)}
                />
              )}
              {putSupport != null && (
                <ReferenceLine
                  y={putSupport}
                  stroke={green}
                  strokeDasharray="6 3"
                  strokeWidth={1.25}
                  label={labelProps(`PS @ ${putSupport}`, green)}
                />
              )}
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
