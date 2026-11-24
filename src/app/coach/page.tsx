import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";

type ScheduleAccess = {
  academy_id: string;
  member_role: string;
  can_view_schedule: boolean;
  head_group_ids: string[];
  assistant_group_ids: string[];
};

export default async function CoachPage() {
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

  const { data: accessData, error: accessError } =
    await supabase.rpc("get_my_str_schedule_access");

  if (accessError) {
    return (
      <p className="text-red-400">
        Не удалось загрузить права тренера.
      </p>
    );
  }

  const accessRows =
    (accessData ?? []) as ScheduleAccess[];

  const coachAccess = accessRows.filter(
    (row) =>
      row.member_role === "coach" &&
      row.can_view_schedule
  );

  const academyIds = [
    ...new Set(
      coachAccess.map((row) => row.academy_id)
    ),
  ];

  if (academyIds.length > 1) {
    return (
      <p className="text-zinc-400">
        Необходимо выбрать академию.
      </p>
    );
  }

  const headGroupIds = new Set(
    coachAccess.flatMap(
      (row) => row.head_group_ids ?? []
    )
  );

  const assistantGroupIds = new Set(
    coachAccess.flatMap(
      (row) => row.assistant_group_ids ?? []
    )
  );

  const groupIds = [
    ...new Set([
      ...headGroupIds,
      ...assistantGroupIds,
    ]),
  ];

  let groups: {
    id: string;
    name: string;
  }[] = [];

  if (
    groupIds.length > 0 &&
    academyIds.length === 1
  ) {
    const { data, error } = await supabase
      .from("training_groups")
      .select("id, name")
      .eq("academy_id", academyIds[0])
      .in("id", groupIds)
      .order("name");

    if (error) {
      return (
        <p className="text-red-400">
          Не удалось загрузить тренировочные группы.
        </p>
      );
    }

    groups = data ?? [];
  }

  const firstName =
    typeof user.user_metadata?.first_name === "string"
      ? user.user_metadata.first_name
      : "";

  const lastName =
    typeof user.user_metadata?.last_name === "string"
      ? user.user_metadata.last_name
      : "";

  const fullName =
    `${firstName} ${lastName}`.trim() || "Тренер";

  return (
    <div className="mx-auto max-w-6xl">

      <p className="text-sm font-semibold tracking-widest text-red-500">
        STR OF JIU JITSU
      </p>

      <h1 className="mt-4 text-3xl font-bold">
        Кабинет тренера
      </h1>

      <p className="mt-3 text-zinc-400">
        Добро пожаловать, {fullName}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <UsersRound className="text-red-500" />

          <p className="mt-4 text-sm text-zinc-400">
            Мои группы
          </p>

          <p className="mt-2 text-3xl font-bold">
            {groups.length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <ShieldCheck className="text-red-500" />

          <p className="mt-4 text-sm text-zinc-400">
            Главный тренер
          </p>

          <p className="mt-2 text-3xl font-bold">
            {
              groups.filter(
                (group) => headGroupIds.has(group.id)
              ).length
            }
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <UsersRound className="text-red-500" />

          <p className="mt-4 text-sm text-zinc-400">
            Ассистент тренера
          </p>

          <p className="mt-2 text-3xl font-bold">
            {
              groups.filter(
                (group) =>
                  assistantGroupIds.has(group.id)
              ).length
            }
          </p>
        </div>

      </div>

      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">

        <h2 className="text-xl font-bold">
          Мои тренировочные группы
        </h2>

        {groups.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">
            Вам пока не назначены тренировочные группы.
          </p>
        ) : (
          <div className="mt-5 space-y-3">

            {groups.map((group) => (
              <div
                key={group.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
              >
                <p className="font-semibold">
                  {group.name}
                </p>

                <p className="mt-2 text-sm text-green-400">
                  {headGroupIds.has(group.id)
                    ? "Главный тренер"
                    : "Ассистент тренера"}
                </p>
              </div>
            ))}

          </div>
        )}

      </section>

      <Link
        href="/coach/schedule"
        className="mt-6 inline-flex items-center gap-3 rounded-lg bg-red-600 px-5 py-3 font-semibold transition hover:bg-red-500"
      >
        <CalendarDays size={20} />
        Перейти к расписанию
      </Link>

    </div>
  );
}