import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ask Higgsy",
  description: "Call Higgsy, a voice guide to Higgsfield's models. Unofficial, built with ComfyUI.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fbf3df" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
