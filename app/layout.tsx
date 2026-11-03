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
  // 앱 아이콘 [ 01 ]: 브랜드 생성기(_brand/icons/make.js 01)가 뽑은 것 그대로 — 둥근 네모 테 안 [ 01 ](잉크 폭 0.70)
  // ?v=는 파일 내용 해시(pebblylabs.com 존 기본 브라우저 캐시가 4시간이라 바뀌면 새로 받게). 생성기 head.html·manifest-icons.json과 같은 값
  icons: {
    icon: [
      { url: "/favicon.ico?v=cfc8a963", sizes: "32x32" },
      { url: "/favicon.svg?v=a8795ea8", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png?v=4201a6ba",
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
        {/* 그리기 전에: 한/영 정하기, 이번 탭에서 인트로를 이미 봤으면 숨기기, 설치 앱(안드로이드) 첫 장면 크기 */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        {/* 공용 번호 인트로 부품(_brand/intro 원본의 사본, 고치지 말 것 — sync.py가 사본·?v=를 맞춤). Intro.tsx보다 먼저 있어야 해서 동기로 */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/pebbly-intro.js?v=8aa45e44"></script>
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
