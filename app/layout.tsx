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
      <head>
        {/* Umami 流量统计 */}
        <script defer src="https://cloud.umami.is/script.js" data-website-id="32816fbe-e9c8-49ff-a796-8e63466e1f1f"></script>
        {/* 中文字体已通过 npm 包在 globals.css 中导入 */}
      </head>
      <body className={`${notoSansSC.variable} ${notoSerifSC.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
