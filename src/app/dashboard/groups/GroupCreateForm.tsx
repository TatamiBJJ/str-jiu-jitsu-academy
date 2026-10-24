
"use client";

import { useActionState } from "react";
import { createTrainingGroup } from "./actions";
import type { CreateGroupState } from "./actions";

const initialState: CreateGroupState = {
  success: false,
  message: "",
};

const inputClassName =
  "mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500";

const labelClassName = "block text-sm font-medium text-zinc-300";

export default function GroupCreateForm() {
  const [state, formAction, isPending] = useActionState(
    createTrainingGroup,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-white">
          Новая тренировочная группа
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Заполните информацию о группе. Академия определяется автоматически.
        </p>
      </div>

      <div>
        <label htmlFor="name" className={labelClassName}>
          Название группы *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          autoComplete="off"
          placeholder="Например, Kids Beginners"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="group_type" className={labelClassName}>
          Тип группы *
        </label>
        <select
          id="group_type"
          name="group_type"
          required
          defaultValue="mixed"
          className={inputClassName}
        >
          <option value="kids">Детская</option>
          <option value="adults">Взрослая</option>
          <option value="mixed">Смешанная</option>
          <option value="competition">Соревновательная</option>
          <option value="private">Индивидуальные занятия</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="min_age" className={labelClassName}>
            Возраст от
          </label>
          <input
            id="min_age"
            name="min_age"
            type="number"
            min={0}
            max={120}
            step={1}
            inputMode="numeric"
            placeholder="Без ограничения"
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="max_age" className={labelClassName}>
            Возраст до
          </label>
          <input
            id="max_age"
            name="max_age"
            type="number"
            min={0}
            max={120}
            step={1}
            inputMode="numeric"
            placeholder="Без ограничения"
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="capacity" className={labelClassName}>
            Вместимость
          </label>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="Без ограничения"
            className={inputClassName}
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClassName}>
          Описание
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          placeholder="Уровень подготовки, особенности тренировок..."
          className={inputClassName}
        />
      </div>

      {state.message && (
        <p
          role={state.success ? "status" : "alert"}
          aria-live="polite"
          className={`rounded-lg border p-4 text-sm ${
            state.success
              ? "border-green-800 bg-green-950/40 text-green-400"
              : "border-red-800 bg-red-950/40 text-red-400"
          }`}
        >
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Создание..." : "Создать группу"}
        </button>

        <p className="text-xs text-zinc-500">
          * Обязательные поля
        </p>
      </div>
    </form>
  );
}
