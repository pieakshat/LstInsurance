import Link from "next/link";
import { WalletBar } from "./wallet-bar";
import { NavLinks } from "./nav-links";
import { ToastProvider } from "./toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-8">
            <Link href="/app" className="text-lg font-bold shrink-0">
              STRK Insurance
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
