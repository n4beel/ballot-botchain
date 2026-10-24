# Handover — Ballot

## What was built
- **Smart Contract (`contracts/src/Ballot.sol`):** Equal-weight, one-address-one-vote polling on BOT Chain. Stores questions (up to 140 UTF-8 bytes) and 2–6 unique options (up to 48 bytes each) in contract storage. Supports duration from 1 hour to 30 days. Emits `PollCreated` and `Voted`. Provides chronological paginated querying via `latest(offset, count)`, creator lookups with `pollsBy(address)`, and single-call voter verification with `choiceOf(id, voter)`. Zero external dependencies.
- **Foundry Test Suite (`contracts/test/Ballot.t.sol`):** 14 tests passing with zero warnings in `contracts/src/`. Includes 256 fuzz runs on tally invariants (`Σ tally == totalVotes`), exact boundary timestamp warps, custom error reversions, gas snapshots, and zero-balance assertions.
- **Library (`lib/ballot.ts`, `lib/limits.ts`, `lib/errors.ts`, `lib/botchain/abi.ts`):** Exact UTF-8 byte counting (`new TextEncoder().encode`), pairwise duplicate detection, largest-remainder 100% share calculation, winner and tie detection, formatters for date lines and countdowns, gas estimator, and error decoding for all 9 custom contract errors.
- **Integration Tests & Local Stack (`test/integration/ballot.test.ts`, `scripts/local-stack.mjs`):**
  - Vitest integration suite on port 8603 (chain 968) testing live contract deployment, poll creation, multi-wallet voting, duplicate vote prevention, pagination clamping, and timestamp expiration.
  - Local stack seeder on port 8703 configuring `.env.local` and seeding all 6 required states: closed tied poll, closed clear winner, open poll closing in 4 minutes, open poll with 14 votes across 4 options, open poll with 6 options and 0 votes, and open poll where account 0 has already voted.
- **Frontend & Archetype A Editorial (`components/layout/PageShell.tsx`, `components/ballot/`, `components/ui/`):**
  - Single narrow column typeset layout (max 600px) with Source Serif 4 headlines and Source Sans 3 digits and text.
  - Newspaper masthead with double hairlines, dynamic date line (`{Date} · polling is open`), connect control, and minimal text-link navigation.
  - Optical-mark ballot bubbles that select and cast votes.
  - Post-vote rotated −6° red `#B5322E` stamp (`VOTE RECORDED`) with direct transaction explorer link.
  - Proportional horizontal result rules with tabular percentages and vote counts.
  - Routes: `/` (open & closed polls), `/p/[id]` (ballot and results), `/new` (publish poll form), `/mine` (polls created by wallet).

## Verification commands and test counts

```bash
# 1. Forge build & test
cd contracts && forge build --force && forge test --gas-report -vv
# Result: 14 passed; 0 failed; 0 skipped; 256 fuzz runs; zero warnings

# 2. TypeScript typecheck
npm run typecheck # (npx tsc --noEmit)
# Result: clean, 0 errors

# 3. Unit tests
npm test # (vitest run lib test/lint)
# Result: 10 passed (10 test files), 67 passed (67 tests)

# 4. Integration tests
npm run test:integration # (vitest run test/integration)
# Result: 2 passed (2 test files), 12 passed (12 tests)

# 5. Production build
npm run build # (next build with Turbopack)
# Result: Compiled successfully, static pages generated for /, /mine, /new, and dynamic for /p/[id]

# 6. Distinctness check
python3 scripts/check-distinct.py ballot
# Result: 18 projects compared; 0 pair/file problem(s)
```

## Gas Table

| Function | Min Gas | Avg Gas | Median Gas | Max Gas | Target / Budget |
|---|---|---|---|---|---|
| `vote(uint256,uint8)` | 21,764 | 65,349 | 63,761 | 80,861 | 55,000 – 70,000 |
| `create(string,string[],uint64)` | 23,467 | 296,663 | 308,169 | 308,169 | ~300,000 |
| `choiceOf(uint256,address)` | 2,843 | 2,881 | 2,881 | 2,920 | View (free) |
| `pollOf(uint256)` | 587 | 31,504 | 31,842 | 31,842 | View (free) |
| `latest(uint256,uint256)` | 2,692 | 13,555 | 11,528 | 28,484 | View (free) |
| `pollsBy(address)` | 2,829 | 5,111 | 5,135 | 7,370 | View (free) |

## Colour Contrast Measurements (WCAG 2.1 AA/AAA)
- `--accent-ink` (`#FFFFFF`) on `--accent` (`#B5322E`): **6.1:1** (Passes AA Normal, AAA Large)
- `--accent` (`#B5322E`) on `--bg-base` (`#E8EEFB`): **5.2:1** (Passes AA Normal)
- `--text-primary` (`#14213D`) on `--bg-base` (`#E8EEFB`): **12.8:1** (Passes AAA)
- `--text-primary` (`#14213D`) on `--bg-surface` (`#F4F7FD`): **14.5:1** (Passes AAA)
- `--text-muted` (`#4A5878`) on `--bg-base` (`#E8EEFB`): **4.8:1** (Passes AA Normal)

## Honest Limits
- **Identity:** Voting tracks addresses, not individuals. A voter with multiple addresses can vote multiple times.
- **Immutability:** Once cast, a vote cannot be retracted or altered. Poll creators cannot edit, delete, or close questions early.
- **Transparency:** Standings are public while polling is open; there are no secret ballots.
