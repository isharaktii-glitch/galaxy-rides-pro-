
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Galaxy Rides Pro | Sri Lanka",
  description:
    "A modern Sri Lankan ride-sharing and carpooling experience.",
  applicationName: "Galaxy Rides Pro"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#020617"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
