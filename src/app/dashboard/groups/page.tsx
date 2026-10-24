
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

const groupTypeLabels: Record<string, string> = {
  kids: "Детская",
  adults: "Взрослая",
  mixed: "Смешанная",
  competition: "Соревновательная",
  private: "Индивидуальные занятия",
};

function formatAgeRange(
  minAge: number | null,
  maxAge: number | null,
): string {
  if (minAge == null && maxAge == null) {
    return "Без ограничений";
  }

  if (minAge == null) {
    return `До ${maxAge} лет`;
  }

  if (maxAge == null) {
    return `От ${minAge} лет`;
  }

  return `${minAge}–${maxAge} лет`;
}

export default function GroupsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-semibold tracking-widest text-red-500">
        STR OF JIU JITSU
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Тренировочные группы
          </h1>

          <p className="mt-3 text-zinc-400">
            Управление группами и возрастными категориями академии
          </p>
        </div>

        <Link
          href="/dashboard/groups/new"
          className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          + Добавить группу
        </Link>
      </div>

      <div className="mt-8">
        <Suspense fallback={<GroupsLoading />}>
          <GroupsContent />
        </Suspense>
      </div>
    </div>
  );
}

function GroupsLoading() {
  return (
    <div
      role="status"
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-sm text-zinc-400"
    >
      Загружаем тренировочные группы...
    </div>
  );
}

async function GroupsContent() {
  await connection();

  const supabase = await createClient();

  const { data: groups, error } = await supabase
    .from("training_groups")
    .select(
      "id, name, description, group_type, min_age, max_age, capacity, is_active, created_at",
    )
    .order("name", { ascending: true })
    .limit(100);

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <p className="font-medium text-red-400">
          Не удалось загрузить тренировочные группы.
        </p>

        <p className="mt-2 text-sm text-zinc-400">
          Проверьте доступ к данным и политики безопасности Supabase.
        </p>
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center">
        <h2 className="text-lg font-semibold">
          Пока нет тренировочных групп
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          Создайте первую группу, нажав кнопку выше.
        </p>

        <Link
          href="/dashboard/groups/new"
          className="mt-5 inline-flex rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          + Создать группу
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 text-zinc-400">
            <tr>
              <th className="p-4">Название</th>
              <th className="p-4">Тип группы</th>
              <th className="p-4">Возраст</th>
              <th className="p-4">Вместимость</th>
              <th className="p-4">Статус</th>
            </tr>
          </thead>

          <tbody>
            {groups.map((group) => (
              <tr
                key={group.id}
                className="border-b border-zinc-800/60 transition-colors hover:bg-zinc-800/40"
              >
                <td className="p-4">
                  <Link
                    href={`/dashboard/groups/${group.id}`}
                    className="font-medium text-white transition-colors hover:text-red-500 hover:underline"
                  >
                    {group.name}
                  </Link>

                  {group.description && (
                    <p className="mt-1 max-w-sm text-xs text-zinc-400">
                      {group.description}
                    </p>
                  )}
                </td>

                <td className="p-4 text-zinc-300">
                  {groupTypeLabels[group.group_type] ??
                    group.group_type}
                </td>

                <td className="p-4 text-zinc-300">
                  {formatAgeRange(group.min_age, group.max_age)}
                </td>

                <td className="p-4 text-zinc-300">
                  {group.capacity ?? "Не ограничена"}
                </td>

                <td className="p-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      group.is_active
                        ? "bg-green-500/10 text-green-400"
                        : "bg-zinc-700/50 text-zinc-300"
                    }`}
                  >
                    {group.is_active ? "Активна" : "Неактивна"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
