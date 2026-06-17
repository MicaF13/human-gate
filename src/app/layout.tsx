import type { Metadata, Viewport } from "next";
import "./globals.css";
import MiniKitProvider from "@/components/minikit-provider";

export const metadata: Metadata = {
  title: "Human Gate — World ID",
  description: "Replace CAPTCHAs with World ID proof of personhood.",
};

// Mobile-first: mini-apps are accessed on phones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b0f17",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <main className="mx-auto min-h-dvh max-w-md px-5 py-8">
          <MiniKitProvider>{children}</MiniKitProvider>
        </main>
      </body>
    </html>
  );
}
