import Link from "next/link";
import { WalletBar } from "./wallet-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <Link href="/" className="text-lg font-bold">
          STRK Insurance
        </Link>
        <WalletBar />
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
