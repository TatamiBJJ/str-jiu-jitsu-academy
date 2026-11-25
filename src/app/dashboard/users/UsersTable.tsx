"use client";

import { useMemo, useState } from "react";

import {
  Search,
  Users,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import UserRoleActions from "./UserRoleActions";

import {
  ROLE_LABELS,
  ACCOUNT_STATUS_LABELS,
  type UserWithMemberships,
  type AccountStatus,
  type RoleFilter,
  type StatusFilter,
  type UserRole,
} from "./types";

interface UsersTableProps {
  users: UserWithMemberships[];
  currentUserId: string;
}

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<AccountStatus, string> = {
  active:
    "border-green-500/20 bg-green-500/10 text-green-400",

  inactive:
    "border-red-500/20 bg-red-500/10 text-red-400",

  pending:
    "border-amber-500/20 bg-amber-500/10 text-amber-400",

  email_unconfirmed:
    "border-orange-500/20 bg-orange-500/10 text-orange-400",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Almaty",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return dateFormatter.format(date);
}

function getFullName(user: UserWithMemberships) {
  return [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "Имя не указано";
}

export default function UsersTable({
  users,
  currentUserId,
}: UsersTableProps) {

  const [search, setSearch] = useState("");

  const [roleFilter, setRoleFilter] =
    useState<RoleFilter>("all");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [page, setPage] = useState(1);

  // Поиск и фильтрация

  const filteredUsers = useMemo(() => {

    const query = search.trim().toLowerCase();

    return users.filter((user) => {

      const searchableText = [
        user.first_name,
        user.last_name,
        user.email,
        user.phone,
        getFullName(user),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchableText.includes(query);

      const matchesRole =
        roleFilter === "all" ||
        user.roles.includes(roleFilter);

      const matchesStatus =
        statusFilter === "all" ||
        user.account_status === statusFilter;

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );

    });

  }, [users, search, roleFilter, statusFilter]);

  // Пагинация

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);

  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const visibleUsers = filteredUsers.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const hasFilters =
    search.trim() !== "" ||
    roleFilter !== "all" ||
    statusFilter !== "all";

  function resetFilters() {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
  }

  return (
    <section className="space-y-5">

      {/* Панель поиска и фильтрации */}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">

        <div className="mb-4 flex items-center gap-2">

          <Filter className="h-4 w-4 text-zinc-400" />

          <h2 className="text-sm font-semibold text-white">
            Поиск и фильтры
          </h2>

        </div>

        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto]">

          {/* Поиск */}

          <div className="relative">

            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

            <input
              type="search"
              aria-label="Поиск пользователей"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Имя, фамилия, email или телефон"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-red-500"
            />

          </div>

          {/* Фильтр по роли */}

          <select
            aria-label="Фильтр по роли"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(
                event.target.value as RoleFilter
              );
              setPage(1);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-red-500"
          >

            <option value="all">
              Все роли
            </option>

            {Object.entries(ROLE_LABELS).map(
              ([value, label]) => (

                <option key={value} value={value}>
                  {label}
                </option>

              )
            )}

          </select>

          {/* Фильтр по статусу */}

          <select
            aria-label="Фильтр по статусу"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(
                event.target.value as StatusFilter
              );
              setPage(1);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-red-500"
          >

            <option value="all">
              Все статусы
            </option>

            {Object.entries(ACCOUNT_STATUS_LABELS).map(
              ([value, label]) => (

                <option key={value} value={value}>
                  {label}
                </option>

              )
            )}

          </select>

          {/* Сброс фильтров */}

          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-3 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >

            <RotateCcw size={15} />

            Сбросить

          </button>

        </div>

      </div>

      {/* Количество пользователей */}

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">

          <Users size={18} className="text-zinc-400" />

          <p className="text-sm text-zinc-400">

            Найдено пользователей:{" "}

            <span className="font-semibold text-white">
              {filteredUsers.length}
            </span>

            {" "}из {users.length}

          </p>

        </div>

      </div>

      {/* Таблица пользователей */}

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1100px] text-left">

            <thead className="border-b border-zinc-800 bg-zinc-950">

              <tr className="text-xs font-medium uppercase tracking-wide text-zinc-400">

                <th className="px-5 py-4">
                  Пользователь
                </th>

                <th className="px-5 py-4">
                  Роли
                </th>

                <th className="px-5 py-4">
                  Статус
                </th>

                <th className="px-5 py-4">
                  Регистрация
                </th>

                <th className="px-5 py-4">
                  Последний вход
                </th>

                <th className="px-5 py-4">
                  Управление доступом
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-zinc-800">

              {visibleUsers.map((user) => (

                <tr
                  key={user.user_id}
                  className="align-top transition hover:bg-zinc-800/20"
                >

                  {/* Информация о пользователе */}

                  <td className="px-5 py-5">

                    <div className="flex min-w-[220px] items-start gap-3">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 font-semibold text-red-400">

                        {getFullName(user)
                          .charAt(0)
                          .toUpperCase()}

                      </div>

                      <div className="space-y-2">

                        <p className="font-semibold text-white">

                          {getFullName(user)}

                          {user.user_id === currentUserId && (

                            <span className="ml-2 rounded bg-zinc-800 px-2 py-1 text-xs font-normal text-zinc-400">
                              Вы
                            </span>

                          )}

                        </p>

                        <div className="flex items-center gap-2 text-xs text-zinc-400">

                          <Mail size={13} />

                          <span className="break-all">
                            {user.email || "Не указан"}
                          </span>

                        </div>

                        {user.phone && (

                          <div className="flex items-center gap-2 text-xs text-zinc-400">

                            <Phone size={13} />

                            {user.phone}

                          </div>

                        )}

                        <div className={`flex items-center gap-1.5 text-xs ${
                          user.email_confirmed
                            ? "text-green-400"
                            : "text-orange-400"
                        }`}>

                          {user.email_confirmed ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <XCircle size={13} />
                          )}

                          {user.email_confirmed
                            ? "Email подтверждён"
                            : "Email не подтверждён"}

                        </div>

                      </div>

                    </div>

                  </td>

                  {/* Роли пользователя */}

                  <td className="px-5 py-5">

                    <div className="flex min-w-[130px] flex-wrap gap-2">

                      {user.roles.length === 0 ? (

                        <span className="text-xs text-zinc-500">
                          Нет назначенных ролей
                        </span>

                      ) : (

                        user.roles.map((role: UserRole) => {

                          const isActive =
                            user.active_roles.includes(role);

                          return (

                            <span
                              key={role}
                              className={`inline-flex rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                                !isActive
                                  ? "border-zinc-700 bg-zinc-800 text-zinc-500 line-through"
                                  : role === "super_admin"
                                    ? "border-red-500/20 bg-red-500/10 text-red-400"
                                    : "border-zinc-700 bg-zinc-800 text-zinc-200"
                              }`}
                            >

                              {ROLE_LABELS[role]}

                            </span>

                          );

                        })

                      )}

                    </div>

                  </td>

                  {/* Статус аккаунта */}

                  <td className="px-5 py-5">

                    <span className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                      STATUS_STYLES[user.account_status] ??
                      "border-zinc-700 text-zinc-400"
                    }`}>

                      {ACCOUNT_STATUS_LABELS[user.account_status] ??
                        "Неизвестный статус"}

                    </span>

                  </td>

                  {/* Дата регистрации */}

                  <td className="whitespace-nowrap px-5 py-5 text-xs text-zinc-400">

                    {formatDate(user.registered_at)}

                  </td>

                  {/* Последний вход */}

                  <td className="whitespace-nowrap px-5 py-5 text-xs text-zinc-400">

                    {formatDate(user.last_sign_in_at)}

                  </td>

                  {/* Управление ролями */}

                  <td className="px-5 py-5">

                    <UserRoleActions
                      user={user}
                      currentUserId={currentUserId}
                    />

                  </td>

                </tr>

              ))}

              {/* Пустой результат */}

              {visibleUsers.length === 0 && (

                <tr>

                  <td colSpan={6} className="px-6 py-16 text-center">

                    <Users className="mx-auto mb-4 h-10 w-10 text-zinc-600" />

                    <p className="font-medium text-zinc-300">
                      Пользователи не найдены
                    </p>

                    <p className="mt-2 text-sm text-zinc-500">

                      {hasFilters
                        ? "Измените параметры поиска или сбросьте фильтры."
                        : "Зарегистрированные пользователи появятся здесь."}

                    </p>

                    {hasFilters && (

                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                      >
                        Сбросить фильтры
                      </button>

                    )}

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

        {/* Пагинация */}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800 px-5 py-4">

          <p className="text-xs text-zinc-400">

            Показано{" "}

            {filteredUsers.length === 0
              ? 0
              : startIndex + 1}

            {" – "}

            {Math.min(
              startIndex + PAGE_SIZE,
              filteredUsers.length
            )}

            {" "}из {filteredUsers.length}

          </p>

          <div className="flex items-center gap-3">

            <button
              type="button"
              aria-label="Предыдущая страница"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="rounded-lg border border-zinc-700 p-2 text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
            >

              <ChevronLeft size={17} />

            </button>

            <span className="text-sm text-zinc-400">

              {currentPage} / {totalPages}

            </span>

            <button
              type="button"
              aria-label="Следующая страница"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="rounded-lg border border-zinc-700 p-2 text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
            >

              <ChevronRight size={17} />

            </button>

          </div>

        </div>

      </div>

    </section>
  );
}