import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Intro } from "./_components/Intro";
import { bootScript } from "./_lib/boot";

const TITLE = "pebbly remover — AI background remover in your browser";
const DESCRIPTION =
  "Remove image backgrounds with AI, 100% in your browser. No uploads, no servers. Batch up to 10 images and download as ZIP. Free, by pebbly labs.";

export const metadata: Metadata = {
  metadataBase: new URL("https://remover.pebblylabs.com"),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "background removal",
    "remove background",
    "transparent PNG",
    "배경 지우기",
    "누끼",
    "privacy-first",
    "no upload",
    "local AI",
    "pebbly remover",
    "pebbly labs",
  ],
  authors: [{ name: "pebbly labs", url: "https://pebblylabs.com" }],
  creator: "pebbly labs",
  publisher: "pebbly labs",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "https://remover.pebblylabs.com/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ko_KR"],
    url: "https://remover.pebblylabs.com/",
    siteName: "pebbly remover",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "pebbly remover — [ 01 ]", type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@pebblylabs",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  // 앱 아이콘 [ 01 ]: 탭·설치용은 상자 모양 그대로, 아이폰 홈 화면은 검은 바탕을 꽉 채운 것 (scripts/icons.mjs)
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // 홈 화면 바로가기 이름(안드로이드는 manifest의 short_name, 아이폰은 이 title) — 미러처럼 Pebbly Remover
  applicationName: "Pebbly Remover",
  appleWebApp: { capable: true, title: "Pebbly Remover", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* 그리기 전에: 한/영 정하기, 이번 탭에서 인트로를 이미 봤으면 숨기기 */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* 로고·숫자: MuseoModerno(이름 400 · 스파인 500 · [ 01 ] 600), 한글: Pretendard */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=MuseoModerno:wght@400;500;600&display=block" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body>
        <Intro />
        {children}
      </body>
    </html>
  );
}
