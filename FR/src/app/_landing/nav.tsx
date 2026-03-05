"use client";

import Link from "next/link";
import { useState } from "react";

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-14 py-4 flex items-center justify-between border-b border-white/[0.04]"
      style={{ background: "rgba(7,9,15,0.85)", backdropFilter: "blur(18px)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <ShieldIcon />
        <span className="font-bold text-[17px] tracking-tight">BitCover</span>
      </div>

      {/* Desktop links */}
      <nav className="hidden md:flex items-center gap-7 text-sm text-neutral-400">
        <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
        <a href="#features"     className="hover:text-white transition-colors">Features</a>
        <a href="#for-lps"      className="hover:text-white transition-colors">For LPs</a>
      </nav>

      {/* Desktop CTA */}
      <div className="hidden md:block">
        <Link
          href="/app"
          className="text-sm px-5 py-2 rounded-lg bg-[#E8704A] text-white font-medium hover:bg-[#d4603a] transition-colors"
        >
          Launch App
        </Link>
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden p-1.5 text-neutral-400 hover:text-white transition-colors"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile drawer */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 px-6 py-4 flex flex-col gap-2 border-t border-white/5"
          style={{ background: "rgba(7,9,15,0.97)", backdropFilter: "blur(18px)" }}
        >
          {[
            { href: "#how-it-works", label: "How it works" },
            { href: "#features",     label: "Features"     },
            { href: "#for-lps",      label: "For LPs"      },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="px-2 py-2.5 text-sm text-neutral-300 hover:text-white transition-colors"
            >
              {label}
            </a>
          ))}
          <Link
            href="/app"
            className="mt-1 text-center text-sm px-5 py-2.5 rounded-lg bg-[#E8704A] text-white font-medium"
            onClick={() => setOpen(false)}
          >
            Launch App
          </Link>
        </div>
      )}
    </header>
  );
}

function ShieldIcon() {
  return (
    <svg width="26" height="28" viewBox="0 0 26 30" fill="none">
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
