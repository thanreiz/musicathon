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

export const metadata: Metadata = {
  title: "Myusika — Filipino Karaoke",
  description:
    "Search a song, strip the vocals, and sing it karaoke-style with time-synced lyrics. A Filipino-culture videoke web app.",
  openGraph: {
    title: "Myusika — Filipino Karaoke",
    description:
      "Search a song, strip the vocals, and sing it karaoke-style with time-synced lyrics.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c060d",
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
