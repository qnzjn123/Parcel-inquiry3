import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from 'next/script';

const inter = Inter({ subsets: ["latin"] });

// 네이버 지도 API 키
const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || "YOUR_CLIENT_ID_HERE"; // 발급받은 클라이언트 ID로 변경 필요

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "배송콕",
  description: "국내 모든 택배사 실시간 조회가 가능한 택배 추적 서비스",
  // Open Graph 메타데이터 추가
  openGraph: {
    title: "배송콕",
    description: "국내 모든 택배사 실시간 조회가 가능한 택배 추적 서비스",
    url: "https://배송콕.com", // 실제 도메인으로 수정해 주세요
    siteName: "배송콕",
    images: [
      {
        url: "/large-icon.png",
        width: 512,
        height: 512,
        alt: "배송콕 로고",
      }
    ],
    locale: "ko_KR",
    type: "website",
  },
  // 트위터 카드 메타데이터 추가
  twitter: {
    card: "summary",
    title: "배송콕",
    description: "국내 모든 택배사 실시간 조회가 가능한 택배 추적 서비스",
    images: ["/large-icon.png"],
  },
  // 아이콘 설정
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/large-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/large-icon.png" sizes="512x512" />
        <Script id="dynamic-favicon" strategy="afterInteractive">
          {`
            // 파비콘을 동적으로 변경
            const link = document.querySelector("link[rel~='icon']");
            if (!link) {
              const newLink = document.createElement('link');
              newLink.rel = 'icon';
              newLink.href = '/large-icon.png';
              newLink.sizes = '512x512';
              document.head.appendChild(newLink);
            }
          `}
        </Script>
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
