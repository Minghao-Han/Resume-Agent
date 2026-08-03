import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { AssistantDrawer } from "@/components/AssistantDrawer";
import { ToastHost } from "@/components/ToastHost";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Resume Tailor",
  description: "个人简历 tailoring 工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-dvh overflow-hidden antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden">
        <NavBar />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        <AssistantDrawer />
        <ToastHost />
      </body>
    </html>
  );
}
