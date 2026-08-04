import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050606",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "Kinetic Forge · Foundry Blackout",
    description: "Clear a collapsed gantry, cross a moving transfer table, and restart an industrial foundry in this real-time Three.js rover prototype.",
    openGraph: {
      title: "Kinetic Forge · Foundry Blackout",
      description: "Recover the route. Deliver the core. Bring Foundry Node 7 back online.",
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og-foundry-blackout.png`, width: 1731, height: 909, alt: "Kinetic Forge rover carrying a power core through Foundry Node 7" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Kinetic Forge · Foundry Blackout",
      description: "Recover the route. Deliver the core. Bring Foundry Node 7 back online.",
      images: [`${origin}/og-foundry-blackout.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
