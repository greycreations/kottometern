import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Köttometern · Vad säger vädret?",
  description:
    "Stekpannan eller grillen? Ett lekfullt väderindex för platsen du väljer.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
