import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Persona Writer Studio - 작가 페르소나 라이터 스튜디오",
  description:
    "AI-powered creative writing environment with multi-persona generation and style evaluation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark">
      <head>
        {/* Pretendard Dynamic Font Support */}
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css"
          rel="stylesheet"
        />
        {/* Google Fonts for Web UI & Mono labels & Playfair Display Editorial Serif */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0F0F0F] text-[#F5F5F5]">{children}</body>
    </html>
  );
}
