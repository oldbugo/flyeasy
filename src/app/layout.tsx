import type { Metadata } from "next";
import { ReactNode } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { listSessionsForDashboard } from "@/lib/db/queries/sessions";

import "./globals.css";

export const metadata: Metadata = {
  title: "FlyEasy",
  description: "Local-first desktop travel-hunt workspace for Trip.com searches."
};

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const sessions = await listSessionsForDashboard();

  return (
    <html lang="en">
      <body>
        <AppShell sessions={sessions}>{children}</AppShell>
      </body>
    </html>
  );
}
