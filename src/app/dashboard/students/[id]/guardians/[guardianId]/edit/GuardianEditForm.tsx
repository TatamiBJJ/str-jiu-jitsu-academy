
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateGuardian } from "./actions";

type ActionState = {
  error?: string;
};

type Guardian = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  relationship: string;
};

const initialState: ActionState = {};

export default function GuardianEditForm({
  studentId,
  guardian,
}: {
  studentId: string;
  guardian: Guardian;
}) {
  const [state, formAction, pending] = useActionState(
    updateGuardian.bind(null, studentId, guardian.id),
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
            defaultValue={guardian.first_name}
            autoComplete="given-name"
            className={inputClass}
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
            defaultValue={guardian.last_name}
            autoComplete="family-name"
            className={inputClass}
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
            defaultValue={guardian.phone}
            autoComplete="tel"
            className={inputClass}
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
            defaultValue={guardian.email ?? ""}
            autoComplete="email"
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="relationship" className="text-sm font-medium">
            Степень родства *
          </label>
          <select
            id="relationship"
            name="relationship"
            required
            defaultValue={guardian.relationship}
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
          Здесь можно изменить контактные данные и степень
          родства. Основной представитель и активность
          управляются отдельно.
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
          href={`/dashboard/students/${studentId}`}
          aria-disabled={pending}
          className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Отмена
        </Link>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Сохранение..." : "Сохранить изменения"}
        </button>
      </div>
    </form>
  );
}
