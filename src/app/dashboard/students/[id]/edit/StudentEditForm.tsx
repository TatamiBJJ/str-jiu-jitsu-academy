
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateStudent } from "./actions";

type ActionState = {
  error?: string;
};

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  phone: string | null;
  belt: string;
  status: string;
};

const initialState: ActionState = {};

const beltOptions = [
  { value: "white", label: "Белый" },
  { value: "grey_white", label: "Серо-белый" },
  { value: "grey", label: "Серый" },
  { value: "grey_black", label: "Серо-чёрный" },
  { value: "yellow_white", label: "Жёлто-белый" },
  { value: "yellow", label: "Жёлтый" },
  { value: "yellow_black", label: "Жёлто-чёрный" },
  { value: "orange_white", label: "Оранжево-белый" },
  { value: "orange", label: "Оранжевый" },
  { value: "orange_black", label: "Оранжево-чёрный" },
  { value: "green_white", label: "Зелёно-белый" },
  { value: "green", label: "Зелёный" },
  { value: "green_black", label: "Зелёно-чёрный" },
  { value: "blue", label: "Синий" },
  { value: "purple", label: "Пурпурный" },
  { value: "brown", label: "Коричневый" },
  { value: "black", label: "Чёрный" },
];

const statusOptions = [
  { value: "active", label: "Активный" },
  { value: "inactive", label: "Неактивный" },
  { value: "suspended", label: "Приостановлен" },
  { value: "archived", label: "В архиве" },
];

export default function StudentEditForm({
  student,
}: {
  student: Student;
}) {
  const [state, formAction, pending] = useActionState(
    updateStudent.bind(null, student.id),
    initialState
  );

  const inputClass =
    "mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition-colors focus:border-red-500";

  return (
    <form
      action={formAction}
      className="mt-8 space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="first_name"
            className="text-sm font-medium"
          >
            Имя *
          </label>

          <input
            id="first_name"
            name="first_name"
            type="text"
            required
            maxLength={100}
            defaultValue={student.first_name}
            autoComplete="given-name"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="last_name"
            className="text-sm font-medium"
          >
            Фамилия *
          </label>

          <input
            id="last_name"
            name="last_name"
            type="text"
            required
            maxLength={100}
            defaultValue={student.last_name}
            autoComplete="family-name"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="date_of_birth"
            className="text-sm font-medium"
          >
            Дата рождения
          </label>

          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            defaultValue={student.date_of_birth ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="text-sm font-medium"
          >
            Телефон
          </label>

          <input
            id="phone"
            name="phone"
            type="tel"
            maxLength={30}
            defaultValue={student.phone ?? ""}
            autoComplete="tel"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="belt"
            className="text-sm font-medium"
          >
            Пояс *
          </label>

          <select
            id="belt"
            name="belt"
            required
            defaultValue={student.belt}
            className={inputClass}
          >
            {beltOptions.map((belt) => (
              <option key={belt.value} value={belt.value}>
                {belt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="status"
            className="text-sm font-medium"
          >
            Статус *
          </label>

          <select
            id="status"
            name="status"
            required
            defaultValue={student.status}
            className={inputClass}
          >
            {statusOptions.map((status) => (
              <option
                key={status.value}
                value={status.value}
              >
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
        <p className="text-sm text-zinc-300">
          Изменения персональных данных, пояса и статуса
          ученика сохраняются в журнале аудита.
        </p>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-800 pt-5">
        <Link
          href={`/dashboard/students/${student.id}`}
          className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Отмена
        </Link>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {pending
            ? "Сохранение..."
            : "Сохранить изменения"}
        </button>
      </div>
    </form>
  );
}
