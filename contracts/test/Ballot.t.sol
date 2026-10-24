// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {Ballot} from "../src/Ballot.sol";

contract BallotTest is Test {
  Ballot internal ballot;

  address internal alice = address(0xA11CE);
  address internal bob = address(0xB0B);
  address internal charlie = address(0xCAFE);

  event PollCreated(uint256 indexed id, address indexed creator, uint64 closesAt, uint8 optionCount);
  event Voted(uint256 indexed id, address indexed voter, uint8 option);

  function setUp() public {
    ballot = new Ballot();
    vm.warp(1_760_000_000);
  }

  function _sampleOptions2() internal pure returns (string[] memory) {
    string[] memory opts = new string[](2);
    opts[0] = "Yes";
    opts[1] = "No";
    return opts;
  }

  function _sampleOptions3() internal pure returns (string[] memory) {
    string[] memory opts = new string[](3);
    opts[0] = "Option Alpha";
    opts[1] = "Option Beta";
    opts[2] = "Option Gamma";
    return opts;
  }

  function test_CreateStoresEverything() public {
    string[] memory opts = _sampleOptions3();
    uint64 duration = 3 days;
    uint64 expectedClosesAt = uint64(block.timestamp) + duration;

    vm.prank(alice);
    vm.expectEmit(true, true, false, true, address(ballot));
    emit PollCreated(1, alice, expectedClosesAt, 3);

    uint256 id = ballot.create("Should we deploy to mainnet?", opts, duration);
    assertEq(id, 1);
    assertEq(ballot.pollCount(), 1);

    Ballot.PollView memory p = ballot.pollOf(1);
    assertEq(p.creator, alice);
    assertEq(p.closesAt, expectedClosesAt);
    assertEq(p.createdAt, uint64(block.timestamp));
    assertEq(p.totalVotes, 0);
    assertTrue(p.open);
    assertEq(p.question, "Should we deploy to mainnet?");
    assertEq(p.options.length, 3);
    assertEq(p.options[0], "Option Alpha");
    assertEq(p.options[1], "Option Beta");
    assertEq(p.options[2], "Option Gamma");
    assertEq(p.tally.length, 3);
    assertEq(p.tally[0], 0);
    assertEq(p.tally[1], 0);
    assertEq(p.tally[2], 0);
  }

  function test_CreateRejects_EmptyQuestion_LongQuestion_1Option_7Options_EmptyOption_LongOption_Duplicate_ShortDuration_LongDuration() public {
    string[] memory opts = _sampleOptions2();

    // 1. Empty question
    vm.expectRevert(abi.encodeWithSelector(Ballot.BadQuestion.selector, 0, 140));
    ballot.create("", opts, 1 hours);

    // 2. Long question (141 bytes)
    bytes memory longQ = new bytes(141);
    for (uint256 i = 0; i < 141; i++) longQ[i] = "a";
    vm.expectRevert(abi.encodeWithSelector(Ballot.BadQuestion.selector, 141, 140));
    ballot.create(string(longQ), opts, 1 hours);

    // 3. 1 Option (< 2)
    string[] memory oneOpt = new string[](1);
    oneOpt[0] = "Solo";
    vm.expectRevert(abi.encodeWithSelector(Ballot.BadOptionCount.selector, 1));
    ballot.create("Valid question?", oneOpt, 1 hours);

    // 4. 7 Options (> 6)
    string[] memory sevenOpts = new string[](7);
    for (uint256 i = 0; i < 7; i++) {
      sevenOpts[i] = string(abi.encodePacked("Opt ", vm.toString(i)));
    }
    vm.expectRevert(abi.encodeWithSelector(Ballot.BadOptionCount.selector, 7));
    ballot.create("Valid question?", sevenOpts, 1 hours);

    // 5. Empty option
    string[] memory emptyOpt = new string[](2);
    emptyOpt[0] = "Valid";
    emptyOpt[1] = "";
    vm.expectRevert(abi.encodeWithSelector(Ballot.BadOption.selector, 1, 0, 48));
    ballot.create("Valid question?", emptyOpt, 1 hours);

    // 6. Long option (49 bytes)
    string[] memory longOpt = new string[](2);
    longOpt[0] = "Valid";
    bytes memory opt49 = new bytes(49);
    for (uint256 i = 0; i < 49; i++) opt49[i] = "x";
    longOpt[1] = string(opt49);
    vm.expectRevert(abi.encodeWithSelector(Ballot.BadOption.selector, 1, 49, 48));
    ballot.create("Valid question?", longOpt, 1 hours);

    // 7. Duplicate option
    string[] memory dupOpts = new string[](3);
    dupOpts[0] = "Alpha";
    dupOpts[1] = "Beta";
    dupOpts[2] = "Alpha";
    vm.expectRevert(abi.encodeWithSelector(Ballot.DuplicateOption.selector, 0, 2));
    ballot.create("Valid question?", dupOpts, 1 hours);

    // 8. Short duration (< 1 hours)
    vm.expectRevert(abi.encodeWithSelector(Ballot.BadDuration.selector, 1 hours - 1));
    ballot.create("Valid question?", opts, 1 hours - 1);

    // 9. Long duration (> 30 days)
    vm.expectRevert(abi.encodeWithSelector(Ballot.BadDuration.selector, 30 days + 1));
    ballot.create("Valid question?", opts, 30 days + 1);
  }

  function test_VoteRecordsChoiceAndTally() public {
    uint256 id = ballot.create("Poll 1?", _sampleOptions3(), 1 days);

    vm.prank(alice);
    vm.expectEmit(true, true, false, true, address(ballot));
    emit Voted(id, alice, 1);
    ballot.vote(id, 1);

    Ballot.PollView memory p = ballot.pollOf(id);
    assertEq(p.totalVotes, 1);
    assertEq(p.tally[0], 0);
    assertEq(p.tally[1], 1);
    assertEq(p.tally[2], 0);

    (bool voted, uint8 opt) = ballot.choiceOf(id, alice);
    assertTrue(voted);
    assertEq(opt, 1);
  }

  function test_SecondVoteReverts_WithPrevious() public {
    uint256 id = ballot.create("Poll 1?", _sampleOptions3(), 1 days);

    vm.prank(alice);
    ballot.vote(id, 2);

    vm.prank(alice);
    vm.expectRevert(abi.encodeWithSelector(Ballot.AlreadyVoted.selector, id, 2));
    ballot.vote(id, 0);
  }

  function test_VoteAfterCloseReverts_AtBoundary() public {
    uint64 duration = 2 hours;
    uint256 id = ballot.create("Poll 1?", _sampleOptions2(), duration);
    uint64 closesAt = uint64(block.timestamp) + duration;

    // 1 second before close: succeeds
    vm.warp(closesAt - 1);
    vm.prank(alice);
    ballot.vote(id, 0);

    // Exactly at closesAt: reverts PollClosed
    vm.warp(closesAt);
    vm.prank(bob);
    vm.expectRevert(abi.encodeWithSelector(Ballot.PollClosed.selector, id, closesAt));
    ballot.vote(id, 1);

    // 1 second after closesAt: reverts PollClosed
    vm.warp(closesAt + 1);
    vm.prank(charlie);
    vm.expectRevert(abi.encodeWithSelector(Ballot.PollClosed.selector, id, closesAt));
    ballot.vote(id, 1);
  }

  function test_VoteBadChoice() public {
    uint256 id = ballot.create("Poll 1?", _sampleOptions3(), 1 days);

    vm.prank(alice);
    vm.expectRevert(abi.encodeWithSelector(Ballot.BadChoice.selector, 3, 3));
    ballot.vote(id, 3);
  }

  function test_NoSuchPoll_ForZeroAndTooHigh() public {
    vm.expectRevert(abi.encodeWithSelector(Ballot.NoSuchPoll.selector, 0));
    ballot.pollOf(0);

    vm.expectRevert(abi.encodeWithSelector(Ballot.NoSuchPoll.selector, 999));
    ballot.pollOf(999);

    vm.expectRevert(abi.encodeWithSelector(Ballot.NoSuchPoll.selector, 0));
    ballot.vote(0, 0);

    vm.expectRevert(abi.encodeWithSelector(Ballot.NoSuchPoll.selector, 999));
    ballot.vote(999, 0);
  }

  function test_ChoiceOf() public {
    uint256 id = ballot.create("Poll 1?", _sampleOptions3(), 1 days);

    // Before voting
    (bool votedAlice, uint8 optAlice) = ballot.choiceOf(id, alice);
    assertFalse(votedAlice);
    assertEq(optAlice, 0);

    // After voting
    vm.prank(alice);
    ballot.vote(id, 2);

    (votedAlice, optAlice) = ballot.choiceOf(id, alice);
    assertTrue(votedAlice);
    assertEq(optAlice, 2);

    // Bob still not voted
    (bool votedBob, uint8 optBob) = ballot.choiceOf(id, bob);
    assertFalse(votedBob);
    assertEq(optBob, 0);
  }

  function test_Latest_NewestFirst_Pagination_Clamp_Empty() public {
    // Empty state
    Ballot.PollSummary[] memory emptyRes = ballot.latest(0, 10);
    assertEq(emptyRes.length, 0);

    // Create 3 polls
    ballot.create("Poll 1?", _sampleOptions2(), 1 days);
    ballot.create("Poll 2?", _sampleOptions2(), 2 days);
    ballot.create("Poll 3?", _sampleOptions2(), 3 days);

    // Newest first
    Ballot.PollSummary[] memory latestAll = ballot.latest(0, 10);
    assertEq(latestAll.length, 3);
    assertEq(latestAll[0].id, 3);
    assertEq(latestAll[0].question, "Poll 3?");
    assertEq(latestAll[1].id, 2);
    assertEq(latestAll[1].question, "Poll 2?");
    assertEq(latestAll[2].id, 1);
    assertEq(latestAll[2].question, "Poll 1?");

    // Pagination: offset 1, count 1
    Ballot.PollSummary[] memory page = ballot.latest(1, 1);
    assertEq(page.length, 1);
    assertEq(page[0].id, 2);

    // Clamp: requested 100, clamped to MAX_PAGE (50) -> available 3 -> returns 3
    Ballot.PollSummary[] memory clamped = ballot.latest(0, 100);
    assertEq(clamped.length, 3);

    // Offset past end
    Ballot.PollSummary[] memory pastEnd = ballot.latest(3, 5);
    assertEq(pastEnd.length, 0);
  }

  function test_PollsBy() public {
    vm.prank(alice);
    ballot.create("Alice Poll 1", _sampleOptions2(), 1 days);

    vm.prank(bob);
    ballot.create("Bob Poll 1", _sampleOptions2(), 1 days);

    vm.prank(alice);
    ballot.create("Alice Poll 2", _sampleOptions2(), 1 days);

    uint256[] memory alicePolls = ballot.pollsBy(alice);
    assertEq(alicePolls.length, 2);
    assertEq(alicePolls[0], 1);
    assertEq(alicePolls[1], 3);

    uint256[] memory bobPolls = ballot.pollsBy(bob);
    assertEq(bobPolls.length, 1);
    assertEq(bobPolls[0], 2);

    uint256[] memory charliePolls = ballot.pollsBy(charlie);
    assertEq(charliePolls.length, 0);
  }

  function test_OpenFlagFlipsAtClosesAt() public {
    uint64 duration = 1 hours;
    uint256 id = ballot.create("Open Test", _sampleOptions2(), duration);
    uint64 closesAt = uint64(block.timestamp) + duration;

    // 1s before closesAt: open
    vm.warp(closesAt - 1);
    assertTrue(ballot.pollOf(id).open);
    assertTrue(ballot.latest(0, 1)[0].open);

    // exactly at closesAt: closed
    vm.warp(closesAt);
    assertFalse(ballot.pollOf(id).open);
    assertFalse(ballot.latest(0, 1)[0].open);

    // 1s after closesAt: closed
    vm.warp(closesAt + 1);
    assertFalse(ballot.pollOf(id).open);
    assertFalse(ballot.latest(0, 1)[0].open);
  }

  function testFuzz_TalliesSumToTotal(uint8 voterCount, uint8 seed) public {
    // Bound voter count to [1..30] to keep fuzzing execution fast and meaningful
    uint256 n = (uint256(voterCount) % 30) + 1;
    string[] memory opts = new string[](4);
    opts[0] = "A";
    opts[1] = "B";
    opts[2] = "C";
    opts[3] = "D";

    uint256 id = ballot.create("Fuzz Poll", opts, 10 days);

    for (uint256 i = 0; i < n; i++) {
      // forge-lint: disable-next-line(unsafe-typecast)
      address voter = address(uint160(0x1000 + i));
      // forge-lint: disable-next-line(unsafe-typecast)
      uint8 choice = uint8((uint256(keccak256(abi.encode(seed, i)))) % 4);
      vm.prank(voter);
      ballot.vote(id, choice);
    }

    Ballot.PollView memory p = ballot.pollOf(id);
    // forge-lint: disable-next-line(unsafe-typecast)
    assertEq(p.totalVotes, uint32(n));

    uint256 sumTallies = 0;
    for (uint256 i = 0; i < 4; i++) {
      sumTallies += p.tally[i];
    }
    assertEq(sumTallies, uint256(p.totalVotes));
  }

  function test_NoBalance() public {
    assertEq(address(ballot).balance, 0);
    // Reverts if someone tries to send ether
    (bool success,) = address(ballot).call{value: 1 ether}("");
    assertFalse(success);
  }

  function test_GasSnapshot() public {
    uint256 id = ballot.create("Gas Poll", _sampleOptions3(), 1 days);
    
    // First vote (cold storage writes: totalVotes, choice, tally)
    vm.prank(alice);
    uint256 gasBefore1 = gasleft();
    ballot.vote(id, 1);
    uint256 gasUsed1 = gasBefore1 - gasleft();
    assertLt(gasUsed1, 85_000);

    // Second vote (warm totalVotes, warm poll struct)
    vm.prank(bob);
    uint256 gasBefore2 = gasleft();
    ballot.vote(id, 1);
    uint256 gasUsed2 = gasBefore2 - gasleft();
    // Warm vote is ≈ 64k (< 70k target)
    assertLt(gasUsed2, 70_000);
  }
}
