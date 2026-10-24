import React, { HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  ruled?: boolean;
  highlight?: boolean;
  inset?: boolean;
}

/**
 * Editorial typeset panel for Ballot.
 * Flat surface with hairline newspaper borders, without shadows.
 */
export default function Panel({
  ruled,
  highlight,
  inset,
  children,
  className = "",
  style,
  ...props
}: PanelProps) {
  return (
    <section
      className={[
        "bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors",
        ruled
          ? "border-y border-[var(--border-subtle)] py-4 px-3"
          : "border border-[var(--border-subtle)] p-5",
        inset ? "bg-[var(--bg-base)]" : "",
        highlight ? "border-l-4 border-l-[var(--accent)]" : "",
        className,
      ].join(" ")}
      style={style}
      {...props}
    >
      {children}
    </section>
  );
}
