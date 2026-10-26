import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";

export default function NotFound() {
  return (
    <PageShell title="Poll not found" description="The requested question or poll does not exist.">
      <Panel className="text-center py-12 space-y-4">
        <div className="text-4xl font-serif font-bold text-[var(--accent)]">404</div>
        <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
          Question Not Found
        </h3>
        <p className="text-xs text-[var(--text-muted)] font-serif italic">
          The poll record you are looking for does not exist or may have been removed.
        </p>
        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 text-xs font-serif uppercase tracking-wider rounded border border-[var(--border-strong)] hover:border-[var(--accent)] transition-colors"
          >
            ← Return to open polls
          </Link>
        </div>
      </Panel>
    </PageShell>
  );
}
