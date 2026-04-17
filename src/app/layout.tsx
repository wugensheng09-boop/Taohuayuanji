import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "课本世界穿越器",
  description: "《桃花源记》全屏沉浸式文言文学习演示",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
