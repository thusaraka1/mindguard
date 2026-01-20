import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "MindGuard | Pediatric Mental Health Monitoring",
  description: "Advanced IoT-based behavioral analysis system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(outfit.variable, "antialiased bg-background text-foreground min-h-screen font-sans")} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
