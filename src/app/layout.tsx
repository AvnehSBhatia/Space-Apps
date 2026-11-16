import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "SolCast: Mars Outpost Trainer",
  description:
    "Keep a four-person Mars outpost alive through real weather recorded by the Curiosity rover. A 2026 NASA Space Apps Challenge entry for ages 7 to 12.",
};

export const viewport: Viewport = {
  themeColor: "#101436",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${baloo.variable} ${nunito.variable} h-full antialiased`}>
      <body className="stars min-h-full flex flex-col">{children}</body>
    </html>
  );
}
