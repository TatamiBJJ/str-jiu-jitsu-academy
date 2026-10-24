
"use client";

import { useMemo, useState, useActionState } from "react";
import Link from "next/link";
import {
  removeStudent,
  type EnrollState,
} from "./actions";

export type GroupStudent = {
  enrollmentId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  belt: string;
  phone: string | null;
  enrolledAt: string | null;
};

const beltLabels: Record<string, string> = {
  white: "Белый",
  grey_white: "Серо-белый",
  grey: "Серый",
  grey_black: "Серо-чёрный",
  yellow_white: "Жёлто-белый",
  yellow: "Жёлтый",
  yellow_black: "Жёлто-чёрный",
  orange_white: "Оранжево-белый",
  orange: "Оранжевый",
  orange_black: "Оранжево-чёрный",
  green_white: "Зелёно-белый",
  green: "Зелёный",
  green_black: "Зелёно-чёрный",
  blue: "Синий",
  purple: "Пурпурный",
  brown: "Коричневый",
  black: "Чёрный",
};

function formatDate(value: string | null): string {
  if (!value) return "—";

  const parts = value.slice(0, 10).split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

const initialState: EnrollState = {
  status: "idle",
  message: "",
};

function RemoveStudentButton({
  groupId,
  enrollmentId,
  studentName,
}: {
  groupId: string;
  enrollmentId: string;
  studentName: string;
}) {
  const [state, formAction, pending] = useActionState(
    removeStudent,
    initialState,
  );

  return (
    <div className="mt-3">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Исключить ученика «${studentName}» из этой группы? История зачисления сохранится.`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="groupId" value={groupId} />
        <input
          type="hidden"
          name="enrollmentId"
          value={enrollmentId}
        />

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-red-900/80 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Исключаем..." : "Исключить"}
        </button>
      </form>

      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`mt-2 max-w-xs text-xs ${
            state.status === "success"
              ? "text-green-400"
              : state.status === "error"
                ? "text-red-400"
                : "text-zinc-400"
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

export default function GroupStudents({
  groupId,
  students,
}: {
  groupId: string;
  students: GroupStudent[];
}) {
  const [search, setSearch] = useState("");
  const [beltFilter, setBeltFilter] = useState("all");

  const belts = useMemo(
    () => [...new Set(students.map((student) => student.belt))].sort(),
    [students],
  );

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru");

    return students.filter((student) => {
      const fullName =
        `${student.firstName} ${student.lastName}`.toLocaleLowerCase("ru");

      const reverseName =
        `${student.lastName} ${student.firstName}`.toLocaleLowerCase("ru");

      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        reverseName.includes(query) ||
        (student.phone ?? "").toLowerCase().includes(query);

      const matchesBelt =
        beltFilter === "all" || student.belt === beltFilter;

      return matchesSearch && matchesBelt;
    });
  }, [students, search, beltFilter]);

  return (
    <div className="mt-4">
      {students.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="group-student-search"
              className="mb-2 block text-sm text-zinc-400"
            >
              Поиск ученика
            </label>

            <input
              id="group-student-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Имя, фамилия или телефон"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label
              htmlFor="group-student-belt"
              className="mb-2 block text-sm text-zinc-400"
            >
              Фильтр по поясу
            </label>

            <select
              id="group-student-belt"
              value={beltFilter}
              onChange={(event) => setBeltFilter(event.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
            >
              <option value="all">Все пояса</option>

              {belts.map((belt) => (
                <option key={belt} value={belt}>
                  {beltLabels[belt] ?? belt}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <p className="mb-2 text-xs text-zinc-500">
        Показано: {filteredStudents.length} из {students.length}
      </p>

      {students.length === 0 ? (
        <p className="py-2 text-sm text-zinc-400">
          В этой группе пока нет записанных учеников.
        </p>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 p-5 text-center">
          <p className="text-sm text-zinc-400">
            По вашему запросу ученики не найдены.
          </p>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setBeltFilter("all");
            }}
            className="mt-3 text-sm font-medium text-red-400 hover:text-red-300"
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {filteredStudents.map((student) => (
            <div
              key={student.enrollmentId}
              className="flex flex-wrap items-start justify-between gap-3 py-4"
            >
              <div className="min-w-0">
                <Link
                  href={`/dashboard/students/${student.studentId}`}
                  className="font-medium text-white transition-colors hover:text-red-500 hover:underline"
                >
                  {student.firstName} {student.lastName}
                </Link>

                <p className="mt-1 text-xs text-zinc-400">
                  {student.phone || "Телефон не указан"}
                </p>

                <RemoveStudentButton
                  groupId={groupId}
                  enrollmentId={student.enrollmentId}
                  studentName={`${student.firstName} ${student.lastName}`}
                />
              </div>

              <div className="text-right">
                <span className="inline-flex rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                  {beltLabels[student.belt] ?? student.belt}
                </span>

                <p className="mt-1 text-xs text-zinc-500">
                  Записан: {formatDate(student.enrolledAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
