import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reva ERP",
  description: "Enterprise SaaS Platform for Manufacturing",
};

/** Runs before paint to prevent theme flash; sets .dark on html from localStorage or system preference */
const themeInitScript = `
(function(){
  var k='erp-theme';
  var s=typeof localStorage!=='undefined'&&localStorage.getItem(k);
  if(s==='light'||s==='dark'){ document.documentElement.classList.toggle('dark',s==='dark'); return; }
  var d=typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark',!!d);
  try{ localStorage.setItem(k,d?'dark':'light'); }catch(e){}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
