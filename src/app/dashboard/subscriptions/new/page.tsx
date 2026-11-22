
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SubscriptionForm from "../SubscriptionForm";

export default function NewSubscriptionPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<SubscriptionLoading />}>
        <NewSubscriptionContent />
      </Suspense>
    </div>
  );
}

function SubscriptionLoading() {
  return (
    <div
      role="status"
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-sm text-zinc-400"
    >
      Загружаем форму назначения абонемента...
    </div>
  );
}

async function NewSubscriptionContent() {
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

  if (
    roleError ||
    !["super_admin", "admin", "manager"].includes(
      String(role),
    )
  ) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-red-400">
        Недостаточно прав для назначения абонемента.
      </div>
    );
  }

  const { data: academyId, error: academyError } =
    await supabase.rpc("get_my_str_admin_academy_id");

  if (academyError || !academyId) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-red-400">
        Не удалось определить академию.
      </div>
    );
  }

  const [studentsResult, plansResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("academy_id", academyId)
      .eq("status", "active")
      .order("last_name", { ascending: true })
      .limit(500),

    supabase
      .from("subscription_plans")
      .select(
        "id, name, price, duration_days, sessions_per_week, is_unlimited",
      )
      .eq("academy_id", academyId)
      .eq("is_active", true)
      .order("price", { ascending: true }),
  ]);

  if (studentsResult.error || plansResult.error) {
    console.error("Subscription form loading failed:", {
      students: studentsResult.error?.code,
      plans: plansResult.error?.code,
    });

    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-red-400">
        Не удалось загрузить учеников или тарифы.
        Проверьте права доступа в Supabase.
      </div>
    );
  }

  return (
    <>
      <p className="text-sm font-semibold tracking-widest text-red-500">
        STR OF JIU JITSU
      </p>

      <div className="mt-4">
        <Link
          href="/dashboard/subscriptions"
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← Назад к абонементам
        </Link>

        <h1 className="mt-5 text-3xl font-bold">
          Назначить абонемент
        </h1>

        <p className="mt-3 text-zinc-400">
          Выберите ученика, тариф и дату начала действия.
        </p>
      </div>

      <div className="mt-8">
        <SubscriptionForm
          students={studentsResult.data ?? []}
          plans={plansResult.data ?? []}
        />
      </div>
    </>
  );
}
