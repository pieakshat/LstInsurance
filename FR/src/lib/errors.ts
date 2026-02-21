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
};

export function parseContractError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? "");

  // Starknet.js wraps revert reasons in various formats — try to extract them
  for (const [revert, friendly] of Object.entries(ERROR_MAP)) {
    if (message.includes(revert)) {
      return friendly;
    }
  }

  // Try to extract a quoted revert reason we didn't map
  const revertMatch = message.match(
    /(?:execution reverted|Error message:|Failure reason:)\s*"?([^"]+)"?/i,
  );
  if (revertMatch) {
    return revertMatch[1].trim();
  }

  if (message.includes("User abort") || message.includes("User rejected")) {
    return "Transaction rejected by user";
  }

  return "Transaction failed — please try again";
}
