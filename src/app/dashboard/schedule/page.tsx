
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

type ScheduleAccess = {
  academy_id: string;
  member_role: string;
  can_view_schedule: boolean;
  can_edit_schedule: boolean;
  can_manage_all_sessions: boolean;
  head_group_ids: string[];
  assistant_group_ids: string[];
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

  // 1. Проверка авторизации

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // 2. Получение прав через защищенную RPC

  const {
    data: accessData,
    error: accessError,
  } = await supabase.rpc(
    "get_my_str_schedule_access",
  );

  if (accessError) {
    console.error(
      "Schedule access RPC failed:",
      accessError.code,
    );

    return (
      <ErrorMessage message="Не удалось проверить права доступа к расписанию." />
    );
  }

  const accessRows =
    (accessData ?? []) as ScheduleAccess[];

  const availableAcademies = accessRows.filter(
    (row) => row.can_view_schedule === true,
  );

  if (availableAcademies.length === 0) {
    return (
      <ErrorMessage message="Недостаточно прав для просмотра расписания." />
    );
  }

  // Пока система работает с одной академией.
  // При подключении нескольких академий
  // потребуется отдельный выбор академии.

  const academyIds = new Set(
    availableAcademies.map(
      (row) => row.academy_id,
    ),
  );

  if (academyIds.size !== 1) {
    return (
      <ErrorMessage message="Необходимо выбрать академию для просмотра расписания." />
    );
  }

  const academyId =
    availableAcademies[0].academy_id;

  const canEditSchedule =
    availableAcademies.some(
      (row) => row.can_edit_schedule === true,
    );

  const canManageAllSessions =
    availableAcademies.some(
      (row) =>
        row.can_manage_all_sessions === true,
    );

  const headCoachGroupIds = new Set<string>(
    availableAcademies.flatMap(
      (row) => row.head_group_ids ?? [],
    ),
  );

  const assistantCoachGroupIds = new Set<string>(
    availableAcademies.flatMap(
      (row) => row.assistant_group_ids ?? [],
    ),
  );

  const allowedGroupIds = Array.from(
    new Set([
      ...headCoachGroupIds,
      ...assistantCoachGroupIds,
    ]),
  );

  const hasFullScheduleAccess =
    canEditSchedule || canManageAllSessions;

  if (
    !hasFullScheduleAccess &&
    allowedGroupIds.length === 0
  ) {
    return (
      <ErrorMessage message="У вас нет закрепленных тренировочных групп." />
    );
  }

  const today = getKazakhstanDate();

  // 3. Загрузка расписания

  let schedulesQuery = supabase
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
    });

  // 4. Загрузка тренировочных групп

  let groupsQuery = supabase
    .from("training_groups")
    .select("id, name")
    .eq("academy_id", academyId)
    .order("name", {
      ascending: true,
    });

  // Дополнительная фильтрация для тренеров.
  // Основная защита остается на уровне RLS.

  if (!hasFullScheduleAccess) {
    schedulesQuery = schedulesQuery.in(
      "group_id",
      allowedGroupIds,
    );

    groupsQuery = groupsQuery.in(
      "id",
      allowedGroupIds,
    );
  }

  const [schedulesResult, groupsResult] =
    await Promise.all([
      schedulesQuery,
      groupsQuery,
    ]);

  if (
    schedulesResult.error ||
    groupsResult.error
  ) {
    console.error("Schedule loading failed:", {
      schedules: schedulesResult.error?.code,
      groups: groupsResult.error?.code,
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

  // 5. Определяем период ближайших занятий

  const todayStart = new Date(
    `${today}T00:00:00+05:00`,
  );

  const until = new Date(todayStart);

  until.setUTCDate(
    until.getUTCDate() + 14,
  );

  // 6. Загрузка конкретных тренировок

  let sessionsQuery = supabase
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

  if (!hasFullScheduleAccess) {
    sessionsQuery = sessionsQuery.in(
      "group_id",
      allowedGroupIds,
    );
  }

  const {
    data: sessionsData,
    error: sessionsError,
  } = await sessionsQuery;

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

  // 7. Определяем право управления занятиями.
  //
  // Администратор — все занятия.
  // Главный тренер — только свои группы.
  // Ассистент — только просмотр.

  const canManageSessionIds =
    upcomingSessions
      .filter(
        (session) =>
          canManageAllSessions ||
          headCoachGroupIds.has(
            session.group_id,
          ),
      )
      .map((session) => session.id);

  // 8. Формируем недельное расписание

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
          schedule.day_of_week === index + 1,
      ),
    }),
  );

  // 9. Определяем подпись уровня доступа

  const accessLabel = canEditSchedule
    ? "Полный доступ"
    : headCoachGroupIds.size > 0
      ? "Главный тренер"
      : "Только просмотр";

  return (
    <>
      <p className="text-sm font-semibold tracking-widest text-red-500">
        STR OF JIU JITSU
      </p>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Расписание тренировок
          </h1>

          <p className="mt-3 text-zinc-400">
            Регулярное расписание тренировочных
            групп и управление занятиями.
          </p>
        </div>

        <span
          className={
            canEditSchedule
              ? "rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-2 text-xs font-semibold text-green-400"
              : "rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-400"
          }
        >
          {accessLabel}
        </span>
      </div>

      {/* Информация для тренеров */}

      {!hasFullScheduleAccess && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm font-medium text-white">
            Ваши тренировочные группы
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {groups.map((group) => (
              <span
                key={group.id}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300"
              >
                {group.name}

                {headCoachGroupIds.has(
                  group.id,
                )
                  ? " — главный тренер"
                  : " — ассистент"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Создание расписания */}

      {canEditSchedule && (
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

                          {/* Редактирование расписания */}

                          {canEditSchedule && (
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

      {/* Ближайшие занятия */}

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
