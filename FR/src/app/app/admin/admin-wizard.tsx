"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useProvider } from "@starknet-react/core";
import type { Abi } from "starknet";
import { useToast } from "../toast";
import { REGISTRY_ABI } from "@/lib/abis/registry";
import { FACTORY_ABI } from "@/lib/abis/factory";
import { useTxStep } from "@/lib/hooks/use-tx-step";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SystemConfig {
  registry: string;
  factory: string;
  coverageToken: string;
  underlyingAsset: string; // BTC-LST — vault collateral
  premiumAsset: string;    // USDC — token users pay premiums in
}

interface ProtocolMeta {
  protocolName: string;
  insuranceName: string;
  description: string;
  logoUrl: string;
  coverageCap: string;
  premiumRate: string;
  protocolAddress: string;
  vaultName: string;
  vaultSymbol: string;
  depositLimit: string;
}

type Step = 0 | 1 | 2 | 3 | 4;

const STEP_LABELS = [
  "System Config",
  "Protocol Metadata",
  "Register & Deploy",
  "Wire Permissions",
  "Save to DB",
];

const STORAGE_KEY = "strk-insurance-admin-config";

const DEFAULT_CONFIG: SystemConfig = {
  registry:        "0x0563e74e88ce4cdf5ddf734e62fff92057a52a910d7d9b000c539dd41154ffb9",
  factory:         "0x01c96db2bb1b22769d99bac9f1a65f93a21ac8e6fc264bb400971054a5971a6c",
  coverageToken:   "0x07a14e6784c54b06fafcb3242da1e12ed4ea8dbfca2fa36acae2ecdcf0bae118",
  underlyingAsset: "0x02579f9dc11305ff5b300babde1ee79176a6d58c0f0a022c992ce3f8195b65ee",
  premiumAsset:    "0x04621e68e8784928870a619f405e807cf061096f301eb8b7c1fee7dc35bef91a",
};

const U128_MASK = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
const SHIFT_128 = BigInt(128);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadConfig(): SystemConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved: SystemConfig = JSON.parse(raw);
      // If the saved registry address is stale (doesn't match what's deployed),
      // discard it and use the defaults — avoids cross-registry permission bugs
      // where set_governance goes to the old registry but the factory uses the new one.
      if (saved.registry !== DEFAULT_CONFIG.registry) {
        localStorage.removeItem(STORAGE_KEY);
        return DEFAULT_CONFIG;
      }
      return saved;
    }
  } catch { }
  return DEFAULT_CONFIG;
}

function saveConfig(config: SystemConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(addr);
}

/** Split a BigInt into u256 calldata (low, high) as strings. */
function u256Calldata(value: bigint): [string, string] {
  return [String(value & U128_MASK), String(value >> SHIFT_128)];
}

/**
 * Encode a string as Cairo ByteArray calldata.
 * ByteArray = { data: Array<felt252>, pending_word: felt252, pending_word_len: u32 }
 */
function encodeByteArray(str: string): string[] {
  const bytes = new TextEncoder().encode(str);
  const fullWords: bigint[] = [];
  let i = 0;

  while (i + 31 <= bytes.length) {
    let word = BigInt(0);
    for (let j = 0; j < 31; j++) {
      word = (word << BigInt(8)) | BigInt(bytes[i + j]);
    }
    fullWords.push(word);
    i += 31;
  }

  const pendingLen = bytes.length - i;
  let pendingWord = BigInt(0);
  for (let j = 0; j < pendingLen; j++) {
    pendingWord = (pendingWord << BigInt(8)) | BigInt(bytes[i + j]);
  }

  return [
    String(fullWords.length),
    ...fullWords.map(String),
    String(pendingWord),
    String(pendingLen),
  ];
}

function toHexAddr(val: unknown): string {
  if (typeof val === "bigint") return "0x" + val.toString(16);
  if (typeof val === "string") return val;
  if (typeof val === "number") return "0x" + val.toString(16);
  return String(val ?? "");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border ${i < current
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
              : i === current
                ? "bg-white/10 border-white/30 text-white"
                : "border-neutral-700 text-neutral-500"
              }`}
          >
            {i < current ? "\u2713" : i + 1}
          </div>
          <span
            className={`text-xs hidden sm:inline ${i === current ? "text-white" : "text-neutral-500"
              }`}
          >
            {label}
          </span>
          {i < STEP_LABELS.length - 1 && (
            <div className="w-4 h-px bg-neutral-700" />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block mb-4">
      <span className="text-sm text-neutral-300 mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 disabled:opacity-50"
      />
      {hint && <span className="text-xs text-neutral-500 mt-1 block">{hint}</span>}
    </label>
  );
}

function TxButton({
  label,
  onClick,
  disabled,
  status,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  status?: "idle" | "pending" | "confirming" | "done" | "error";
}) {
  const statusText: Record<string, string> = {
    pending: "Sign in wallet...",
    confirming: "Confirming...",
    done: "Done",
    error: "Failed",
  };

  return (
    <div className="flex items-center gap-3 mb-3">
      <button
        onClick={onClick}
        disabled={disabled || status === "pending" || status === "confirming" || status === "done"}
        className="px-4 py-2 text-sm rounded font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white text-black hover:bg-neutral-200"
      >
        {label}
      </button>
      {status && status !== "idle" && (
        <span
          className={`text-xs ${status === "done"
            ? "text-emerald-400"
            : status === "error"
              ? "text-red-400"
              : "text-neutral-400"
            }`}
        >
          {statusText[status] ?? ""}
        </span>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-400">{label}</span>
      <span className={mono ? "font-mono text-neutral-200 text-xs" : "text-white"}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Wizard
// ---------------------------------------------------------------------------

export function AdminWizard() {
  const { status: accountStatus, address: accountAddress } = useAccount();
  const { provider } = useProvider();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(0);

  // Step 0: System config
  const [config, setConfig] = useState<SystemConfig>(loadConfig);

  // Step 1: Protocol metadata
  const [meta, setMeta] = useState<ProtocolMeta>({
    protocolName: "",
    insuranceName: "",
    description: "",
    logoUrl: "",
    coverageCap: "",
    premiumRate: "",
    protocolAddress: "",
    vaultName: "",
    vaultSymbol: "",
    depositLimit: "",
  });

  // Step 2: Deployed addresses
  const [protocolId, setProtocolId] = useState<string>("");
  const [vaultAddress, setVaultAddress] = useState<string>("");
  const [premiumModuleAddress, setPremiumModuleAddress] = useState<string>("");
  const [claimsManagerAddress, setClaimsManagerAddress] = useState<string>("");

  // Step 3: Permission wiring completion flags
  const [minterDone, setMinterDone] = useState(false);
  const [depositLimitDone, setDepositLimitDone] = useState(false);
  const [coverageManagerDone, setCoverageManagerDone] = useState(false);
  const [claimsManagerDone, setClaimsManagerDone] = useState(false);
  const [burnerDone, setBurnerDone] = useState(false);
  const [governorDone, setGovernorDone] = useState(false);

  // Step 3: governor address input (defaults to connected wallet)
  const [governorAddress, setGovernorAddress] = useState("");

  // Step 4: DB save
  const [saved, setSaved] = useState(false);

  // Transaction steps
  const registerTx = useTxStep();
  const createVaultTx = useTxStep();
  const setMinterTx = useTxStep();
  const setDepositLimitTx = useTxStep();
  const setCoverageManagerTx = useTxStep();
  const setClaimsManagerTx = useTxStep();
  const setBurnerTx = useTxStep();
  const addGovernorTx = useTxStep();
  const expireTx = useTxStep();
  const claimActionTx = useTxStep();

  // Claims review maintenance state
  const [reviewProtocolIdx, setReviewProtocolIdx] = useState(0);
  const [reviewProtocols, setReviewProtocols] = useState<Array<{ name: string; cm: string }>>([]);
  const [reviewClaims, setReviewClaims] = useState<Array<{
    claim_id: number; token_id: number; claimant: string;
    coverage_amount: string; status: number; submitted_at: number;
  }>>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [actioningClaimId, setActioningClaimId] = useState<number | null>(null);

  // Expire coverage tool state
  const [expirePmAddress, setExpirePmAddress] = useState("");
  const [expireTokenId, setExpireTokenId] = useState("");

  // ---- Read protocol_count after registration tx ----
  const { data: protocolCount, refetch: refetchCount } = useReadContract({
    abi: REGISTRY_ABI as Abi,
    address: config.registry as `0x${string}`,
    functionName: "protocol_count",
    args: [],
    enabled: !!config.registry && registerTx.status === "done",
  });

  useEffect(() => {
    if (registerTx.status === "done") {
      const timer = setTimeout(() => refetchCount(), 3000);
      return () => clearTimeout(timer);
    }
  }, [registerTx.status, refetchCount]);

  useEffect(() => {
    if (protocolCount !== undefined && registerTx.status === "done" && !protocolId) {
      // starknet-react may return u256 as a plain bigint or as {low, high} struct
      let id: string;
      if (typeof protocolCount === "bigint") {
        id = String(protocolCount);
      } else if (
        typeof protocolCount === "object" &&
        protocolCount !== null &&
        "low" in (protocolCount as object)
      ) {
        const r = protocolCount as { low: unknown; high: unknown };
        const v = (BigInt(String(r.high)) << SHIFT_128) | BigInt(String(r.low));
        id = String(v);
      } else {
        id = String(protocolCount);
      }
      setProtocolId(id);
      toast(`Protocol registered with ID ${id}`, "success");
    }
  }, [protocolCount, registerTx.status, protocolId, toast]);

  // ---- Read vault + PM addresses after create_vault tx ----
  const pidNum = Number(protocolId) || 0;

  const { data: vaultAddr, refetch: refetchVault } = useReadContract({
    abi: FACTORY_ABI as Abi,
    address: config.factory as `0x${string}`,
    functionName: "get_vault",
    args: [{ low: pidNum, high: 0 }],
    enabled: !!config.factory && !!protocolId && createVaultTx.status === "done",
  });

  const { data: pmAddr, refetch: refetchPM } = useReadContract({
    abi: FACTORY_ABI as Abi,
    address: config.factory as `0x${string}`,
    functionName: "get_premium_module",
    args: [{ low: pidNum, high: 0 }],
    enabled: !!config.factory && !!protocolId && createVaultTx.status === "done",
  });

  const { data: cmAddr, refetch: refetchCM } = useReadContract({
    abi: FACTORY_ABI as Abi,
    address: config.factory as `0x${string}`,
    functionName: "get_claims_manager",
    args: [{ low: pidNum, high: 0 }],
    enabled: !!config.factory && !!protocolId && createVaultTx.status === "done",
  });

  useEffect(() => {
    if (createVaultTx.status === "done") {
      const timer = setTimeout(() => {
        refetchVault();
        refetchPM();
        refetchCM();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [createVaultTx.status, refetchVault, refetchPM, refetchCM]);

  useEffect(() => {
    if (vaultAddr && createVaultTx.status === "done" && !vaultAddress) {
      setVaultAddress(toHexAddr(vaultAddr));
    }
  }, [vaultAddr, createVaultTx.status, vaultAddress]);

  useEffect(() => {
    if (pmAddr && createVaultTx.status === "done" && !premiumModuleAddress) {
      setPremiumModuleAddress(toHexAddr(pmAddr));
    }
  }, [pmAddr, createVaultTx.status, premiumModuleAddress]);

  useEffect(() => {
    if (cmAddr && createVaultTx.status === "done" && !claimsManagerAddress) {
      setClaimsManagerAddress(toHexAddr(cmAddr));
    }
  }, [cmAddr, createVaultTx.status, claimsManagerAddress]);

  // Track permission tx completions
  useEffect(() => {
    if (setMinterTx.status === "done") setMinterDone(true);
  }, [setMinterTx.status]);
  useEffect(() => {
    if (setDepositLimitTx.status === "done") setDepositLimitDone(true);
  }, [setDepositLimitTx.status]);
  useEffect(() => {
    if (setCoverageManagerTx.status === "done") setCoverageManagerDone(true);
  }, [setCoverageManagerTx.status]);
  useEffect(() => {
    if (setClaimsManagerTx.status === "done") setClaimsManagerDone(true);
  }, [setClaimsManagerTx.status]);
  useEffect(() => {
    if (setBurnerTx.status === "done") setBurnerDone(true);
  }, [setBurnerTx.status]);
  useEffect(() => {
    if (addGovernorTx.status === "done") setGovernorDone(true);
  }, [addGovernorTx.status]);

  // Default governor address to connected wallet
  useEffect(() => {
    if (accountAddress && !governorAddress) setGovernorAddress(accountAddress);
  }, [accountAddress, governorAddress]);

  // Load protocols for claims review
  useEffect(() => {
    fetch("/api/protocols")
      .then((r) => r.json())
      .then((data: Array<{ protocol_name: string; claims_manager_address?: string }>) => {
        if (!Array.isArray(data)) return;
        setReviewProtocols(
          data
            .filter((p) => p.claims_manager_address && p.claims_manager_address !== "0x0")
            .map((p) => ({ name: p.protocol_name, cm: p.claims_manager_address! }))
        );
      })
      .catch(console.error);
  }, []);

  // ---- Guards ----
  if (accountStatus !== "connected") {
    return (
      <div className="text-center text-neutral-400 py-16">
        Connect your wallet to access the admin panel.
      </div>
    );
  }

  // ---- Actions ----

  function handleRegister() {
    if (!accountAddress) { toast("Wallet not connected", "error"); return; }
    const capWei = BigInt(Math.floor(Number(meta.coverageCap) * 1e18));
    const rateBps = BigInt(Math.round(Number(meta.premiumRate) * 100));
    const [capLow, capHigh] = u256Calldata(capWei);
    const [rateLow, rateHigh] = u256Calldata(rateBps);

    registerTx.execute([
      {
        // Registry constructor only grants OWNER_ROLE, not GOVERNANCE_ROLE.
        // Grant GOVERNANCE_ROLE to the connected wallet first so register_protocol succeeds.
        contractAddress: config.registry,
        entrypoint: "set_governance",
        calldata: [accountAddress as string],
      },
      {
        contractAddress: config.registry,
        entrypoint: "register_protocol",
        calldata: [meta.protocolAddress, "0x0", capLow, capHigh, rateLow, rateHigh],
      },
    ]);
  }

  function handleCreateVault() {
    const pid = BigInt(protocolId);
    if (pid === 0n) { toast("Protocol ID is 0 — registration may not have confirmed yet", "error"); return; }
    const [pidLow, pidHigh] = u256Calldata(pid);

    console.log("[createVault] registry:", config.registry, "factory:", config.factory);
    console.log("[createVault] protocolId:", protocolId, "pidLow:", pidLow, "pidHigh:", pidHigh);
    console.log("[createVault] underlyingAsset:", config.underlyingAsset);

    createVaultTx.execute([
      {
        // Grant factory GOVERNANCE_ROLE on registry so the internal
        // registry.set_vault() call inside create_vault() doesn't revert.
        contractAddress: config.registry,
        entrypoint: "set_governance",
        calldata: [config.factory],
      },
      {
        contractAddress: config.factory,
        entrypoint: "create_vault",
        calldata: [
          pidLow,
          pidHigh,
          ...encodeByteArray(meta.vaultName),
          ...encodeByteArray(meta.vaultSymbol),
          config.underlyingAsset,
        ],
      },
    ]);
  }

  function handleSetMinter() {
    setMinterTx.execute([
      {
        contractAddress: config.coverageToken,
        entrypoint: "set_minter",
        calldata: [premiumModuleAddress],
      },
    ]);
  }

  function handleSetDepositLimit() {
    const limitWei = BigInt(Math.floor(Number(meta.depositLimit) * 1e18));
    const [limLow, limHigh] = u256Calldata(limitWei);

    setDepositLimitTx.execute([
      {
        contractAddress: vaultAddress,
        entrypoint: "set_deposit_limit",
        calldata: [limLow, limHigh],
      },
    ]);
  }

  function handleSetCoverageManager() {
    setCoverageManagerTx.execute([
      {
        contractAddress: vaultAddress,
        entrypoint: "set_coverage_manager",
        calldata: [premiumModuleAddress],
      },
    ]);
  }

  function handleSetClaimsManager() {
    setClaimsManagerTx.execute([
      {
        contractAddress: vaultAddress,
        entrypoint: "set_claims_manager",
        calldata: [claimsManagerAddress],
      },
    ]);
  }

  function handleSetBurner() {
    setBurnerTx.execute([
      {
        contractAddress: config.coverageToken,
        entrypoint: "set_burner",
        calldata: [claimsManagerAddress],
      },
    ]);
  }

  function handleAddGovernor() {
    if (!isValidAddress(governorAddress)) { toast("Enter a valid governor address", "error"); return; }
    addGovernorTx.execute([
      {
        contractAddress: claimsManagerAddress,
        entrypoint: "add_governor",
        calldata: [governorAddress],
      },
    ]);
  }

  async function handleLoadClaims() {
    const selected = reviewProtocols[reviewProtocolIdx];
    if (!selected || !provider) return;
    setReviewLoading(true);
    setReviewClaims([]);
    try {
      const SHIFT = 128n;
      function parseU256r(felts: string[], off = 0): bigint {
        return (BigInt(felts[off + 1] ?? "0") << SHIFT) | BigInt(felts[off] ?? "0");
      }

      const nextFelts = await provider.callContract({
        contractAddress: selected.cm,
        entrypoint: "next_claim_id",
        calldata: [],
      }, "latest");
      const nextId = Number(parseU256r(nextFelts, 0));
      if (nextId <= 1) { setReviewClaims([]); return; }

      const results = await Promise.all(
        Array.from({ length: nextId - 1 }, (_, i) => i + 1).map(async (id) => {
          try {
            const felts = await provider.callContract({
              contractAddress: selected.cm,
              entrypoint: "get_claim",
              calldata: [String(id), "0"],
            }, "latest");
            return {
              claim_id: id,
              token_id: Number(parseU256r(felts, 3)),
              claimant: "0x" + BigInt(felts[2]).toString(16),
              coverage_amount: String(parseU256r(felts, 7)),
              status: Number(BigInt(felts[9])),
              submitted_at: Number(BigInt(felts[10])),
            };
          } catch { return null; }
        })
      );
      setReviewClaims(results.filter((r): r is NonNullable<typeof r> => r !== null));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load claims", "error");
    } finally {
      setReviewLoading(false);
    }
  }

  function handleApproveClaim(claimId: number, cmAddress: string) {
    setActioningClaimId(claimId);
    claimActionTx.execute([{
      contractAddress: cmAddress,
      entrypoint: "approve_claim",
      calldata: [String(claimId), "0"],
    }]);
  }

  function handleRejectClaim(claimId: number, cmAddress: string) {
    setActioningClaimId(claimId);
    claimActionTx.execute([{
      contractAddress: cmAddress,
      entrypoint: "reject_claim",
      calldata: [String(claimId), "0"],
    }]);
  }

  function handleExpireCoverage() {
    if (!expirePmAddress || !isValidAddress(expirePmAddress)) {
      toast("Enter a valid PremiumModule address", "error"); return;
    }
    const tokenId = BigInt(expireTokenId.trim() || "0");
    if (tokenId === 0n) {
      toast("Enter a valid token ID", "error"); return;
    }
    const [idLow, idHigh] = u256Calldata(tokenId);
    expireTx.execute([
      {
        contractAddress: expirePmAddress,
        entrypoint: "expire_coverage",
        calldata: [idLow, idHigh],
      },
    ]);
  }

  async function handleSave() {
    try {
      const body = {
        protocol_id: Number(protocolId),
        protocol_name: meta.protocolName,
        insurance_name: meta.insuranceName,
        description: meta.description,
        logo_url: meta.logoUrl,
        vault_address: vaultAddress,
        premium_module_address: premiumModuleAddress,
        claims_manager_address: claimsManagerAddress,
        coverage_cap: String(BigInt(Math.floor(Number(meta.coverageCap) * 1e18))),
        premium_rate: Number(meta.premiumRate) * 100,
        chain: "starknet-sepolia",
        active: true,
      };

      const res = await fetch("/api/protocols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      setSaved(true);
      toast("Protocol saved to database", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    }
  }

  // ---- Validation ----

  const configValid =
    isValidAddress(config.registry) &&
    isValidAddress(config.factory) &&
    isValidAddress(config.coverageToken) &&
    isValidAddress(config.underlyingAsset) &&
    isValidAddress(config.premiumAsset);

  const metaValid =
    meta.protocolName.trim() !== "" &&
    meta.insuranceName.trim() !== "" &&
    meta.coverageCap.trim() !== "" &&
    meta.premiumRate.trim() !== "" &&
    meta.protocolAddress.trim() !== "" &&
    meta.vaultName.trim() !== "" &&
    meta.vaultSymbol.trim() !== "" &&
    meta.depositLimit.trim() !== "";

  // ---- Render ----

  return (
    <>
      <StepIndicator current={step} />

      {/* Step 0: System Config */}
      {step === 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">System Configuration</h2>
          <p className="text-sm text-neutral-400 mb-6">
            Enter the addresses of your deployed singleton contracts. These are saved to localStorage for reuse.
          </p>
          <Field
            label="ProtocolRegistry Address"
            value={config.registry}
            onChange={(v) => setConfig((c) => ({ ...c, registry: v }))}
            placeholder="0x..."
          />
          <Field
            label="InsuranceVaultFactory Address"
            value={config.factory}
            onChange={(v) => setConfig((c) => ({ ...c, factory: v }))}
            placeholder="0x..."
          />
          <Field
            label="CoverageToken Address"
            value={config.coverageToken}
            onChange={(v) => setConfig((c) => ({ ...c, coverageToken: v }))}
            placeholder="0x..."
          />
          <Field
            label="Underlying Asset (BTC-LST) Address"
            value={config.underlyingAsset}
            onChange={(v) => setConfig((c) => ({ ...c, underlyingAsset: v }))}
            placeholder="0x..."
            hint="Vault collateral token — LPs deposit this, payouts are in this"
          />
          <Field
            label="Premium Asset (USDC) Address"
            value={config.premiumAsset}
            onChange={(v) => setConfig((c) => ({ ...c, premiumAsset: v }))}
            placeholder="0x..."
            hint="Token users pay premiums in — must match what factory was deployed with"
          />
          <div className="mt-6">
            <button
              disabled={!configValid}
              onClick={() => {
                saveConfig(config);
                setStep(1);
              }}
              className="px-5 py-2 text-sm bg-white text-black rounded font-medium hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Protocol Metadata */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Protocol Metadata</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <Field
              label="Protocol Name"
              value={meta.protocolName}
              onChange={(v) => setMeta((m) => ({ ...m, protocolName: v }))}
              placeholder="e.g. Nostra"
            />
            <Field
              label="Insurance Product Name"
              value={meta.insuranceName}
              onChange={(v) => setMeta((m) => ({ ...m, insuranceName: v }))}
              placeholder="e.g. Nostra BTC-LST Depeg Cover"
            />
            <Field
              label="Protocol Contract Address"
              value={meta.protocolAddress}
              onChange={(v) => setMeta((m) => ({ ...m, protocolAddress: v }))}
              placeholder="0x..."
              hint="The actual protocol contract being insured"
            />
            <Field
              label="Logo URL"
              value={meta.logoUrl}
              onChange={(v) => setMeta((m) => ({ ...m, logoUrl: v }))}
              placeholder="https://..."
            />
            <Field
              label="Coverage Cap (tokens)"
              value={meta.coverageCap}
              onChange={(v) => setMeta((m) => ({ ...m, coverageCap: v }))}
              placeholder="e.g. 100"
              type="number"
              hint="Maximum total coverage in token units"
            />
            <Field
              label="Premium Rate (%)"
              value={meta.premiumRate}
              onChange={(v) => setMeta((m) => ({ ...m, premiumRate: v }))}
              placeholder="e.g. 5"
              type="number"
              hint="Rate for 90-day base duration (e.g. 5 = 5%)"
            />
            <Field
              label="Vault Share Name"
              value={meta.vaultName}
              onChange={(v) => setMeta((m) => ({ ...m, vaultName: v }))}
              placeholder="e.g. Insured Nostra Vault"
            />
            <Field
              label="Vault Share Symbol"
              value={meta.vaultSymbol}
              onChange={(v) => setMeta((m) => ({ ...m, vaultSymbol: v }))}
              placeholder="e.g. ivNOSTRA"
            />
            <Field
              label="Vault Deposit Limit (tokens)"
              value={meta.depositLimit}
              onChange={(v) => setMeta((m) => ({ ...m, depositLimit: v }))}
              placeholder="e.g. 1000"
              type="number"
              hint="Max TVL per vault in token units"
            />
          </div>
          <div className="mb-4">
            <label className="block">
              <span className="text-sm text-neutral-300 mb-1 block">Description</span>
              <textarea
                value={meta.description}
                onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
                placeholder="Brief description of what this insurance covers..."
                rows={3}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 resize-none"
              />
            </label>
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setStep(0)}
              className="px-4 py-2 text-sm border border-neutral-700 rounded hover:border-neutral-500 transition-colors"
            >
              Back
            </button>
            <button
              disabled={!metaValid}
              onClick={() => setStep(2)}
              className="px-5 py-2 text-sm bg-white text-black rounded font-medium hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Register & Deploy */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Register & Deploy</h2>
          <p className="text-sm text-neutral-400 mb-6">
            Execute these two transactions in order. Each requires a wallet signature.
          </p>

          <div className="border border-neutral-800 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium mb-1">1. Register Protocol</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Calls <code className="text-neutral-400">registry.register_protocol()</code> with
              coverage cap {meta.coverageCap} tokens, premium rate {meta.premiumRate}%
            </p>
            <TxButton
              label="Register Protocol"
              onClick={handleRegister}
              status={registerTx.status}
            />
            {protocolId && (
              <p className="text-xs text-emerald-400 mt-1">Protocol ID: {protocolId}</p>
            )}
          </div>

          <div className="border border-neutral-800 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium mb-1">2. Create Vault</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Calls <code className="text-neutral-400">factory.create_vault()</code> — deploys Vault + PremiumModule + ClaimsManager
            </p>
            <TxButton
              label="Create Vault"
              onClick={handleCreateVault}
              disabled={!protocolId}
              status={createVaultTx.status}
            />
            {vaultAddress && (
              <div className="text-xs mt-1 space-y-0.5">
                <p className="text-emerald-400">
                  Vault: <span className="font-mono">{vaultAddress}</span>
                </p>
                <p className="text-emerald-400">
                  PremiumModule: <span className="font-mono">{premiumModuleAddress}</span>
                </p>
                <p className="text-emerald-400">
                  ClaimsManager: <span className="font-mono">{claimsManagerAddress || "loading…"}</span>
                </p>
              </div>
            )}
          </div>

          <details className="mb-4">
            <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-300">
              Manual override (if values not auto-detected)
            </summary>
            <div className="mt-3 space-y-3 border border-neutral-800 rounded-lg p-4">
              <Field label="Protocol ID" value={protocolId} onChange={setProtocolId} placeholder="e.g. 1" />
              <Field label="Vault Address" value={vaultAddress} onChange={setVaultAddress} placeholder="0x..." />
              <Field label="PremiumModule Address" value={premiumModuleAddress} onChange={setPremiumModuleAddress} placeholder="0x..." />
              <Field label="ClaimsManager Address" value={claimsManagerAddress} onChange={setClaimsManagerAddress} placeholder="0x..." />
            </div>
          </details>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm border border-neutral-700 rounded hover:border-neutral-500 transition-colors"
            >
              Back
            </button>
            <button
              disabled={!protocolId || !vaultAddress || !premiumModuleAddress || !claimsManagerAddress}
              onClick={() => setStep(3)}
              className="px-5 py-2 text-sm bg-white text-black rounded font-medium hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Wire Permissions */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Wire Permissions</h2>
          <p className="text-sm text-neutral-400 mb-6">
            Grant the necessary cross-contract roles. Each is a separate transaction.
          </p>

          <div className="border border-neutral-800 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium mb-1">1. Grant Minter Role</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Calls <code className="text-neutral-400">coverageToken.set_minter(premiumModule)</code> — allows minting coverage NFTs
            </p>
            <TxButton
              label="Set Minter"
              onClick={handleSetMinter}
              status={minterDone ? "done" : setMinterTx.status}
            />
          </div>

          <div className="border border-neutral-800 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium mb-1">2. Set Deposit Limit</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Calls <code className="text-neutral-400">vault.set_deposit_limit({meta.depositLimit} tokens)</code>
            </p>
            <TxButton
              label="Set Deposit Limit"
              onClick={handleSetDepositLimit}
              status={depositLimitDone ? "done" : setDepositLimitTx.status}
            />
          </div>

          <div className="border border-neutral-800 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium mb-1">3. Set Coverage Manager</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Calls <code className="text-neutral-400">vault.set_coverage_manager(premiumModule)</code> — enables lock/unlock for coverage
            </p>
            <TxButton
              label="Set Coverage Manager"
              onClick={handleSetCoverageManager}
              status={coverageManagerDone ? "done" : setCoverageManagerTx.status}
            />
          </div>

          <div className="border border-neutral-800 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium mb-1">4. Set Claims Manager</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Calls <code className="text-neutral-400">vault.set_claims_manager(claimsManager)</code> — grants CLAIMS_MANAGER_ROLE so ClaimsManager can trigger payouts
            </p>
            <TxButton
              label="Set Claims Manager"
              onClick={handleSetClaimsManager}
              disabled={!claimsManagerAddress}
              status={claimsManagerDone ? "done" : setClaimsManagerTx.status}
            />
          </div>

          <div className="border border-neutral-800 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium mb-1">5. Set Burner</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Calls <code className="text-neutral-400">coverageToken.set_burner(claimsManager)</code> — grants BURNER_ROLE so ClaimsManager can burn NFTs on approval
            </p>
            <TxButton
              label="Set Burner"
              onClick={handleSetBurner}
              disabled={!claimsManagerAddress}
              status={burnerDone ? "done" : setBurnerTx.status}
            />
          </div>

          <div className="border border-neutral-800 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium mb-1">6. Add Governor</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Calls <code className="text-neutral-400">claimsManager.add_governor(address)</code> — grants GOVERNOR_ROLE to the wallet that can approve/reject claims
            </p>
            <Field
              label="Governor Address"
              value={governorAddress}
              onChange={setGovernorAddress}
              placeholder="0x..."
              hint="Defaults to your connected wallet"
            />
            <TxButton
              label="Add Governor"
              onClick={handleAddGovernor}
              disabled={!claimsManagerAddress || !isValidAddress(governorAddress)}
              status={governorDone ? "done" : addGovernorTx.status}
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-sm border border-neutral-700 rounded hover:border-neutral-500 transition-colors"
            >
              Back
            </button>
            <button
              disabled={!minterDone || !depositLimitDone || !coverageManagerDone || !claimsManagerDone || !burnerDone || !governorDone}
              onClick={() => setStep(4)}
              className="px-5 py-2 text-sm bg-white text-black rounded font-medium hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Maintenance Tools — always visible */}
      <div className="mt-10 border-t border-neutral-800 pt-8">
        <h2 className="text-base font-semibold mb-1">Maintenance</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Utility actions that can be run at any time, independent of the setup wizard.
        </p>

        <div className="border border-neutral-800 rounded-lg p-4">
          <h3 className="text-sm font-medium mb-1">Expire Coverage</h3>
          <p className="text-xs text-neutral-500 mb-3">
            Calls <code className="text-neutral-400">premiumModule.expire_coverage(token_id)</code> to
            unlock vault liquidity after a coverage NFT has expired. Anyone can call this once the
            policy end time has passed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field
              label="PremiumModule Address"
              value={expirePmAddress}
              onChange={setExpirePmAddress}
              placeholder="0x..."
            />
            <Field
              label="Coverage Token ID"
              value={expireTokenId}
              onChange={setExpireTokenId}
              placeholder="e.g. 1"
              type="number"
            />
          </div>
          <TxButton
            label="Expire Coverage"
            onClick={handleExpireCoverage}
            status={expireTx.status}
            disabled={!expirePmAddress || !expireTokenId}
          />
          {expireTx.status === "done" && (
            <p className="text-xs text-emerald-400 mt-1">
              Liquidity unlocked successfully.
            </p>
          )}
        </div>

        {/* Claims Review */}
        <div className="border border-neutral-800 rounded-lg p-4 mt-4">
          <h3 className="text-sm font-medium mb-1">Claims Review</h3>
          <p className="text-xs text-neutral-500 mb-3">
            Load pending claims from a protocol&apos;s ClaimsManager and approve or reject them.
            Requires GOVERNOR_ROLE on the ClaimsManager.
          </p>
          {reviewProtocols.length > 0 ? (
            <div className="mb-3">
              <label className="text-xs text-neutral-400 mb-1 block">Protocol</label>
              <select
                value={reviewProtocolIdx}
                onChange={(e) => { setReviewProtocolIdx(Number(e.target.value)); setReviewClaims([]); }}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:border-neutral-500"
              >
                {reviewProtocols.map((p, i) => (
                  <option key={i} value={i}>{p.name} — {p.cm.slice(0, 10)}…</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-neutral-600 mb-3">No protocols with ClaimsManager found in database.</p>
          )}
          <TxButton
            label={reviewLoading ? "Loading…" : "Load Claims"}
            onClick={handleLoadClaims}
            disabled={reviewProtocols.length === 0 || reviewLoading}
            status="idle"
          />
          {reviewClaims.length === 0 && !reviewLoading && (
            <p className="text-xs text-neutral-600 mt-1">No claims found.</p>
          )}
          {reviewClaims.length > 0 && (
            <div className="mt-3 space-y-2">
              {reviewClaims.map((c) => {
                const statusLabel = c.status === 0 ? "Pending" : c.status === 1 ? "Approved" : "Rejected";
                const isPending = c.status === 0;
                const isActioning = actioningClaimId === c.claim_id;
                const selected = reviewProtocols[reviewProtocolIdx];
                return (
                  <div key={c.claim_id} className="border border-neutral-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">Claim #{c.claim_id} · Token #{c.token_id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.status === 0 ? "bg-amber-500/10 text-amber-400"
                        : c.status === 1 ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                      }`}>{statusLabel}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mb-2 font-mono">{c.claimant.slice(0, 12)}…</p>
                    {isPending && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveClaim(c.claim_id, selected.cm)}
                          disabled={isActioning && (claimActionTx.status === "pending" || claimActionTx.status === "confirming")}
                          className="text-xs px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                        >
                          {isActioning && claimActionTx.status === "pending" ? "Signing…"
                            : isActioning && claimActionTx.status === "confirming" ? "Confirming…"
                            : isActioning && claimActionTx.status === "done" ? "Done"
                            : "Approve"}
                        </button>
                        <button
                          onClick={() => handleRejectClaim(c.claim_id, selected.cm)}
                          disabled={isActioning && (claimActionTx.status === "pending" || claimActionTx.status === "confirming")}
                          className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Step 4: Save to Database */}
      {step === 4 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Review & Save</h2>

          <div className="border border-neutral-800 rounded-lg p-4 mb-6 text-sm space-y-2">
            <Row label="Protocol Name" value={meta.protocolName} />
            <Row label="Insurance Name" value={meta.insuranceName} />
            <Row label="Protocol ID" value={protocolId} />
            <Row label="Coverage Cap" value={`${meta.coverageCap} tokens`} />
            <Row label="Premium Rate" value={`${meta.premiumRate}%`} />
            <Row label="Vault Address" value={vaultAddress} mono />
            <Row label="PremiumModule" value={premiumModuleAddress} mono />
            <Row label="ClaimsManager" value={claimsManagerAddress} mono />
            <Row label="Deposit Limit" value={`${meta.depositLimit} tokens`} />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 text-sm border border-neutral-700 rounded hover:border-neutral-500 transition-colors"
            >
              Back
            </button>
            <button
              disabled={saved}
              onClick={handleSave}
              className="px-5 py-2 text-sm bg-white text-black rounded font-medium hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saved ? "Saved" : "Save to Database"}
            </button>
          </div>

          {saved && (
            <p className="text-sm text-emerald-400 mt-4">
              Protocol saved. It will now appear on the dashboard.
            </p>
          )}
        </div>
      )}
    </>
  );
}
