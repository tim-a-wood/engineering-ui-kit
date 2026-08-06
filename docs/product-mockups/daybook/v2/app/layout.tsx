import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daybook · Teacher Planning",
  description: "A desktop-first early years planning, teaching and reflection studio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
