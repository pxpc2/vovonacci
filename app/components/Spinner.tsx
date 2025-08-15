"use client";

export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando…"
      className={`h-8 w-8 rounded-full border-2 border-neutral-700 border-t-indigo-500 animate-spin motion-reduce:animate-none ${className}`}
    />
  );
}
