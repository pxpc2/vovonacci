// app/components/GexChart.tsx
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
  Line,
} from "recharts";
import { useMemo } from "react";

export default function GexMassChart({
  title,
  data,
  spot,
  callResistance,
  putSupport,
  hvl,
  yDescending = true,
  normalizeBars = false,
  normalizeQuantile = 0.9,
}: {
  title: string;
  data: Array<{
    strike: number;
    call: number;
    put: number;
    cumScaled?: number;
  }>;
  spot: number;
  callResistance?: number | null;
  putSupport?: number | null;
  hvl?: number | null;
  yDescending?: boolean;
  normalizeBars?: boolean;
  normalizeQuantile?: number;
}) {
  const fg = "var(--foreground)";
  const grid = "rgba(237,237,237,0.15)";

  // Deep Sea (CALL) & Crimson (PUT)
  const CALL_FILL = "#0EA5A3";
  const CALL_STROKE = "#134E4A";
  const PUT_FILL = "#E11D48";
  const PUT_STROKE = "#7F1D1D";

  const amber = "#f59e0b";
  const purple = "#7c3aed";

  const merged =
    callResistance != null &&
    putSupport != null &&
    callResistance === putSupport;

  const sorted = useMemo(() => {
    const arr = Array.isArray(data) ? data : [];
    if (!arr.length) return [];
    return yDescending ? [...arr].sort((a, b) => b.strike - a.strike) : arr;
  }, [data, yDescending]);

  const dataWithBars = useMemo(() => {
    if (!normalizeBars || !sorted.length) return sorted;

    const mags: number[] = [];
    for (const d of sorted) {
      if (Number.isFinite(d.call)) mags.push(Math.abs(d.call));
      if (Number.isFinite(d.put)) mags.push(Math.abs(d.put));
    }
    if (!mags.length) return sorted;

    const q = (xs: number[], p: number) => {
      const a = [...xs].sort((x, y) => x - y);
      const t = (a.length - 1) * Math.min(Math.max(p, 0), 1);
      const lo = Math.floor(t),
        hi = Math.ceil(t);
      const w = t - lo;
      return (1 - w) * a[lo] + w * a[hi];
    };
    const cap = Math.max(1, q(mags, normalizeQuantile));
    const squash = (x: number) =>
      Math.sign(x) * cap * Math.log1p(Math.abs(x) / cap);

    return sorted.map((d) => ({
      ...d,
      callPlot: squash(d.call ?? 0),
      putPlot: squash(d.put ?? 0),
    }));
  }, [sorted, normalizeBars, normalizeQuantile]);

  const dataForChart = useMemo(() => {
    const arr = dataWithBars;
    if (!arr.length) return arr;

    if (!normalizeBars) return arr;

    const callKey = "callPlot" in arr[0] ? "callPlot" : "call";
    const putKey = "putPlot" in arr[0] ? "putPlot" : "put";

    const net = arr.map((d: any) => (d[callKey] ?? 0) + (d[putKey] ?? 0));

    let run = 0;
    const cum = net.map((v) => (run += v));

    const maxAbsCum = Math.max(1, ...cum.map((v) => Math.abs(v)));
    const maxBarAbs = Math.max(
      1,
      ...arr.map((d: any) =>
        Math.max(Math.abs(d[callKey] ?? 0), Math.abs(d[putKey] ?? 0))
      )
    );
    const scale = (maxBarAbs * 0.9) / maxAbsCum;

    return arr.map((d, i) => ({ ...d, cumPlotScaled: cum[i] * scale }));
  }, [dataWithBars, normalizeBars]);

  if (!dataForChart.length) {
    return (
      <div className="w-full rounded-2xl p-4 border border-neutral-800/60 flex items-center justify-center text-sm text-neutral-400">
        {title}: sem dados
      </div>
    );
  }

  const minStrike = Math.min(...dataForChart.map((d) => d.strike));
  const maxStrike = Math.max(...dataForChart.map((d) => d.strike));
  const hvlVisible =
    hvl != null && hvl >= minStrike && hvl <= maxStrike ? hvl : null;

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
        <div style={{ color: CALL_FILL }}>
          Call GEX: {fmtBig(Math.abs(call))}
        </div>
        <div style={{ color: PUT_FILL }}>Put GEX: {fmtBig(Math.abs(put))}</div>
        <div
          style={{ marginTop: 6, borderTop: "1px solid #333", paddingTop: 6 }}
        >
          Net GEX:{" "}
          <span style={{ color: net >= 0 ? CALL_FILL : PUT_FILL }}>
            {fmtBig(net)}
          </span>
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

  const hasCurvePlot =
    dataForChart.some((d: any) => typeof d.cumPlotScaled === "number") ||
    dataForChart.some((d: any) => typeof d.cumScaled === "number");

  return (
    <div className="w-full h-[520px] rounded-2xl p-4 shadow border border-neutral-800/60 bg-[var(--background)]">
      <div className="text-sm font-medium mb-2" style={{ color: fg }}>
        {title}
      </div>

      <ResponsiveContainer width="100%" height="100%" className={"pb-4"}>
        <ComposedChart
          data={dataForChart}
          layout="vertical"
          stackOffset="sign"
          margin={{ left: 80, right: 120, top: 8, bottom: 8 }}
        >
          <defs>
            <linearGradient id="callGrad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={CALL_FILL} stopOpacity={0.95} />
              <stop offset="100%" stopColor={CALL_FILL} stopOpacity={0.65} />
            </linearGradient>
            <linearGradient id="putGrad" x1="1" x2="0" y1="0" y2="0">
              <stop offset="0%" stopColor={PUT_FILL} stopOpacity={0.95} />
              <stop offset="100%" stopColor={PUT_FILL} stopOpacity={0.65} />
            </linearGradient>
          </defs>

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

          <Bar
            dataKey={normalizeBars ? "callPlot" : "call"}
            name="Call gamma"
            fill="url(#callGrad)"
            stroke={CALL_STROKE}
            strokeWidth={0.6}
            barSize={10}
          />
          <Bar
            dataKey={normalizeBars ? "putPlot" : "put"}
            name="Put gamma"
            fill="url(#putGrad)"
            stroke={PUT_STROKE}
            strokeWidth={0.6}
            barSize={10}
          />

          {hasCurvePlot && (
            <Line
              type="monotone"
              dataKey={normalizeBars ? "cumPlotScaled" : "cumScaled"}
              stroke={purple}
              dot={false}
              strokeWidth={1}
              name="Curva GEX"
            />
          )}

          {merged ? (
            <ReferenceLine
              y={callResistance as number}
              stroke={amber}
              strokeDasharray="2 4"
              strokeWidth={0.5}
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
                  stroke={PUT_FILL}
                  strokeDasharray="2 4"
                  strokeWidth={0.5}
                  label={labelProps(`CR @ ${callResistance}`, PUT_FILL)}
                />
              )}
              {putSupport != null && (
                <ReferenceLine
                  y={putSupport}
                  stroke={CALL_FILL}
                  strokeDasharray="2 4"
                  strokeWidth={0.5}
                  label={labelProps(`PS @ ${putSupport}`, CALL_FILL)}
                />
              )}
            </>
          )}

          {hvl != null &&
            hvl >= Math.min(...dataForChart.map((d) => d.strike)) &&
            hvl <= Math.max(...dataForChart.map((d) => d.strike)) && (
              <ReferenceLine
                y={hvl}
                stroke={purple}
                strokeDasharray="2 4"
                strokeWidth={1}
                label={labelProps(`HVL @ ${hvl}`, "#7e5ac4")}
              />
            )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
