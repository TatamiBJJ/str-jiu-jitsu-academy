
"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  createTrainingSchedule,
  type ScheduleActionState,
} from "./actions";

type TrainingGroup = {
  id: string;
  name: string;
};

type ScheduleFormProps = {
  groups: TrainingGroup[];
};

const initialState: ScheduleActionState = {
  success: false,
  message: "",
};

const days = [
  { value: "1", label: "Понедельник" },
  { value: "2", label: "Вторник" },
  { value: "3", label: "Среда" },
  { value: "4", label: "Четверг" },
  { value: "5", label: "Пятница" },
  { value: "6", label: "Суббота" },
  { value: "7", label: "Воскресенье" },
];

const trainingTypes = [
  { value: "gi", label: "Gi (кимоно)" },
  { value: "nogi", label: "No-Gi (без кимоно)" },
  { value: "open_mat", label: "Open Mat" },
  {
    value: "competition",
    label: "Подготовка к соревнованиям",
  },
  { value: "other", label: "Другое" },
];

const fieldClass =
  "mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-red-500";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Сохраняем..." : "Добавить тренировку"}
    </button>
  );
}

export default function ScheduleForm({
  groups,
}: ScheduleFormProps) {
  const [state, formAction] = useActionState(
    createTrainingSchedule,
    initialState,
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-zinc-400">
          Сначала создайте тренировочную группу.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm text-zinc-300">
          Тренировочная группа *
          <select
            name="group_id"
            required
            defaultValue=""
            className={fieldClass}
          >
            <option value="" disabled>
              Выберите группу
            </option>

            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-zinc-300">
          День недели *
          <select
            name="day_of_week"
            required
            defaultValue=""
            className={fieldClass}
          >
            <option value="" disabled>
              Выберите день
            </option>

            {days.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-zinc-300">
          Начало тренировки *
          <input
            type="time"
            name="start_time"
            required
            defaultValue="19:00"
            className={fieldClass}
          />
        </label>

        <label className="block text-sm text-zinc-300">
          Окончание тренировки *
          <input
            type="time"
            name="end_time"
            required
            defaultValue="20:30"
            className={fieldClass}
          />
        </label>

        <label className="block text-sm text-zinc-300">
          Тип тренировки *
          <select
            name="training_type"
            required
            defaultValue="gi"
            className={fieldClass}
          >
            {trainingTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-zinc-300">
          Действует с *
          <input
            type="date"
            name="valid_from"
            required
            defaultValue={new Date()
              .toLocaleDateString("en-CA", {
                timeZone: "Asia/Almaty",
              })}
            className={fieldClass}
          />
        </label>

        <label className="block text-sm text-zinc-300">
          Действует до
          <input
            type="date"
            name="valid_until"
            className={fieldClass}
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <SubmitButton />

        {state.message && (
          <p
            role="status"
            className={`text-sm ${
              state.success
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
