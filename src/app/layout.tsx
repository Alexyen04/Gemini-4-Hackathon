import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COURT & INK — Gemini 4 Basketball Manga Studio",
  description:
    "Transform real NBA & basketball highlight clips into cohesive, interactive Japanese sports manga powered by Gemini 4 Carbon, Argon, Hydrogen & Neon.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=JetBrains+Mono:wght@400;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="font-sans antialiased bg-paper-100 text-ink-950 min-h-screen selection:bg-crimson-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
