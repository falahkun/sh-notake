import "./globals.css";
import { QueryProvider } from "@/components/query-provider";

export const metadata = {
  title: "Share Note SX",
  description: "Zero-knowledge public note sharing"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><QueryProvider>{children}</QueryProvider></body>
    </html>
  );
}
