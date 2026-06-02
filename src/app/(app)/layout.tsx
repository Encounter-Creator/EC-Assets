import { AppShell } from "@/components/app-shell";
import { ProtectedApp } from "@/components/protected-app";

export const dynamic = "force-dynamic";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedApp>{children}</ProtectedApp>;
}

export function SectionShell({
  children,
  title,
  kicker,
}: Readonly<{
  children: React.ReactNode;
  title: string;
  kicker: string;
}>) {
  return (
    <AppShell title={title} kicker={kicker}>
      {children}
    </AppShell>
  );
}
