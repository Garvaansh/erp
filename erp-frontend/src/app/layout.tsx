```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect } from "react";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reva ERP",
  description: "Enterprise SaaS Platform for Manufacturing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    const themeInit = () => {
      const key = 'erp-theme';
      const storedTheme = typeof localStorage!== 'undefined' && localStorage.getItem(key);
      if (storedTheme === 'light' || storedTheme === 'dark') {
        document.documentElement.classList.toggle('dark', storedTheme === 'dark');
        return;
      }
      const isDark = typeof window!== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
      try { localStorage.setItem(key, isDark? 'dark' : 'light'); } catch (e) { }
    };
    themeInit();
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```