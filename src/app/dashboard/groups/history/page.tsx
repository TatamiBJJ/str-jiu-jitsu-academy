
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AuditLog = {
  id: string;
  record_id: string;
  action: string;
  changed_by: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

type Enrollment = {
  id: string;
  student_id: string;
  group_id: string;
  status: string;
  enrolled_at: string | null;
  ended_at: string | null;
  removal_reason: string | null;
};

type Student = {
  id: string;
  first_name: string;
  last_name: string;
};

type TrainingGroup = {
  id: string;
  name: string;
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type Filters = {
  search: string;
  action: string;
  from: string;
  to: string;
};

type HistoryRow = {
  id: string;
  studentId: string | null;
  studentName: string;
  groupName: string;
  action: string;
  isRemoval: boolean;
  reason: string;
  adminName: string;
  createdAt: string;
};

type HistorySearchParams = Promise<{
  search?: string;
  action?: string;
  from?: string;
  to?: string;
}>;

function getString(
  data: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = data?.[key];
  return typeof value === "string" ? value : null;
}

function formatReason(value: string | null): string {
  return value?.trim() || "Не указана";
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  const parts = value.slice(0, 10).split("-");

  if (parts.length !== 3) return "—";

  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Almaty",
  }).format(date);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("ru");
}

function matchesSearch(
  search: string,
  ...values: (string | null | undefined)[]
): boolean {
  if (!search) return true;

  return values.some((value) =>
    normalize(value ?? "").includes(search),
  );
}

function matchesDate(
  value: string | null,
  from: string,
  to: string,
): boolean {
  if (!value) return !from && !to;

  const date = value.slice(0, 10);

  if (from && date < from) return false;
  if (to && date > to) return false;

  return true;
}

// Статическая оболочка страницы.
// Динамические данные обрабатываются внутри Suspense.
export default function GroupHistoryPage({
  searchParams,
}: {
  searchParams: HistorySearchParams;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard/groups"
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← Назад к группам
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold tracking-widest text-red-500">
          STR OF JIU JITSU
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          История участников
        </h1>

        <p className="mt-3 text-zinc-400">
          Журнал зачислений, исключений и действий администраторов
        </p>
      </div>

      <Suspense
        fallback={
          <p className="mt-8 text-sm text-zinc-400">
            Загружаем историю...
          </p>
        }
      >
        <GroupHistoryContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function GroupHistoryContent({
  searchParams,
}: {
  searchParams: HistorySearchParams;
}) {
  // Динамический рендеринг внутри Suspense.
  await connection();

  const params = await searchParams;

  const filters: Filters = {
    search:
      typeof params.search === "string"
        ? params.search.slice(0, 150)
        : "",

    action:
      typeof params.action === "string" &&
      ["all", "enrolled", "removed", "other"].includes(
        params.action,
      )
        ? params.action
        : "all",

    from:
      typeof params.from === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(params.from)
        ? params.from
        : "",

    to:
      typeof params.to === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(params.to)
        ? params.to
        : "",
  };

  const supabase = await createClient();

  // Проверка авторизации.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <p className="mt-8 text-red-400">
        Необходимо войти в систему.
      </p>
    );
  }

  // Доступ только для Super Admin.
  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (roleError || role !== "super_admin") {
    return (
      <p className="mt-8 text-red-400">
        Доступ разрешён только Super Admin.
      </p>
    );
  }

  const { data: academyId, error: academyError } =
    await supabase.rpc("get_my_str_admin_academy_id");

  if (academyError || !academyId) {
    return (
      <p className="mt-8 text-red-400">
        Не удалось определить академию.
      </p>
    );
  }

  // Загрузка истории, учеников и групп.
  const [
    auditResult,
    enrollmentResult,
    studentResult,
    groupResult,
  ] = await Promise.all([
    supabase
      .from("audit_logs")
      .select(
        "id, record_id, action, changed_by, old_data, new_data, created_at",
      )
      .eq("academy_id", academyId)
      .eq("table_name", "group_enrollments")
      .order("created_at", { ascending: false })
      .limit(1000),

    supabase
      .from("group_enrollments")
      .select(
        "id, student_id, group_id, status, enrolled_at, ended_at, removal_reason",
      )
      .eq("academy_id", academyId)
      .order("created_at", { ascending: false })
      .limit(1000),

    supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("academy_id", academyId)
      .limit(1000),

    supabase
      .from("training_groups")
      .select("id, name")
      .eq("academy_id", academyId)
      .limit(1000),
  ]);

  if (
    auditResult.error ||
    enrollmentResult.error ||
    studentResult.error ||
    groupResult.error
  ) {
    return (
      <p role="alert" className="mt-8 text-red-400">
        Не удалось загрузить историю участников.
      </p>
    );
  }

  const logs = (auditResult.data ?? []) as AuditLog[];

  const enrollments =
    (enrollmentResult.data ?? []) as Enrollment[];

  const students = (studentResult.data ?? []) as Student[];

  const groups = (groupResult.data ?? []) as TrainingGroup[];

  // Получаем администраторов, выполнявших действия.
  const adminIds = [
    ...new Set(
      logs
        .map((log) => log.changed_by)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let profiles: Profile[] = [];

  if (adminIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", adminIds);

    if (error) {
      return (
        <p role="alert" className="mt-8 text-red-400">
          Не удалось загрузить данные администраторов.
          Проверьте права чтения profiles.
        </p>
      );
    }

    profiles = (data ?? []) as Profile[];
  }

  const enrollmentMap = new Map(
    enrollments.map((item) => [item.id, item]),
  );

  const studentMap = new Map(
    students.map((item) => [item.id, item]),
  );

  const groupMap = new Map(
    groups.map((item) => [item.id, item]),
  );

  const profileMap = new Map(
    profiles.map((item) => [item.id, item]),
  );

  function getStudentName(studentId: string | null): string {
    if (!studentId) return "Неизвестный ученик";

    const student = studentMap.get(studentId);

    return student
      ? `${student.first_name} ${student.last_name}`
      : "Ученик недоступен";
  }

  function getGroupName(groupId: string | null): string {
    if (!groupId) return "Неизвестная группа";

    return groupMap.get(groupId)?.name ?? "Группа недоступна";
  }

  function getAdminName(adminId: string | null): string {
    if (!adminId) return "Не указан";

    const profile = profileMap.get(adminId);

    if (!profile) {
      return `Пользователь ${adminId.slice(0, 8)}`;
    }

    const name = [
      profile.first_name,
      profile.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return name || `Пользователь ${adminId.slice(0, 8)}`;
  }

  const search = normalize(filters.search);

  // Исключённые ученики.
  // Записи не удаляются из базы данных.
  const removedStudents = enrollments
    .filter((item) => item.status === "cancelled")
    .filter((item) =>
      matchesSearch(
        search,
        getStudentName(item.student_id),
        getGroupName(item.group_id),
        item.removal_reason,
      ),
    )
    .filter((item) =>
      matchesDate(item.ended_at, filters.from, filters.to),
    )
    .sort((a, b) =>
      (b.ended_at ?? "").localeCompare(a.ended_at ?? ""),
    );

  // Преобразование записей аудита для интерфейса.
  const historyRows: HistoryRow[] = logs.map((log) => {
    const enrollment = enrollmentMap.get(log.record_id);

    const studentId =
      getString(log.new_data, "student_id") ??
      getString(log.old_data, "student_id") ??
      enrollment?.student_id ??
      null;

    const groupId =
      getString(log.new_data, "group_id") ??
      getString(log.old_data, "group_id") ??
      enrollment?.group_id ??
      null;

    const oldStatus = getString(log.old_data, "status");
    const newStatus = getString(log.new_data, "status");

    const isRemoval =
      log.action === "UPDATE" &&
      oldStatus === "active" &&
      newStatus === "cancelled";

    const action = isRemoval
      ? "Исключён"
      : log.action === "INSERT"
        ? "Зачислен"
        : log.action === "DELETE"
          ? "Удалена запись"
          : "Изменение";

    const auditReason =
      getString(log.new_data, "removal_reason") ??
      getString(log.old_data, "removal_reason");

    return {
      id: log.id,
      studentId,
      studentName: getStudentName(studentId),
      groupName: getGroupName(groupId),
      action,
      isRemoval,
      reason: isRemoval
        ? formatReason(auditReason)
        : "—",
      adminName: getAdminName(log.changed_by),
      createdAt: log.created_at,
    };
  });

  const filteredLogs = historyRows
    .filter((row) => {
      if (filters.action === "enrolled") {
        return row.action === "Зачислен";
      }

      if (filters.action === "removed") {
        return row.isRemoval;
      }

      if (filters.action === "other") {
        return row.action !== "Зачислен" && !row.isRemoval;
      }

      return true;
    })
    .filter((row) =>
      matchesSearch(
        search,
        row.studentName,
        row.groupName,
        row.adminName,
        row.reason,
      ),
    )
    .filter((row) =>
      matchesDate(row.createdAt, filters.from, filters.to),
    );

  return (
    <div className="mt-8 space-y-8">
      {/* Поиск и фильтры */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">
          Поиск и фильтры
        </h2>

        <form
          method="GET"
          action="/dashboard/groups/history"
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <div className="lg:col-span-2">
            <label
              htmlFor="history-search"
              className="mb-2 block text-sm text-zinc-400"
            >
              Поиск
            </label>

            <input
              id="history-search"
              name="search"
              type="search"
              defaultValue={filters.search}
              placeholder="Ученик, группа, администратор, причина"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label
              htmlFor="history-action"
              className="mb-2 block text-sm text-zinc-400"
            >
              Действие
            </label>

            <select
              id="history-action"
              name="action"
              defaultValue={filters.action}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white"
            >
              <option value="all">Все действия</option>
              <option value="enrolled">Зачисления</option>
              <option value="removed">Исключения</option>
              <option value="other">Другие изменения</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="history-from"
              className="mb-2 block text-sm text-zinc-400"
            >
              Дата от
            </label>

            <input
              id="history-from"
              name="from"
              type="date"
              defaultValue={filters.from}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white"
            />
          </div>

          <div>
            <label
              htmlFor="history-to"
              className="mb-2 block text-sm text-zinc-400"
            >
              Дата до
            </label>

            <input
              id="history-to"
              name="to"
              type="date"
              defaultValue={filters.to}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3 lg:col-span-3">
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              Применить фильтры
            </button>

            <Link
              href="/dashboard/groups/history"
              className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Сбросить
            </Link>
          </div>
        </form>
      </section>

      {/* История исключённых учеников */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Исключённые ученики
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              История завершённых зачислений
            </p>
          </div>

          <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
            {removedStudents.length}
          </span>
        </div>

        {removedStudents.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-400">
            По выбранным условиям записей нет.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-700 text-zinc-400">
                <tr>
                  <th className="p-3">Ученик</th>
                  <th className="p-3">Группа</th>
                  <th className="p-3">Зачислен</th>
                  <th className="p-3">Исключён</th>
                  <th className="p-3">Причина исключения</th>
                </tr>
              </thead>

              <tbody>
                {removedStudents.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-zinc-800"
                  >
                    <td className="p-3">
                      <Link
                        href={`/dashboard/students/${item.student_id}`}
                        className="text-white hover:text-red-400"
                      >
                        {getStudentName(item.student_id)}
                      </Link>
                    </td>

                    <td className="p-3 text-zinc-300">
                      {getGroupName(item.group_id)}
                    </td>

                    <td className="whitespace-nowrap p-3 text-zinc-300">
                      {formatDate(item.enrolled_at)}
                    </td>

                    <td className="whitespace-nowrap p-3 text-red-400">
                      {formatDate(item.ended_at)}
                    </td>

                    <td className="max-w-xs whitespace-pre-wrap break-words p-3 text-zinc-300">
                      {formatReason(item.removal_reason)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Журнал действий */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Все действия
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              Автоматический журнал операций с участниками групп
            </p>
          </div>

          <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
            {filteredLogs.length}
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-400">
            По выбранным условиям записей нет.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-700 text-zinc-400">
                <tr>
                  <th className="p-3">Дата</th>
                  <th className="p-3">Ученик</th>
                  <th className="p-3">Группа</th>
                  <th className="p-3">Действие</th>
                  <th className="p-3">Причина</th>
                  <th className="p-3">Администратор</th>
                </tr>
              </thead>

              <tbody>
                {filteredLogs.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-800"
                  >
                    <td className="whitespace-nowrap p-3 text-zinc-300">
                      {formatDateTime(row.createdAt)}
                    </td>

                    <td className="p-3">
                      {row.studentId ? (
                        <Link
                          href={`/dashboard/students/${row.studentId}`}
                          className="text-white hover:text-red-400"
                        >
                          {row.studentName}
                        </Link>
                      ) : (
                        row.studentName
                      )}
                    </td>

                    <td className="p-3 text-zinc-300">
                      {row.groupName}
                    </td>

                    <td
                      className={`p-3 ${
                        row.isRemoval
                          ? "text-red-400"
                          : row.action === "Зачислен"
                            ? "text-green-400"
                            : "text-zinc-300"
                      }`}
                    >
                      {row.action}
                    </td>

                    <td className="max-w-xs whitespace-pre-wrap break-words p-3 text-zinc-300">
                      {row.reason}
                    </td>

                    <td className="p-3 text-zinc-300">
                      {row.adminName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-zinc-500">
        Журнал отображает до 1000 последних записей.
        Старые записи не удаляются из базы данных.
      </p>
    </div>
  );
}
