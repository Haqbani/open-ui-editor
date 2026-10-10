import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

const inter = localFont({
  src: "./fonts/inter-variable.woff2",
  display: "swap",
  variable: "--font-inter",
});
export const metadata = { title: "Open UI Editor" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
