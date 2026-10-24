
"use client";

import { useActionState } from "react";
import {
  enrollStudent,
  type EnrollState,
} from "./actions";

type StudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  belt: string;
  phone: string | null;
};

type Props = {
  groupId: string;
  students: StudentOption[];
  canEnroll: boolean;
};

const initialState: EnrollState = {
  status: "idle",
  message: "",
};

export default function EnrollmentManager({
  groupId,
  students,
  canEnroll,
}: Props) {
  const [state, formAction, pending] = useActionState(
    enrollStudent,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="mt-5 space-y-4"
    >
      <input
        type="hidden"
        name="groupId"
        value={groupId}
      />

      {students.length === 0 ? (
        <p className="text-sm text-zinc-400">
          Нет доступных активных учеников для зачисления.
        </p>
      ) : (
        <>
          <div>
            <label
              htmlFor="studentId"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Выберите ученика
            </label>

            <select
              id="studentId"
              name="studentId"
              required
              defaultValue=""
              disabled={!canEnroll || pending}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none transition-colors focus:border-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                Выберите ученика из списка
              </option>

              {students.map((student) => (
                <option
                  key={student.id}
                  value={student.id}
                >
                  {student.last_name} {student.first_name}
                  {" — "}
                  {student.belt}
                </option>
              ))}
            </select>
          </div>

          {!canEnroll && (
            <p className="text-sm text-amber-400">
              Зачисление недоступно: группа неактивна
              или достигнута максимальная вместимость.
            </p>
          )}

          <button
            type="submit"
            disabled={!canEnroll || pending}
            className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Зачисляем..." : "+ Добавить ученика"}
          </button>
        </>
      )}

      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`rounded-lg border p-3 text-sm ${
            state.status === "success"
              ? "border-green-800 bg-green-950/40 text-green-400"
              : state.status === "error"
                ? "border-red-800 bg-red-950/40 text-red-400"
                : "border-zinc-800 text-zinc-300"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
