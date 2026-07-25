import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "../components/providers/app-providers";

export const metadata: Metadata = {
  title: "JEST Policy CRM | Enterprise Insurance Platform",
  description: "Next-generation insurance broker CRM and core policy lifecycle administration platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
