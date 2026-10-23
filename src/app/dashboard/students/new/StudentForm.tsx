
"use client";

import { useActionState } from "react";
import { createStudent } from "./actions";
import BeltSelect from "../../../../components/dashboard/BeltSelect";

export default function StudentForm() {
  const [state, formAction, pending] = useActionState(
    createStudent,
    { error: null }
  );

  const inputClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white";

  return (
    <form
      action={formAction}
      className="mt-8 space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="first_name" className="mb-2 block text-sm">
            Имя *
          </label>
          <input
            id="first_name"
            name="first_name"
            required
            maxLength={100}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="last_name" className="mb-2 block text-sm">
            Фамилия *
          </label>
          <input
            id="last_name"
            name="last_name"
            required
            maxLength={100}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="date_of_birth" className="mb-2 block text-sm">
            Дата рождения
          </label>
          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="phone" className="mb-2 block text-sm">
            Телефон
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+7 777 123 45 67"
            maxLength={30}
            className={inputClass}
          />
        </div>

        <div>
          <label id="belt-label" className="mb-2 block text-sm">
            Пояс *
          </label>
          <BeltSelect />
        </div>

        <div>
          <label htmlFor="status" className="mb-2 block text-sm">
            Статус *
          </label>
          <select
            id="status"
            name="status"
            defaultValue="active"
            required
            className={inputClass}
          >
            <option value="active">Активный</option>
            <option value="inactive">Неактивный</option>
            <option value="suspended">Приостановлен</option>
            <option value="archived">В архиве</option>
          </select>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex justify-end border-t border-zinc-800 pt-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Сохранение..." : "Сохранить ученика"}
        </button>
      </div>
    </form>
  );
}
