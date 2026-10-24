"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { app } from "@/lib/app-config";

export interface NavItem {
  href: string;
  label: string;
}

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  nav?: NavItem[];
}

function getEditorialDate(): string {
  const now = new Date();
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(now);
  const day = now.getDate();
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(now);
  return `${dayName} ${day} ${month}`;
}

export default function PageShell({ children, title, description }: PageShellProps) {
  const pathname = usePathname();
  const [dateLine, setDateLine] = useState("Polling is open");

  useEffect(() => {
    setDateLine(`${getEditorialDate()} · polling is open`);
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Newspaper Masthead */}
      <header className="pt-6 pb-4 px-4 max-w-[600px] w-full mx-auto">
        {/* Top double rule */}
        <div className="rule-double-strong mb-2" />

        {/* Masthead Title */}
        <div className="text-center py-2">
          <Link
            href="/"
            className="no-underline hover:text-[var(--text-primary)] text-inherit"
          >
            <h1 className="font-serif text-[42px] md:text-[54px] tracking-[0.08em] uppercase font-bold leading-none select-none">
              {app.name}
            </h1>
          </Link>
        </div>

        {/* Bottom double rule */}
        <div className="rule-double mb-2" />

        {/* Dateline & Connect row */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-1 text-[12px] text-[var(--text-muted)]">
          <div className="font-serif italic tracking-wide">
            {dateLine}
          </div>
          <div className="flex items-center gap-2">
            <NetworkBadge />
            <div className="w-[130px]">
              <ConnectButton />
            </div>
          </div>
        </div>

        {/* Hairline beneath dateline */}
        <div className="rule-hairline mt-1.5 mb-3" />

        {/* Minimal text-link navigation (separated by dot, no chrome) */}
        <nav className="flex items-center justify-center gap-2 text-[13px] font-sans tracking-wide">
          <Link
            href="/"
            className={`no-underline hover:underline ${
              pathname === "/" ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]"
            }`}
          >
            Open polls
          </Link>
          <span className="text-[var(--border-strong)]" aria-hidden="true">
            ·
          </span>
          <Link
            href="/new"
            className={`no-underline hover:underline ${
              pathname === "/new" ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]"
            }`}
          >
            Ask a question
          </Link>
          <span className="text-[var(--border-strong)]" aria-hidden="true">
            ·
          </span>
          <Link
            href="/mine"
            className={`no-underline hover:underline ${
              pathname === "/mine" ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]"
            }`}
          >
            My questions
          </Link>
        </nav>
      </header>

      {/* Main Column */}
      <main className="flex-1 w-full max-w-[600px] mx-auto px-4 py-4">
        {(title || description) && (
          <header className="mb-6">
            {title && (
              <h2 className="font-serif text-[28px] md:text-[34px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-[14px] leading-relaxed text-[var(--text-muted)] italic font-serif">
                {description}
              </p>
            )}
            <div className="rule-hairline mt-4" />
          </header>
        )}
        {children}
      </main>

      {/* Colophon Footer */}
      <footer className="w-full max-w-[600px] mx-auto px-4 py-8 mt-12 text-center text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
        <div className="rule-hairline mb-4" />
        <p className="font-serif">
          {app.name} · One wallet, one vote · Equal-weight polling on{" "}
          <a
            href="https://botchain.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--accent)]"
          >
            BOT Chain
          </a>{" "}
          (
          <a
            href="https://explorer.botchain.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--accent)]"
          >
            Explorer
          </a>
          )
        </p>
      </footer>
    </div>
  );
}
