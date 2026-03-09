"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/lp", label: "LP" },
  { href: "/app/submit-claim", label: "Submit a Claim" },
  { href: "/app/governance", label: "Governance" },
  { href: "/app/admin", label: "Admin" },
  { href: "/app/faucet", label: "Faucet" },
  { href: "/docs", label: "Docs" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1">
        {LINKS.map(({ href, label }) => {
          const isActive =
            href === "/app" ? pathname === "/app" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${isActive
                  ? "text-white bg-white/8"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile hamburger */}
      <div className="md:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 text-neutral-400 hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>

        {open && (
          <div className="absolute top-[57px] left-0 right-0 glass border-b border-white/5 z-40 px-6 py-3 flex flex-col gap-1">
            {LINKS.map(({ href, label }) => {
              const isActive =
                href === "/app"
                  ? pathname === "/app"
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`px-3 py-2 text-sm rounded-md transition-all ${isActive
                      ? "text-white bg-white/8"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                    }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
