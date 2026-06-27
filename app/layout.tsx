import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NCTB Study Companion",
  description: "Class 6 English for Today line-by-line study app prototype"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
