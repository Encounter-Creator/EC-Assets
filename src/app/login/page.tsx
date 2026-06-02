import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const params = await searchParams;

  return <LoginForm nextPath={params.next || "/dashboard"} isResetRecovery={params.reset === "true"} />;
}
