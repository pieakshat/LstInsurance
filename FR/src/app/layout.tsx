import type { Metadata } from "next";
import { StarknetProvider } from "./starknet-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "STRK Insurance",
  description: "BTC-LST insurance infrastructure on Starknet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen antialiased">
        <StarknetProvider>{children}</StarknetProvider>
      </body>
    </html>
  );
}
