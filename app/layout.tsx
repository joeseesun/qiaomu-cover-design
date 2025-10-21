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
        {/* 汇文明朝体字体 */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/hwmct/dist/汇文明朝体/result.css' />
        {/* 抖音美好体字体 */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/dymh/dist/DouyinSansBold/result.css' />
        {/* Maple Mono CN */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/maple-mono-cn/dist/MapleMono-CN-MediumItalic/result.css' />
        {/* 上图东观体 */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/stdgt/dist/上图东观体-粗体/result.css' />
        {/* 全小素 */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/qxs/dist/quan/result.css' />
        {/* 铁蒺藜体 */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/tjl/dist/Tiejili_Regular/result.css' />
        {/* 优设标题黑 */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/ysbth/dist/优设标题黑/result.css' />
        {/* 斗鱼追光体 */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/dyzgt/dist/斗鱼追光体/result.css' />
        {/* 千图笔锋手写体 */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/qtbfsxt/dist/千图笔锋手写体/result.css' />
        {/* 得意黑 */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/dyh/dist/SmileySans-Oblique/result.css' />
        {/* 鸿雷行书简体 */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/hlxsjt/dist/鸿雷行书简体/result.css' />
        {/* 精品點陣體 */}
        <link rel='stylesheet' href='https://chinese-fonts-cdn.deno.dev/packages/jpdzt/dist/BoutiqueBitmap7x7_1_6/result.css' />
      </head>
      <body className={`${notoSansSC.variable} ${notoSerifSC.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
