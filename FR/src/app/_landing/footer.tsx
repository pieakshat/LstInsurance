import Link from "next/link";

const LINKS = [
  {
    heading: "Product",
    items: [
      { label: "Get Covered",       href: "/app" },
      { label: "Liquidity Pools",   href: "/app/lp" },
      { label: "Submit a Claim",    href: "/app/submit-claim" },
    ],
  },
  {
    heading: "Protocol",
    items: [
      { label: "How it works",  href: "#how-it-works" },
      { label: "Governance",    href: "/app/governance" },
      { label: "Admin",         href: "/app/admin" },
    ],
  },
];

export function Footer() {
  return (
    <footer
      className="border-t border-white/[0.05] px-6 lg:px-14 py-14"
      style={{ background: "rgba(0,0,0,0.2)" }}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">

        {/* Brand column */}
        <div className="col-span-2 md:col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <ShieldIcon />
            <span className="font-bold text-[17px] tracking-tight">BitCover</span>
          </div>
          <p className="text-sm text-neutral-500 leading-relaxed max-w-xs">
            On-chain BTC insurance for the DeFi-native. Non-custodial, permissionless, built on Starknet.
          </p>
          <p className="mt-6 text-xs text-neutral-700">
            © {new Date().getFullYear()} BitCover. All rights reserved.
          </p>
        </div>

        {/* Link columns */}
        {LINKS.map((col) => (
          <div key={col.heading}>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-4">{col.heading}</p>
            <ul className="space-y-3">
              {col.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-neutral-500 hover:text-white transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="24" viewBox="0 0 26 30" fill="none">
      <path
        d="M13 1 L25 6 L25 18 C25 24 19.5 28.5 13 30 C6.5 28.5 1 24 1 18 L1 6 Z"
        fill="rgba(232,112,74,0.18)"
        stroke="#E8704A"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <text x="13" y="21" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">₿</text>
    </svg>
  );
}
