# Ballot

One wallet, one vote. Ask anything.

## What it does
Ballot provides equal-weight, censorship-resistant polling on BOT Chain:
- **Ask anything:** Anyone can publish a poll with 2 to 6 options and a lifetime between 1 hour and 30 days.
- **One wallet, one vote:** Any wallet on BOT Chain can cast exactly one immutable vote per poll.
- **On-chain storage:** Poll questions, options, and tallies are stored directly in contract storage and indexed via chronological query functions. The frontend never relies on fragile log-scraping for poll text.
- **Live tallies:** Voting results and shares update live on-chain with full transparency.

## What it deliberately cannot do
- **No identity or Sybil protection:** Voting is one vote per wallet, not one vote per human. Anyone controlling multiple addresses may cast multiple votes.
- **No vote modification or retraction:** Once cast, your choice is final and permanently recorded.
- **No secret ballots:** Standings and individual wallet choices are public on-chain while voting is open; late voters see the current distribution.
- **No editing or cancellation:** The creator cannot alter question text, options, or close a poll ahead of schedule. Polls run their full duration unconditionally.
- **No admin privileges:** The contract has no owner, no pausing mechanism, and no treasury.

## Gas consumption
- `vote(uint256 id, uint8 option)`:
  - Cold write (first vote on poll): **~80,861 gas**
  - Warm write (subsequent votes): **~63,761 gas**
  - Average: **~65,349 gas** (well within the 55k–70k design budget)
- `create(string question, string[] options, uint64 duration)`:
  - Average: **~296,663 gas** (for 3–4 options)

## Design Archetype
**Archetype A · Editorial (Newspaper Masthead Variant)**
- Typeset single narrow column (max 600px) with serif typography (Source Serif 4).
- Prominent masthead with double hairlines, live dateline (`{Date} · polling is open`), and understated text-link navigation.
- Optical-mark ballot bubbles for voting.
- Post-vote red `#B5322E` stamp (`VOTE RECORDED`) rotated −6° in a double-ruled box.
- Strict WCAG 2.1 AAA/AA contrast tokens: pale blue newsprint ground (`#E8EEFB`), navy ink (`#14213D`), and stamp red (`#B5322E`).
