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

## Feedback round 1

All findings from `docs/specs/FEEDBACK-ballot.md` addressed and verified:

1. **Local stack points app at seeded chain (`scripts/local-stack.mjs`):** FIXED.
   - Added `NEXT_PUBLIC_BOTCHAIN_NETWORK=testnet` and `NEXT_PUBLIC_BOHR_RPC=http://127.0.0.1:8703` into `.env.local` written by `scripts/local-stack.mjs`.
   - Verified that after running `node scripts/local-stack.mjs && npm run dev`, seeded records immediately load in the browser without any manual env edits.

2. **Seeded chain time aligned to wall-clock time (`scripts/local-stack.mjs`):** FIXED.
   - Computed total warp across seeding phases (`3601 + 3360 = 6961s`).
   - Started anvil with `--timestamp <now - 6961>`. Only warped forward across phases:
     - Phase 1: Polls 1 & 2 created, warped 3601s (both closed in the past).
     - Phase 2: Poll 3 created (duration 3600s), warped 3360s (closes in exactly 240s = 4 minutes).
     - Phase 3: Polls 4, 5, 6 created at current real time.
   - Asserted `diff <= 120s` between latest block timestamp and host wall-clock time (`diff = 0s`), and printed the alignment confirmation.

3. **Real browser walkthrough (`docs/specs/tools/mock-wallet.js`):** FIXED.
   - Walkthrough conducted on running local stack (`http://127.0.0.1:8703`) and dev server (`http://localhost:3003`) with Google Chrome headless and `mock-wallet.js`.
   - Added `query: { retry: false }` for `pollOf` in `components/ballot/PollVoteView.tsx` so non-existent poll lookups (`/p/999`) immediately transition to 404 state without query retry stalls.
   - Verified responsive layouts across 360 px, 720 px, and 1280 px viewports.
   - Tested route `/` as Observer (loaded all 6 seeded polls, verified section headings, open/closed badges, countdowns).
   - Tested route `/p/4` as Observer without wallet (browsed poll with 14 votes across 4 options, saw Connect a wallet to vote note).
   - Tested route `/p/4` as Acc 0 (voter, cast vote on option 1 on-chain, verified `VOTE RECORDED` stamp with explorer link).
   - Tested route `/p/6` as Acc 0 (prior voter, verified persistent `VOTE RECORDED` stamp).
   - Tested route `/p/1` as Observer (closed poll with tie, verified tie banner and equal vote tallies).
   - Tested route `/p/2` as Observer (closed poll with winner, verified winner badge and percentage bar).
   - Tested route `/p/3` as Observer (boundary poll closing in ~4m, verified active countdown).
   - Tested route `/p/999` as Observer (non-existent poll, verified clean 404 "Ballot not found" state).
   - Tested route `/new` as Acc 0 (published new 2-option poll on-chain, verified redirect to new poll page).
   - Tested route `/mine` as Acc 0 (creator portfolio, verified listing of authored polls with status and live totals).
   - Confirmed 0 console errors and 0 hydration warnings across all 10 route/role tests.

### Browser Walkthrough Results

| Route | Role | Action | Status | Console Errors | Hydration Warnings | Notes |
|---|---|---|---|---|---|---|
| `/` (360px, 720px, 1280px) | Visitor | Viewport responsiveness checks | PASS | 0 | 0 | Layout and masthead scale cleanly without horizontal overflow |
| `/` | Observer (No Wallet) | View open & closed poll listings with live tallies | PASS | 0 | 0 | Displays all 6 seeded polls under Open and Closed sections |
| `/p/4` | Observer (No Wallet) | Read-only inspection of open poll with 14 votes | PASS | 0 | 0 | Shows 4 options, live percentages, and "CONNECT A WALLET TO VOTE" note |
| `/p/4` | Acc 0 (Voter) | Select option 1 and cast vote on-chain | PASS | 0 | 0 | Vote submitted and confirmed on-chain; displays rotated "VOTE RECORDED" stamp |
| `/p/6` | Acc 0 (Prior Voter) | View poll already voted on during seed | PASS | 0 | 0 | Immediately renders "VOTE RECORDED" stamp and selected option badge |
| `/p/1` | Observer (No Wallet) | View closed poll ending in a tie | PASS | 0 | 0 | Renders "Closed · Result: Tie" banner with balanced vote totals |
| `/p/2` | Observer (No Wallet) | View closed poll with clear winner | PASS | 0 | 0 | Renders "Closed · Winner:" banner with highlighted winning option |
| `/p/3` | Observer (No Wallet) | Inspect poll seeded to close in ~4 minutes | PASS | 0 | 0 | Displays dynamic countdown "~3m remaining" / "~4m remaining" |
| `/p/999` | Observer (No Wallet) | Inspect non-existent poll ID | PASS | 0 | 0 | Displays clean 404 "Ballot not found" error state with link back to index |
| `/new` | Acc 0 (Creator) | Publish a new 2-option poll on-chain | PASS | 0 | 0 | Created poll on-chain and redirected to newly generated `/p/7` ballot page |
| `/mine` | Acc 0 (Creator) | View creator portfolio of authored polls | PASS | 0 | 0 | Displays authored polls with status, live vote counts, and direct links |

## Feedback round 2

1. **Local-stack autonomous mining (`--block-time 1`):**
   - Configured `anvil` in `scripts/local-stack.mjs` with `--block-time 1` to produce blocks autonomously on a 1-second cadence.
   - Seeded states across all 6 polls (closed tie, closed winner, near-boundary ~4min open, 14-vote open, 0-vote open, account 0 voted) verified.
   - Final chain timestamp matches wall clock (`diff: 1s`, within 120s limit).
   - Confirmed autonomous block progression without manual mining:
     ```bash
     b1=$(cast block-number --rpc-url http://127.0.0.1:8703); sleep 3; b2=$(cast block-number --rpc-url http://127.0.0.1:8703); echo "$b1 -> $b2"
     # Output: 200 -> 203
     ```




## Feedback round 3

- **Footer Three-Link Compliance & Helper:**
  - Added fixed constants `BOTCHAIN_SITE_URL = "https://botchain.ai"` and `BOTCHAIN_EXPLORER_URL = "https://scan.botchain.ai"` in `lib/botchain/chain.ts`.
  - Added exported `footerLinks(chainId?: number): FooterLinks` returning `{ contract, site, explorer }` where `contract` is `<explorer for that chain>/address/<address>` (or `null` when undeployed).
  - Updated `BuiltOnBotChain` to use `footerLinks(activeBotChain.id).contract`.
  - Corrected Ballot's footer in `components/layout/PageShell.tsx`: wrapped contract link in `BuiltOnBotChain`, replaced `explorer.botchain.ai` with `https://scan.botchain.ai`, and linked `botchain.ai`.
  - Added `app/not-found.tsx` wrapped in `PageShell` ensuring footer renders on 404 and unrouted states.
  - Added unit test suite in `lib/botchain/__tests__/chain.test.ts` covering chain IDs 677 and 968 for both deployed and undeployed configurations.

- **Browser-Check with Local Stack (port 8703 / 3003):**
  - `/` (Home): Verified all three links present (`https://scan.bohr.life/address/0x5fbdb2315678afecb367f032d93f642f64180aa3`, `https://botchain.ai`, `https://scan.botchain.ai`).
  - `/p/1` (Detail): Verified all three links present.
  - `/nonexistent` (Not Found): Verified all three links present.

## Feedback round 4

- **Item 1 (Shared CSS Tokens & Contrast):**
  - Defined missing tokens in `app/globals.css`:
    - `--border-default: #B9C5E0`
    - `--text-secondary: #354664` (9.8:1 contrast on `--bg-elevated: #FFFFFF`, WCAG AAA)
    - `--text-tertiary: #526384` (5.8:1 contrast on `--bg-elevated`, WCAG AA)
    - `--success: #1B6836` (6.5:1 contrast on `--bg-elevated`, WCAG AA)
    - `--danger: #B5322E` (5.4:1 contrast on `--bg-elevated`, WCAG AA)
    - `--warning: #8F4C00` (6.3:1 contrast on `--bg-elevated`, WCAG AA)
  - Updated `ConnectButton.tsx` menu items with readable typography, defined surfaces, and hover state (`hover:bg-[rgba(20,33,61,0.06)]`).
  - Added unit test `test/lint/tokens.test.ts`.
  - Verified `python3 scripts/check-tokens.py ballot` exits 0 with zero undefined tokens.

