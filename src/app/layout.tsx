import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blauwhoed Partner Radar",
  description: "Partneroverzichten vullen, beoordelen en actueel houden met AI."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
