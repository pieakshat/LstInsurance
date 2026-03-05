import type { Metadata } from "next";
import { StarknetProvider } from "./starknet-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "BitCover — BTC Insurance for DeFi",
  description: "On-chain coverage for your BTC positions across DeFi protocols. No custodians, no paperwork, instant settlement on Starknet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-white min-h-screen antialiased">
        <StarknetProvider>{children}</StarknetProvider>
      </body>
    </html>
  );
}
