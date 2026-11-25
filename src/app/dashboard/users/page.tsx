import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

import UsersTable from "./UsersTable";

import type {
  AdminUser,
  UserMembership,
  UserWithMemberships,
} from "./types";

export default async function UsersPage() {
  const supabase = await createClient();

  // 1. Проверяем авторизацию

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // 2. Проверяем полномочия Super Admin

  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (roleError || role !== "super_admin") {
    redirect("/pending");
  }

  // 3. Загружаем пользователей и их роли

  const [usersResult, membershipsResult] =
    await Promise.all([
      supabase.rpc("admin_get_str_users"),
      supabase.rpc("admin_get_str_user_memberships"),
    ]);

  // 4. Обрабатываем ошибки загрузки

  if (usersResult.error || membershipsResult.error) {
    console.error("Users page loading error:", {
      users: usersResult.error?.code,
      memberships: membershipsResult.error?.code,
    });

    return (
      <div className="mx-auto max-w-7xl">

        <h1 className="text-3xl font-bold">
          Пользователи
        </h1>

        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-6">

          <h2 className="font-semibold text-red-400">
            Не удалось загрузить пользователей
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Обновите страницу или попробуйте позже.
          </p>

          <a
            href="/dashboard/users"
            className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
          >
            Повторить
          </a>

        </div>

      </div>
    );
  }

  // 5. Типизируем полученные данные

  const users =
    (usersResult.data ?? []) as AdminUser[];

  const memberships =
    (membershipsResult.data ?? []) as UserMembership[];

  // 6. Группируем роли по идентификатору пользователя

  const membershipsByUser = new Map<
    string,
    UserMembership[]
  >();

  for (const membership of memberships) {
    const existing =
      membershipsByUser.get(membership.user_id) ?? [];

    existing.push(membership);

    membershipsByUser.set(
      membership.user_id,
      existing
    );
  }

  // 7. Объединяем пользователей и их роли

  const usersWithMemberships: UserWithMemberships[] =
    users.map((item) => ({
      ...item,
      memberships:
        membershipsByUser.get(item.user_id) ?? [],
    }));

  // 8. Рассчитываем показатели

  const totalUsers = usersWithMemberships.length;

  const activeUsers = usersWithMemberships.filter(
    (item) => item.account_status === "active"
  ).length;

  const pendingUsers = usersWithMemberships.filter(
    (item) => item.account_status === "pending"
  ).length;

  const inactiveUsers = usersWithMemberships.filter(
    (item) => item.account_status === "inactive"
  ).length;

  const unconfirmedUsers = usersWithMemberships.filter(
    (item) => !item.email_confirmed
  ).length;

  // 9. Отображаем страницу

  return (
    <div className="mx-auto max-w-7xl space-y-8">

      <div className="flex items-center gap-4">

        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
          <Users className="h-7 w-7 text-red-500" />
        </div>

        <div>

          <h1 className="text-3xl font-bold">
            Пользователи
          </h1>

          <p className="mt-1 text-sm text-zinc-400">
            Управление аккаунтами, ролями и правами доступа
          </p>

        </div>

      </div>

      {/* Основные показатели */}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">

        <StatCard
          label="Всего пользователей"
          value={totalUsers}
          color="text-white"
        />

        <StatCard
          label="Активные"
          value={activeUsers}
          color="text-green-400"
        />

        <StatCard
          label="Ожидают подтверждения"
          value={pendingUsers}
          color="text-amber-400"
        />

        <StatCard
          label="Доступ отключён"
          value={inactiveUsers}
          color="text-red-400"
        />

        <StatCard
          label="Email не подтверждён"
          value={unconfirmedUsers}
          color="text-orange-400"
        />

      </div>

      {/* Таблица пользователей */}

      <UsersTable
        users={usersWithMemberships}
        currentUserId={user.id}
      />

    </div>
  );
}


// Компонент карточки показателя

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">

      <p className="text-sm text-zinc-400">
        {label}
      </p>

      <p className={`mt-3 text-3xl font-bold ${color}`}>
        {value}
      </p>

    </div>
  );
}