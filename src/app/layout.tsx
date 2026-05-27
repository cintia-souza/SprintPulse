import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://sprintpulse.vercel.app";

export const viewport: Viewport = {
  themeColor: "#22d3ee",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "SprintPulse — Retrospectiva e Planning Poker em tempo real",
    template: "%s | SprintPulse",
  },
  description:
    "Ferramenta gratuita para retrospectivas ágeis e planning poker. Colabore com seu time em tempo real, vote em cards e acompanhe planos de ação.",
  keywords: [
    "retrospectiva",
    "planning poker",
    "scrum",
    "agile",
    "sprint",
    "retro",
    "time real",
    "colaboração",
    "squad",
  ],
  authors: [{ name: "SprintPulse" }],
  creator: "SprintPulse",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: BASE_URL,
    siteName: "SprintPulse",
    title: "SprintPulse — Retrospectiva e Planning Poker em tempo real",
    description:
      "Ferramenta gratuita para retrospectivas ágeis e planning poker. Colabore com seu time em tempo real.",
    images: [
      {
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: "SprintPulse Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "SprintPulse — Retrospectiva e Planning Poker",
    description:
      "Colabore com seu time em tempo real. Retrospectivas e estimativas sem fricção.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
