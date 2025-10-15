import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const notoSansSC = Noto_Sans_SC({
  weight: ['400', '500', '700'],
  subsets: ["latin"],
  variable: '--font-noto-sans-sc',
});

const notoSerifSC = Noto_Serif_SC({
  weight: ['400', '500', '700'],
  subsets: ["latin"],
  variable: '--font-noto-serif-sc',
});

export const metadata: Metadata = {
  title: "小红书封面生成器",
  description: "在线制作小红书封面，支持高亮文字、版本管理、一键导出",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${notoSansSC.variable} ${notoSerifSC.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
