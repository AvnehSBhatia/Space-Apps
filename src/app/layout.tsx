import type { Metadata, Viewport } from "next";
import { Figtree, Martian_Mono, Sora } from "next/font/google";
import "./globals.css";

// Type dealt by the taste skill: Sora for headlines, Figtree for text, Martian Mono for readouts.
const display = Sora({ variable: "--font-display-face", subsets: ["latin"], weight: ["400", "500"] });
const body = Figtree({ variable: "--font-body-face", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = Martian_Mono({ variable: "--font-mono-face", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "SolCast: run a Mars outpost on real rover weather",
  description:
    "A browser game for ages 7 to 12. Keep a four-person Mars outpost running through real weather recorded by the Curiosity rover at Gale Crater.",
};

export const viewport: Viewport = {
  themeColor: "#18191b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
