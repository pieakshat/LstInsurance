"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "@starknet-react/core";
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
  registry:        "0x063496b0409b179d6ec465f6e0c9936a41d3a71d4e4e0f3f743d78ca258a17cb",
  factory:         "0x05a1cf3518bb1ea5e9eb9c8d62c58087062d3f566c65849f2343eeaed8df4359",
  coverageToken:   "0x07cf16f16fe7e96d66cf063739bf8d8f078ca944a271723dca5403f8c946ff5d",
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

  // Step 3: Permission wiring completion flags
  const [minterDone, setMinterDone] = useState(false);
  const [depositLimitDone, setDepositLimitDone] = useState(false);
  const [coverageManagerDone, setCoverageManagerDone] = useState(false);

  // Step 4: DB save
  const [saved, setSaved] = useState(false);

  // Transaction steps
  const registerTx = useTxStep();
  const createVaultTx = useTxStep();
  const setMinterTx = useTxStep();
  const setDepositLimitTx = useTxStep();
  const setCoverageManagerTx = useTxStep();

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

  useEffect(() => {
    if (createVaultTx.status === "done") {
      const timer = setTimeout(() => {
        refetchVault();
        refetchPM();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [createVaultTx.status, refetchVault, refetchPM]);

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
              Calls <code className="text-neutral-400">factory.create_vault()</code> — deploys Vault + PremiumModule
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
              disabled={!protocolId || !vaultAddress || !premiumModuleAddress}
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

          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-sm border border-neutral-700 rounded hover:border-neutral-500 transition-colors"
            >
              Back
            </button>
            <button
              disabled={!minterDone || !depositLimitDone || !coverageManagerDone}
              onClick={() => setStep(4)}
              className="px-5 py-2 text-sm bg-white text-black rounded font-medium hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

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
