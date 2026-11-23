
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import ScheduleForm from "./ScheduleForm";
import DeleteScheduleButton from "./DeleteScheduleButton";
import EditScheduleButton from "./EditScheduleButton";
import UpcomingSessions, {
  type UpcomingSession,
} from "./UpcomingSessions";

type Schedule = {
  id: string;
  group_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  training_type: string;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
};

type TrainingGroup = {
  id: string;
  name: string;
};


const days = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

const trainingTypes: Record<string, string> = {
  gi: "Gi (кимоно)",
  nogi: "No-Gi",
  open_mat: "Open Mat",
  competition: "Подготовка к соревнованиям",
  other: "Другое",
};

function formatTime(value: string) {
  return value.slice(0, 5);
}

function getKazakhstanDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function ErrorMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400"
    >
      {message}
    </div>
  );
}

function ScheduleLoading() {
  return (
    <div
      role="status"
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-sm text-zinc-400"
    >
      Загружаем расписание...
    </div>
  );
}

export default function SchedulePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <Suspense fallback={<ScheduleLoading />}>
        <ScheduleContent />
      </Suspense>
    </div>
  );
}

async function ScheduleContent() {
  await connection();

  const supabase = await createClient();

  // Проверка авторизации
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Используем существующие RPC для определения
  // административной роли и академии.
  const [roleResult, academyResult] =
    await Promise.all([
      supabase.rpc("get_my_str_role"),
      supabase.rpc(
        "get_my_str_admin_academy_id",
      ),
    ]);

  if (roleResult.error || academyResult.error) {
    console.error("Access RPC failed:", {
      role: roleResult.error?.code,
      academy: academyResult.error?.code,
    });

    return (
      <ErrorMessage message="Не удалось проверить доступ к академии." />
    );
  }

  const role = String(roleResult.data ?? "");
  const academyId =
    academyResult.data as string | null;

  if (!academyId) {
    return (
      <ErrorMessage message="Не удалось определить академию." />
    );
  }

  const isAdmin =
    role === "super_admin" ||
    role === "admin";

  const isManager = role === "manager";

  const today = getKazakhstanDate();

  // Проверяем, является ли пользователь
  // главным тренером конкретных групп.
  //
  // Используем существующий member_id,
  // если он доступен через RLS.

  // Назначения главного тренера.
  // Администратору не требуется дополнительная
  // проверка через academy_members.
  const headCoachGroupIds = new Set<string>();

  if (!isAdmin && !isManager) {
    // Доступ главного тренера подключим
    // через отдельную защищённую RPC.
    // Прямые запросы к academy_members
    // не выполняем из-за RLS (42501).
  }

  const isHeadCoach =
    headCoachGroupIds.size > 0;


  if (
    !isAdmin &&
    !isManager &&
    !isHeadCoach
  ) {
    return (
      <ErrorMessage message="Недостаточно прав для просмотра расписания." />
    );
  }

  // Загружаем регулярное расписание
  // и тренировочные группы.
  const [schedulesResult, groupsResult] =
    await Promise.all([
      supabase
        .from("training_schedules")
        .select(
          "id, group_id, day_of_week, start_time, end_time, training_type, valid_from, valid_until, is_active",
        )
        .eq("academy_id", academyId)
        .eq("is_active", true)
        .order("day_of_week", {
          ascending: true,
        })
        .order("start_time", {
          ascending: true,
        }),

      supabase
        .from("training_groups")
        .select("id, name")
        .eq("academy_id", academyId)
        .order("name", {
          ascending: true,
        }),
    ]);

  if (
    schedulesResult.error ||
    groupsResult.error
  ) {
    console.error("Schedule loading failed:", {
      schedules:
        schedulesResult.error?.code,
      groups:
        groupsResult.error?.code,
    });

    return (
      <ErrorMessage message="Не удалось загрузить расписание или тренировочные группы." />
    );
  }

  const schedules =
    (schedulesResult.data ?? []) as Schedule[];

  const groups =
    (groupsResult.data ?? []) as TrainingGroup[];

  const groupNames = new Map(
    groups.map((group) => [
      group.id,
      group.name,
    ]),
  );

  // Начало сегодняшнего дня в Казахстане
  const todayStart = new Date(
    `${today}T00:00:00+05:00`,
  );

  const until = new Date(todayStart);
  until.setUTCDate(
    until.getUTCDate() + 14,
  );

  // Загружаем конкретные занятия
  // на ближайшие 14 дней.
  const {
    data: sessionsData,
    error: sessionsError,
  } = await supabase
    .from("training_sessions")
    .select(
      "id, group_id, starts_at, ends_at, training_type, status",
    )
    .eq("academy_id", academyId)
    .gte(
      "starts_at",
      todayStart.toISOString(),
    )
    .lt(
      "starts_at",
      until.toISOString(),
    )
    .order("starts_at", {
      ascending: true,
    })
    .limit(200);

  if (sessionsError) {
    console.error(
      "Training sessions loading failed:",
      sessionsError.code,
    );

    return (
      <ErrorMessage message="Не удалось загрузить ближайшие занятия." />
    );
  }

  const upcomingSessions =
    (sessionsData ?? []) as UpcomingSession[];

  // Администратор управляет всеми занятиями.
  // Главный тренер — только своими группами.
  // Менеджер не получает кнопки управления.
  const canManageSessionIds =
    upcomingSessions
      .filter((session) => {
        if (isAdmin) {
          return true;
        }

        return headCoachGroupIds.has(
          session.group_id,
        );
      })
      .map((session) => session.id);

  // Активное и будущее недельное расписание
  const currentSchedules =
    schedules.filter(
      (schedule) =>
        schedule.valid_until === null ||
        schedule.valid_until >= today,
    );

  const schedulesByDay = days.map(
    (day, index) => ({
      day,
      dayOfWeek: index + 1,
      schedules: currentSchedules.filter(
        (schedule) =>
          schedule.day_of_week ===
          index + 1,
      ),
    }),
  );

  return (
    <>
      <p className="text-sm font-semibold tracking-widest text-red-500">
        STR OF JIU JITSU
      </p>

      <div className="mt-5">
        <h1 className="text-3xl font-bold text-white">
          Расписание тренировок
        </h1>

        <p className="mt-3 text-zinc-400">
          Регулярное расписание тренировочных
          групп и управление занятиями.
        </p>
      </div>

      {/* Форма добавления расписания */}
      {isAdmin && (
        <section className="mt-8">
          <h2 className="mb-5 text-xl font-bold text-white">
            Добавить тренировку в расписание
          </h2>

          <ScheduleForm groups={groups} />
        </section>
      )}

      {/* Недельное расписание */}
      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white">
            Текущее расписание
          </h2>

          <span className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400">
            На {today}
          </span>
        </div>

        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {schedulesByDay.map(
            ({
              day,
              dayOfWeek,
              schedules: daySchedules,
            }) => (
              <section
                key={dayOfWeek}
                className="flex min-h-[300px] flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <h3 className="mb-5 text-lg font-bold text-white">
                  {day}
                </h3>

                {daySchedules.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Тренировок нет
                  </p>
                ) : (
                  <div className="grid flex-1 auto-rows-fr gap-3">
                    {daySchedules.map(
                      (schedule) => (
                        <div
                          key={schedule.id}
                          className="flex h-full min-h-[220px] flex-col rounded-lg border border-zinc-700 bg-zinc-950 p-4"
                        >
                          <div className="flex-1">
                            <p className="text-lg font-semibold text-white">
                              {formatTime(
                                schedule.start_time,
                              )}
                              {" — "}
                              {formatTime(
                                schedule.end_time,
                              )}
                            </p>

                            <p className="mt-2 text-sm text-zinc-300">
                              {groupNames.get(
                                schedule.group_id,
                              ) ??
                                "Группа не найдена"}
                            </p>

                            <span className="mt-3 inline-block rounded-md bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
                              {trainingTypes[
                                schedule.training_type
                              ] ??
                                schedule.training_type}
                            </span>
                          </div>

                          {/* Редактирование только администратором */}
                          {isAdmin && (
                            <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
                              <EditScheduleButton
                                schedule={schedule}
                              />

                              <DeleteScheduleButton
                                scheduleId={
                                  schedule.id
                                }
                              />
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </section>
            ),
          )}
        </div>
      </section>

      {/* Конкретные занятия */}
      <UpcomingSessions
        sessions={upcomingSessions}
        groupNames={Object.fromEntries(
          groupNames,
        )}
        canManageSessionIds={
          canManageSessionIds
        }
      />
    </>
  );
}
