import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import {
  Clock3,
  ShieldCheck,
  ShieldOff,
  MailWarning,
  AlertCircle,
  Construction,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export default function PendingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
          Проверяем статус аккаунта...
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

  // Получаем статус аккаунта и активную роль.

  const [statusResult, roleResult] = await Promise.all([
    supabase.rpc("get_my_str_account_status"),
    supabase.rpc("get_my_str_role"),
  ]);

  const accountStatus = statusResult.data;
  const role = roleResult.data;

  const validStatuses = [
    "pending",
    "active",
    "inactive",
    "email_unconfirmed",
  ];

  const hasError =
    Boolean(statusResult.error) ||
    Boolean(roleResult.error) ||
    !validStatuses.includes(String(accountStatus)) ||
    (accountStatus === "active" && !role);

  // Перенаправляем только активных пользователей.

  if (!hasError && accountStatus === "active") {
    switch (role) {
      case "super_admin":
        redirect("/dashboard");

      case "coach":
        redirect("/coach");

      default:
        break;
    }
  }

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Администратор",
    manager: "Менеджер",
    coach: "Тренер",
    parent: "Родитель",
    student: "Ученик",
  };

  let statusTitle = "Ожидание подтверждения";

  let statusDescription =
    "Ваш аккаунт создан. Для получения доступа к системе администратор академии должен назначить вам соответствующую роль.";

  let statusLabel = "Ожидает назначения доступа";
  let roleLabel = "Не назначена";

  let StatusIcon = Clock3;

  let statusColor = "text-amber-400";

  let iconBackground =
    "border-amber-500/20 bg-amber-500/10";

  // Ошибка проверки доступа.

  if (hasError) {
    statusTitle = "Не удалось проверить доступ";

    statusDescription =
      "Возникла ошибка при проверке статуса аккаунта. Попробуйте обновить статус повторно.";

    statusLabel = "Ошибка проверки доступа";

    StatusIcon = AlertCircle;

    statusColor = "text-red-400";

    iconBackground =
      "border-red-500/20 bg-red-500/10";
  }

  // Электронная почта не подтверждена.

  else if (accountStatus === "email_unconfirmed") {
    statusTitle = "Подтвердите электронную почту";

    statusDescription =
      "Для получения доступа к системе необходимо подтвердить электронную почту. Проверьте входящие сообщения и папку «Спам».";

    statusLabel = "Email не подтверждён";

    roleLabel = "Доступ не предоставлен";

    StatusIcon = MailWarning;
  }

  // Все назначенные роли отключены.

  else if (accountStatus === "inactive") {
    statusTitle = "Доступ отключён";

    statusDescription =
      "Администратор академии отключил ваш доступ к системе. Для восстановления доступа обратитесь к администрации академии.";

    statusLabel = "Доступ отключён";

    roleLabel = "Нет активных ролей";

    StatusIcon = ShieldOff;

    statusColor = "text-red-400";

    iconBackground =
      "border-red-500/20 bg-red-500/10";
  }

  // Роль назначена, но кабинет ещё не реализован.

  else if (accountStatus === "active") {
    statusTitle = "Ваш кабинет готовится";

    statusDescription =
      "Ваш аккаунт подтверждён, и роль успешно назначена. Личный кабинет для этой роли пока недоступен.";

    statusLabel = "Роль назначена";

    roleLabel =
      roleLabels[String(role)] ?? "Неизвестная роль";

    StatusIcon = Construction;

    statusColor = "text-blue-400";

    iconBackground =
      "border-blue-500/20 bg-blue-500/10";
  }

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
          <div
            className={`rounded-full border p-5 ${iconBackground}`}
          >
            <StatusIcon
              className={`h-10 w-10 ${statusColor}`}
            />
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
              className={`mt-1 text-sm font-semibold ${statusColor}`}
            >
              {statusLabel}
            </p>
          </div>

          {!hasError && (
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