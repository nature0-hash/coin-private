import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { FetchInterceptorBootstrap } from "@/components/fetch-interceptor-bootstrap";
import { ThemeProvider } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coin Private: Premium Crypto Platform",
  description:
    "Coin Private is a crypto platform for portfolio tracking, market trading, wallet activity, and managed operations.",
  keywords: ["crypto", "trading", "portfolio", "bitcoin", "ethereum", "private banking"],
  authors: [{ name: "Coin Private" }],
  openGraph: {
    title: "Coin Private",
    description: "Premium crypto platform with live markets and atomic ledger settlement.",
    siteName: "Coin Private",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0f" },
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Applies the saved theme before first paint: prevents any flash of the wrong theme.
const themeInitScript = `(function(){try{var t=localStorage.getItem('cp-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.classList.add('dark');document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <FetchInterceptorBootstrap />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
