
"use client";

import { useActionState } from "react";
import { createGuardian } from "./actions";

type ActionState = {
  error?: string;
};

const initialState: ActionState = {};

export default function GuardianForm({
  studentId,
}: {
  studentId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createGuardian.bind(null, studentId),
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
          <label htmlFor="first_name" className="text-sm font-medium">
            Имя *
          </label>
          <input
            id="first_name"
            name="first_name"
            type="text"
            required
            maxLength={100}
            autoComplete="given-name"
            className={inputClass}
            placeholder="Имя родителя"
          />
        </div>

        <div>
          <label htmlFor="last_name" className="text-sm font-medium">
            Фамилия *
          </label>
          <input
            id="last_name"
            name="last_name"
            type="text"
            required
            maxLength={100}
            autoComplete="family-name"
            className={inputClass}
            placeholder="Фамилия родителя"
          />
        </div>

        <div>
          <label htmlFor="phone" className="text-sm font-medium">
            Телефон *
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            minLength={5}
            maxLength={30}
            autoComplete="tel"
            className={inputClass}
            placeholder="+7 777 123 45 67"
          />
        </div>

        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
            className={inputClass}
            placeholder="parent@example.com"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Необязательно
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="relationship" className="text-sm font-medium">
            Степень родства *
          </label>
          <select
            id="relationship"
            name="relationship"
            required
            defaultValue="parent"
            className={inputClass}
          >
            <option value="parent">Родитель</option>
            <option value="guardian">
              Законный представитель
            </option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
        <p className="text-sm text-zinc-300">
          Если у ученика ещё нет основного представителя,
          этот представитель будет назначен основным автоматически.
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
        <button
          type="button"
          onClick={() => window.history.back()}
          disabled={pending}
          className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          Отмена
        </button>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Сохранение..." : "Сохранить родителя"}
        </button>
      </div>
    </form>
  );
}
