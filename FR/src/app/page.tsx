import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <h1 className="text-5xl font-bold tracking-tight mb-4">STRK Insurance</h1>
      <p className="text-lg text-neutral-400 mb-10 text-center max-w-md">
        BTC-LST backed insurance infrastructure on Starknet
      </p>
      <Link
        href="/app"
        className="px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-neutral-200 transition-colors"
      >
        Launch App
      </Link>
    </div>
  );
}
