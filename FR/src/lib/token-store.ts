const KEY = "strk-insurance-token-ids";

type Store = Record<string, number[]>; // address → token IDs

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function write(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function getTokenIds(address: string): number[] {
  return read()[address.toLowerCase()] ?? [];
}

export function addTokenId(address: string, tokenId: number) {
  const store = read();
  const key = address.toLowerCase();
  const existing = store[key] ?? [];
  if (!existing.includes(tokenId)) {
    store[key] = [...existing, tokenId];
    write(store);
  }
}
