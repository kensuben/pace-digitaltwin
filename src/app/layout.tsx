import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PACE Smart Campus Digital Twin",
  description: "Network digital twin for PACE Smart Campus 181 Cô Giang",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
