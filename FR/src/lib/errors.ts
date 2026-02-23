const ERROR_MAP: Record<string, string> = {
  "Protocol not active": "This protocol is currently paused",
  "Exceeds coverage cap": "Maximum coverage limit reached for this protocol",
  "Premium too small": "Coverage amount too small — increase amount or duration",
  "No vault shares": "You must deposit into the vault first",
  "Already checkpointed": "Already registered for this epoch",
  "Epoch not finalized": "This epoch hasn't ended yet",
  "Already claimed": "Already claimed for this epoch",
  "Not NFT owner": "You don't own this coverage policy",
  "Claim not pending": "This claim has already been resolved",
  "ERC4626: exceeds max withdraw":
    "Amount exceeds available balance — capital is locked for active coverage",
  "ERC4626: exceeds max deposit": "Vault deposit limit reached",
  "Exceeds vault liquidity": "Not enough liquidity in the vault — LPs need to deposit first",
  "Exceeds total assets": "Not enough liquidity in the vault — LPs need to deposit first",
  "Caller is missing role": "Permission error — wallet may not be the contract owner",
  "Coverage still active": "Coverage has not expired yet",
  "Coverage must be > 0": "Coverage amount must be greater than zero",
  "Duration must be > 0": "Duration must be greater than zero",
  "Protocol does not exist": "Protocol not found — re-run Register Protocol or check Protocol ID",
  "Vault already deployed": "Vault already exists for this protocol ID",
  "Protocol already registered": "This protocol address was already registered",
  "Invalid asset address": "Invalid underlying asset address",
};

export function parseContractError(error: unknown): string {
  // Build a single string from the full error chain so we can pattern-match
  // regardless of where the revert reason is nested.
  const parts: string[] = [];

  function collect(e: unknown) {
    if (!e) return;
    if (typeof e === "string") { parts.push(e); return; }
    if (typeof e !== "object") { parts.push(String(e)); return; }
    const obj = e as Record<string, unknown>;
    if (obj.message) parts.push(String(obj.message));
    if (obj.data) parts.push(typeof obj.data === "string" ? obj.data : JSON.stringify(obj.data));
    if (obj.cause) collect(obj.cause);
  }

  collect(error);
  const message = parts.join(" ");

  // ── Starknet simulation / node error formats ────────────────────────────────
  // Format 1: 0x... ('Decoded error string') — hex felt with ASCII in parens
  const parenMatch = message.match(/\('([^']+)'\)/);
  if (parenMatch) {
    const reason = parenMatch[1].trim();
    return ERROR_MAP[reason] ?? reason;
  }

  // Format 2: Failure reason: 'Error string' or Failure reason: "Error string"
  const failureMatch = message.match(/Failure reason:\s*['"]?([^'".\n]+)['"]?/i);
  if (failureMatch) {
    const reason = failureMatch[1].trim();
    return ERROR_MAP[reason] ?? reason;
  }

  // Format 3: Error message: 'Error string'
  const errMsgMatch = message.match(/Error message:\s*['"]?([^'".\n]+)['"]?/i);
  if (errMsgMatch) {
    const reason = errMsgMatch[1].trim();
    return ERROR_MAP[reason] ?? reason;
  }

  // ── Check ERROR_MAP for any known phrase in the full message ────────────────
  for (const [revert, friendly] of Object.entries(ERROR_MAP)) {
    if (message.includes(revert)) return friendly;
  }

  // ── Generic wallet/user signals ─────────────────────────────────────────────
  if (
    message.includes("User abort") ||
    message.includes("User rejected") ||
    message.includes("user reject") ||
    message.includes("user denied")
  ) {
    return "Transaction rejected by user";
  }

  if (
    message.includes("argent/multicall-failed") ||
    message.includes("multicall failed") ||
    message.includes("Multicall failed")
  ) {
    return "Transaction simulation failed — check inputs and try again";
  }

  return "Transaction failed — please try again";
}
