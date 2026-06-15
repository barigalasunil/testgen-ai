import { ProgressProvider } from "@/src/components/shared/ProgressProvider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TCGen-Buddy",
    template: "%s | TCGen-Buddy",
  },
  description: "AI-powered quality assurance and test generation platform",
  applicationName: "TCGen-Buddy",
  icons: {
    icon: [
      {
        url: "/assets/logo/tcgen-buddy-favicon-32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/assets/logo/tcgen-buddy-favicon-16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.png",
    apple: [
      {
        url: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Oxanium&family=Source+Code+Pro&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground">
        <ProgressProvider>
          {children}
        </ProgressProvider>
      </body>
    </html>
  );
}
