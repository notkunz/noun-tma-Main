import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "NOUN TMA Assistant",
  description:
    "TMA assistant for NOUN students. Get instant answers to your Tutor Marked Assignments.",
  openGraph: {
    title: "NOUN TMA Assistant",
    description:
      "TMA assistant for NOUN students. Get instant answers to your Tutor Marked Assignments.",
    url: "https://noun-tma-assistant-two.vercel.app",
    siteName: "NOUN TMA Assistant",
    images: [
      {
        url: "https://noun-tma-assistant-two.vercel.app/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NOUN TMA Assistant",
    description: "TMA assistant for NOUN students.",
    images: ["https://noun-tma-assistant-two.vercel.app/og-image.png"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
