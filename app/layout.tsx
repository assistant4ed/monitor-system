import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Monitor System",
  description: "Comprehensive Redis-backed monitoring dashboard with metrics, alerts, and health checks",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-950 text-stone-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
