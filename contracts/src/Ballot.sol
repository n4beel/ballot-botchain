// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title Ballot
/// @notice Equal-weight, one-address-one-vote polling on BOT Chain.
///
/// What it does:
/// - Anyone can create a poll with 2 to 6 options and a duration between 1 hour and 30 days.
/// - Anyone with a wallet can vote once per poll.
/// - Tallies and poll choices are public, live, and immutable.
///
/// What it deliberately cannot do:
/// - One vote per wallet, not per person: individuals with multiple wallets can vote multiple times.
/// - A vote cannot be changed, replaced, or withdrawn once cast.
/// - Results are visible while voting is open; late voters see active totals.
/// - No eligibility register, whitelist, or token requirement: anyone can vote.
/// - No editing, early closing, or deletion: polls run their full duration unconditionally.
contract Ballot {
  // --- Constants ---
  uint8 public constant MIN_OPTIONS = 2;
  uint8 public constant MAX_OPTIONS = 6;
  uint256 public constant MAX_QUESTION_BYTES = 140;
  uint256 public constant MAX_OPTION_BYTES = 48;
  uint64 public constant MIN_DURATION = 1 hours;
  uint64 public constant MAX_DURATION = 30 days;
  uint256 public constant MAX_PAGE = 50;

  // --- Structs ---
  struct Poll {
    address creator;
    uint64 closesAt;
    uint8 optionCount;
    uint64 createdAt;
    uint32 totalVotes;
    string question;
    string[] options;
    uint32[] tally;
  }

  struct PollView {
    address creator;
    uint64 closesAt;
    uint64 createdAt;
    uint32 totalVotes;
    bool open;
    string question;
    string[] options;
    uint32[] tally;
  }

  struct PollSummary {
    uint256 id;
    address creator;
    uint64 closesAt;
    uint32 totalVotes;
    bool open;
    string question;
  }

  // --- Storage ---
  mapping(uint256 => Poll) private _polls;
  mapping(uint256 => mapping(address => uint8)) private _choice; // option + 1; 0 = not voted
  mapping(address => uint256[]) private _pollsBy;
  uint256 public pollCount;

  // --- Events ---
  event PollCreated(uint256 indexed id, address indexed creator, uint64 closesAt, uint8 optionCount);
  event Voted(uint256 indexed id, address indexed voter, uint8 option);

  // --- Errors ---
  error BadQuestion(uint256 length, uint256 max);
  error BadOptionCount(uint256 n);
  error BadOption(uint256 index, uint256 length, uint256 max);
  error DuplicateOption(uint256 i, uint256 j);
  error BadDuration(uint64 duration);
  error NoSuchPoll(uint256 id);
  error PollClosed(uint256 id, uint64 closesAt);
  error BadChoice(uint8 option, uint8 count);
  error AlreadyVoted(uint256 id, uint8 previousOption);

  // --- Functions ---

  /// @notice Open a new poll
  /// @param question The poll question (1 to 140 UTF-8 bytes)
  /// @param options The answers (2 to 6 options, 1 to 48 bytes each, unique)
  /// @param duration Poll lifetime in seconds (1 hour to 30 days)
  /// @return id The sequential ID assigned to the new poll
  function create(
    string calldata question,
    string[] calldata options,
    uint64 duration
  ) external returns (uint256 id) {
    uint256 qLen = bytes(question).length;
    if (qLen == 0 || qLen > MAX_QUESTION_BYTES) {
      revert BadQuestion(qLen, MAX_QUESTION_BYTES);
    }

    uint256 optCount = options.length;
    if (optCount < MIN_OPTIONS || optCount > MAX_OPTIONS) {
      revert BadOptionCount(optCount);
    }

    // Verify option lengths and check for duplicates pairwise
    for (uint256 i = 0; i < optCount; i++) {
      uint256 oLen = bytes(options[i]).length;
      if (oLen == 0 || oLen > MAX_OPTION_BYTES) {
        revert BadOption(i, oLen, MAX_OPTION_BYTES);
      }

      bytes32 hashI = keccak256(bytes(options[i]));
      for (uint256 j = 0; j < i; j++) {
        if (hashI == keccak256(bytes(options[j]))) {
          revert DuplicateOption(j, i);
        }
      }
    }

    if (duration < MIN_DURATION || duration > MAX_DURATION) {
      revert BadDuration(duration);
    }

    id = ++pollCount;
    // forge-lint: disable-next-line(unsafe-typecast)
    uint64 nowTs = uint64(block.timestamp);
    uint64 closesAt = nowTs + duration;

    Poll storage p = _polls[id];
    p.creator = msg.sender;
    p.closesAt = closesAt;
    // forge-lint: disable-next-line(unsafe-typecast)
    p.optionCount = uint8(optCount);
    p.createdAt = nowTs;
    p.totalVotes = 0;
    p.question = question;
    for (uint256 i = 0; i < optCount; i++) {
      p.options.push(options[i]);
    }
    p.tally = new uint32[](optCount);

    _pollsBy[msg.sender].push(id);

    // forge-lint: disable-next-line(unsafe-typecast)
    emit PollCreated(id, msg.sender, closesAt, uint8(optCount));
  }

  /// @notice Cast a vote on a poll
  /// @param id Poll ID to vote on
  /// @param option Option index (0-indexed, up to optionCount - 1)
  function vote(uint256 id, uint8 option) external {
    if (id == 0 || id > pollCount) {
      revert NoSuchPoll(id);
    }

    Poll storage p = _polls[id];
    // forge-lint: disable-next-line(block-timestamp)
    if (block.timestamp >= p.closesAt) {
      revert PollClosed(id, p.closesAt);
    }

    if (option >= p.optionCount) {
      revert BadChoice(option, p.optionCount);
    }

    uint8 prevChoice = _choice[id][msg.sender];
    if (prevChoice != 0) {
      revert AlreadyVoted(id, prevChoice - 1);
    }

    _choice[id][msg.sender] = option + 1;
    p.tally[option]++;
    p.totalVotes++;

    emit Voted(id, msg.sender, option);
  }

  /// @notice Read full details and current tallies for a poll
  /// @param id Poll ID
  function pollOf(uint256 id) external view returns (PollView memory) {
    if (id == 0 || id > pollCount) {
      revert NoSuchPoll(id);
    }

    Poll storage p = _polls[id];
    // forge-lint: disable-next-line(block-timestamp)
    bool open = block.timestamp < p.closesAt;

    return PollView({
      creator: p.creator,
      closesAt: p.closesAt,
      createdAt: p.createdAt,
      totalVotes: p.totalVotes,
      open: open,
      question: p.question,
      options: p.options,
      tally: p.tally
    });
  }

  /// @notice Check if an address has voted on a poll and what option they selected
  /// @param id Poll ID
  /// @param voter Address to query
  function choiceOf(uint256 id, address voter) external view returns (bool voted, uint8 option) {
    uint8 c = _choice[id][voter];
    if (c == 0) {
      return (false, 0);
    }
    return (true, c - 1);
  }

  /// @notice Paginated list of recent polls in reverse chronological order (newest first)
  /// @param offset Number of latest polls to skip
  /// @param count Maximum number of summaries to return (clamped to MAX_PAGE)
  function latest(uint256 offset, uint256 count) external view returns (PollSummary[] memory) {
    if (offset >= pollCount) {
      return new PollSummary[](0);
    }

    if (count > MAX_PAGE) {
      count = MAX_PAGE;
    }

    uint256 available = pollCount - offset;
    uint256 n = count < available ? count : available;

    PollSummary[] memory items = new PollSummary[](n);
    for (uint256 i = 0; i < n; i++) {
      uint256 id = pollCount - offset - i;
      Poll storage p = _polls[id];
      items[i] = PollSummary({
        id: id,
        creator: p.creator,
        closesAt: p.closesAt,
        totalVotes: p.totalVotes,
        // forge-lint: disable-next-line(block-timestamp)
        open: block.timestamp < p.closesAt,
        question: p.question
      });
    }

    return items;
  }

  /// @notice List all poll IDs created by a given wallet
  /// @param who Creator address
  function pollsBy(address who) external view returns (uint256[] memory) {
    return _pollsBy[who];
  }
}
