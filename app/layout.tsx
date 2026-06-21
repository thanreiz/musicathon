import type { Metadata, Viewport } from "next";
import { Poppins, Righteous, Geist_Mono } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const righteous = Righteous({
  variable: "--font-righteous",
  subsets: ["latin"],
  weight: "400",
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
      className={`${poppins.variable} ${righteous.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
