/**
 * Protocol limits enforced by Ballot.sol.
 * These must match the contract constants exactly.
 */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const MAX_QUESTION_BYTES = 140;
export const MAX_OPTION_BYTES = 48;
export const MIN_DURATION = 3600; // 1 hour
export const MAX_DURATION = 2592000; // 30 days
export const MAX_PAGE = 50;
