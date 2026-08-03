import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "cbt_vibe",
  description: "AI 기반 로컬 CBT 풀이 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

