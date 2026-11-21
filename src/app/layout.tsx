import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dunkoma Studio",
  description:
    "Basketball footage in, storyline manga out. Real plays, reimagined panels.",
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
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=tanker@400&f[]=general-sans@400,500,600&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Geist+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className="font-sans antialiased bg-paper-100 text-ink-950 min-h-screen ">
        {children}
      </body>
    </html>
  );
}
