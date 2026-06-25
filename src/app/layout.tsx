import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "入画文游",
  description: "从课文出发，进入场景、人物与提问的沉浸式文言文学习体验。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[#090705] antialiased">{children}</body>
    </html>
  );
}
