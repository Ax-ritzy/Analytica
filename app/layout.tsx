import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "FAW-AI | Faculty AI Workload Assistant",
  description: "An intelligent higher education academic productivity workspace for faculty and administrators.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
