import Link from "next/link";
import { WalletBar } from "../app/wallet-bar";
import { NavLinks } from "../app/nav-links";
import { ToastProvider } from "../app/toast";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 glass border-b border-white/5">
          <div className="flex items-center gap-8">
            <Link href="/app" className="text-lg font-bold shrink-0 text-white">
              BitCover
            </Link>
            <NavLinks />
          </div>
          <WalletBar />
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
