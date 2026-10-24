"use client";

import PageShell from "@/components/layout/PageShell";
import BotChainGate from "@/components/botchain/BotChainGate";
import CreatePollForm from "@/components/ballot/CreatePollForm";

export default function NewPollPage() {
  return (
    <PageShell
      title="Ask a Question"
      description="Record an immutable, equal-weight inquiry onto BOT Chain. Anyone with a wallet may vote once."
    >
      <BotChainGate
        noWalletNote="Reading open polls and viewing final results works without a wallet; publishing a new question requires signing a transaction on BOT Chain."
      >
        <CreatePollForm />
      </BotChainGate>
    </PageShell>
  );
}
