
import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/dashboard/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
          <p className="text-zinc-400">Загрузка STR OF JIU JITSU...</p>
        </main>
      }
    >
      <AuthenticatedDashboard>{children}</AuthenticatedDashboard>
    </Suspense>
  );
}

async function AuthenticatedDashboard({
  children,
}: {
  children: ReactNode;
}) {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (roleError || role !== "super_admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p>Доступ ограничен</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <Sidebar />
      <main className="min-w-0 flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
