import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import AuthGate from "@/components/AuthGate";
import Nav from "@/components/Nav";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Typing Bible — Christian Community",
  description:
    "Read the whole Bible by typing it, track your progress, and join bible studies. 성경타자통독.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-screen">
        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <AuthGate>{children}</AuthGate>
          </main>
        </Providers>
      </body>
    </html>
  );
}
