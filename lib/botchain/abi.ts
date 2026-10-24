/**
 * Hand-written, `as const` ABI for the Ballot contract.
 */
export const ballotAbi = [
  // --- Functions ---
  {
    type: "function",
    name: "create",
    stateMutability: "nonpayable",
    inputs: [
      { name: "question", type: "string" },
      { name: "options", type: "string[]" },
      { name: "duration", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "vote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "option", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "pollOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "closesAt", type: "uint64" },
          { name: "createdAt", type: "uint64" },
          { name: "totalVotes", type: "uint32" },
          { name: "open", type: "bool" },
          { name: "question", type: "string" },
          { name: "options", type: "string[]" },
          { name: "tally", type: "uint32[]" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "choiceOf",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [
      { name: "voted", type: "bool" },
      { name: "option", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "latest",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "count", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "creator", type: "address" },
          { name: "closesAt", type: "uint64" },
          { name: "totalVotes", type: "uint32" },
          { name: "open", type: "bool" },
          { name: "question", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "pollsBy",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "pollCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "MIN_OPTIONS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "MAX_OPTIONS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "MAX_QUESTION_BYTES",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "MAX_OPTION_BYTES",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "MIN_DURATION",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "MAX_DURATION",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "MAX_PAGE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },

  // --- Events ---
  {
    type: "event",
    name: "PollCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "closesAt", type: "uint64", indexed: false },
      { name: "optionCount", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Voted",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "voter", type: "address", indexed: true },
      { name: "option", type: "uint8", indexed: false },
    ],
  },

  // --- Errors ---
  {
    type: "error",
    name: "BadQuestion",
    inputs: [
      { name: "length", type: "uint256" },
      { name: "max", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "BadOptionCount",
    inputs: [{ name: "n", type: "uint256" }],
  },
  {
    type: "error",
    name: "BadOption",
    inputs: [
      { name: "index", type: "uint256" },
      { name: "length", type: "uint256" },
      { name: "max", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "DuplicateOption",
    inputs: [
      { name: "i", type: "uint256" },
      { name: "j", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "BadDuration",
    inputs: [{ name: "duration", type: "uint64" }],
  },
  {
    type: "error",
    name: "NoSuchPoll",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "PollClosed",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "closesAt", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "BadChoice",
    inputs: [
      { name: "option", type: "uint8" },
      { name: "count", type: "uint8" },
    ],
  },
  {
    type: "error",
    name: "AlreadyVoted",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "previousOption", type: "uint8" },
    ],
  },
] as const;

export const contractAbi = ballotAbi;
