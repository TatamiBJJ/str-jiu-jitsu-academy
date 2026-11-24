import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  CalendarDays,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/dashboard/LogoutButton";

export default async function CoachLayout({
  children,
}: {
  children: ReactNode;
}) {
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

  if (roleError) {
    redirect("/pending");
  }

  if (role === "super_admin") {
    redirect("/dashboard");
  }

  if (role !== "coach") {
    redirect("/pending");
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-5">

        <div className="mb-8 border-b border-zinc-800 pb-6">
          <h2 className="text-xl font-black">
            STR{" "}
            <span className="text-red-500">
              JIU JITSU
            </span>
          </h2>

          <p className="mt-2 text-xs text-zinc-500">
            Кабинет тренера
          </p>
        </div>

        <nav
          aria-label="Меню тренера"
          className="space-y-1"
        >
          <Link
            href="/coach"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
          >
            <LayoutDashboard size={18} />
            Главная
          </Link>

          <Link
            href="/coach/schedule"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
          >
            <CalendarDays size={18} />
            Расписание
          </Link>
        </nav>

        <div className="mt-6 border-t border-zinc-800 pt-4">
          <LogoutButton />
        </div>

      </aside>

      <main className="min-w-0 flex-1 p-8">
        {children}
      </main>
    </div>
  );
}