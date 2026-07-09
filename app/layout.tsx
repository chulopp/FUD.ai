import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { RootProvider } from "fumadocs-ui/provider/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fud.ai"),
  title: {
    default: "FUD.ai — Crypto FUD Manipulation Detector",
    template: "%s | FUD.ai",
  },
  description:
    "An agentic on-chain intelligence layer that detects coordinated FUD and rug-pull manipulation in real time. Built on CROO CAP, callable by any agent.",
  icons: {
    icon: "/LOGOFUD.png",
    shortcut: "/LOGOFUD.png",
    apple: "/LOGOFUD.png",
  },
  keywords: [
    "FUD detection",
    "crypto manipulation",
    "sybil detection",
    "on-chain intelligence",
    "CROO",
    "agent-to-agent",
    "rug pull",
  ],
  openGraph: {
    title: "FUD.ai — Crypto FUD Manipulation Detector",
    description:
      "Detect coordinated FUD before it liquidates you. On-chain + social + coordination signals, reasoned with MCTS-inspired multi-branch analysis.",
    type: "website",
    images: ["/LOGOFUD.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FUD.ai — Crypto FUD Manipulation Detector",
    description:
      "Detect coordinated FUD before it liquidates you. On-chain + social + coordination signals.",
    images: ["/LOGOFUD.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <RootProvider
          theme={{
            attribute: "class",
            defaultTheme: "dark",
            enableSystem: false,
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
