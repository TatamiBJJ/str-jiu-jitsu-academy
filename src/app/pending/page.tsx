import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Clock3, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default function PendingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
          <p className="text-zinc-400">Загрузка...</p>
        </main>
      }
    >
      <PendingContent />
    </Suspense>
  );
}

async function PendingContent() {
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

  // Перенаправление по ролям

  if (!roleError) {
    switch (role) {
      case "super_admin":
        redirect("/dashboard");

      case "coach":
        redirect("/coach");

      default:
        break;
    }
  }

  const hasAssignedRole =
    !roleError && Boolean(role);

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Администратор",
    manager: "Менеджер",
    coach: "Тренер",
    parent: "Родитель",
    student: "Ученик",
  };

  const roleLabel =
    roleLabels[String(role)] ?? "Не назначена";

  const statusTitle = roleError
    ? "Не удалось проверить доступ"
    : hasAssignedRole
      ? "Ваш кабинет готовится"
      : "Ожидание подтверждения";

  const statusDescription = roleError
    ? "Попробуйте проверить статус повторно."
    : hasAssignedRole
      ? "Ваша роль уже назначена. Личный кабинет для этой роли пока недоступен."
      : "Ваш аккаунт создан. Для получения доступа к системе администратор академии должен назначить вам соответствующую роль.";

  const accountStatus = roleError
    ? "Ошибка проверки доступа"
    : hasAssignedRole
      ? "Роль назначена"
      : "Ожидает назначения доступа";

  async function signOut() {
    "use server";

    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      redirect("/pending");
    }

    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-white">

      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

        <h1 className="text-center text-3xl font-black">
          STR{" "}
          <span className="text-red-500">
            JIU JITSU
          </span>
        </h1>

        <p className="mt-3 text-center text-zinc-400">
          Личный кабинет
        </p>

        <div className="mt-8 flex justify-center">

          <div className="rounded-full border border-amber-500/20 bg-amber-500/10 p-5">
            <Clock3 className="h-10 w-10 text-amber-400" />
          </div>

        </div>

        <h2 className="mt-6 text-center text-xl font-bold">
          {statusTitle}
        </h2>

        <p className="mt-4 text-center text-sm leading-relaxed text-zinc-400">
          {statusDescription}
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5">

          <div>
            <p className="text-xs text-zinc-500">
              Электронная почта
            </p>

            <p className="mt-1 break-all text-sm font-medium">
              {user.email}
            </p>
          </div>

          <div className="border-t border-zinc-800 pt-4">

            <p className="text-xs text-zinc-500">
              Статус аккаунта
            </p>

            <p
              className={`mt-1 text-sm font-semibold ${
                hasAssignedRole
                  ? "text-green-400"
                  : "text-amber-400"
              }`}
            >
              {accountStatus}
            </p>

          </div>

          {!roleError && (
            <div className="border-t border-zinc-800 pt-4">

              <p className="text-xs text-zinc-500">
                Ваша роль
              </p>

              <p className="mt-1 text-sm font-medium">
                {roleLabel}
              </p>

            </div>
          )}

        </div>

        <div className="mt-5 flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-4">

          <ShieldCheck className="h-5 w-5 shrink-0 text-green-400" />

          <p className="text-xs leading-relaxed text-zinc-400">
            Доступ к данным академии предоставляется
            только после проверки разрешений.
          </p>

        </div>

        <a
          href="/pending"
          className="mt-6 block w-full rounded-lg bg-red-600 py-3 text-center font-bold transition hover:bg-red-500"
        >
          Проверить статус
        </a>

        <form action={signOut} className="mt-3">

          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-700 py-3 font-medium text-zinc-400 transition hover:border-zinc-500 hover:text-white"
          >
            Выйти из аккаунта
          </button>

        </form>

      </div>

    </main>
  );
}