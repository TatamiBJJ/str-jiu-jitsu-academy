
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateTrainingSchedule } from "./actions";

type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  training_type: string;
  valid_from: string;
  valid_until: string | null;
};

type Props = {
  schedule: Schedule;
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

const trainingTypes = [
  { value: "gi", label: "Gi (кимоно)" },
  { value: "nogi", label: "No-Gi" },
  { value: "open_mat", label: "Open Mat" },
  {
    value: "competition",
    label: "Подготовка к соревнованиям",
  },
  { value: "other", label: "Другое" },
];

const inputClass =
  "mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-red-500";

export default function EditScheduleButton({
  schedule,
}: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [dayOfWeek, setDayOfWeek] = useState(
    schedule.day_of_week,
  );

  const [startTime, setStartTime] = useState(
    schedule.start_time.slice(0, 5),
  );

  const [endTime, setEndTime] = useState(
    schedule.end_time.slice(0, 5),
  );

  const [trainingType, setTrainingType] = useState(
    schedule.training_type,
  );

  const [validFrom, setValidFrom] = useState(
    schedule.valid_from,
  );

  const [validUntil, setValidUntil] = useState(
    schedule.valid_until ?? "",
  );

  function resetForm() {
    setDayOfWeek(schedule.day_of_week);
    setStartTime(schedule.start_time.slice(0, 5));
    setEndTime(schedule.end_time.slice(0, 5));
    setTrainingType(schedule.training_type);
    setValidFrom(schedule.valid_from);
    setValidUntil(schedule.valid_until ?? "");
    setError("");
  }

  function closeForm() {
    if (pending) return;

    resetForm();
    setOpen(false);
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const result = await updateTrainingSchedule({
          scheduleId: schedule.id,
          dayOfWeek,
          startTime,
          endTime,
          trainingType,
          validFrom,
          validUntil: validUntil || null,
        });

        if (!result.success) {
          setError(result.message);
          return;
        }

        setOpen(false);
        router.refresh();
      } catch {
        setError(
          "Не удалось сохранить изменения. Попробуйте снова.",
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
      >
        <Pencil size={14} />
        Редактировать
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Редактирование расписания"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4"
        >
          <div className="w-full max-w-xl rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                Редактировать расписание
              </h2>

              <button
                type="button"
                onClick={closeForm}
                disabled={pending}
                aria-label="Закрыть"
                className="text-zinc-400 hover:text-white disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-zinc-300">
                  День недели *
                  <select
                    required
                    value={dayOfWeek}
                    onChange={(event) =>
                      setDayOfWeek(Number(event.target.value))
                    }
                    className={inputClass}
                  >
                    {days.map((day, index) => (
                      <option key={day} value={index + 1}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-zinc-300">
                  Тип тренировки *
                  <select
                    required
                    value={trainingType}
                    onChange={(event) =>
                      setTrainingType(event.target.value)
                    }
                    className={inputClass}
                  >
                    {trainingTypes.map((type) => (
                      <option
                        key={type.value}
                        value={type.value}
                      >
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-zinc-300">
                  Начало *
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(event) =>
                      setStartTime(event.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <label className="text-sm text-zinc-300">
                  Окончание *
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(event) =>
                      setEndTime(event.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <label className="text-sm text-zinc-300">
                  Действует с *
                  <input
                    type="date"
                    required
                    value={validFrom}
                    onChange={(event) =>
                      setValidFrom(event.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <label className="text-sm text-zinc-300">
                  Действует до
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(event) =>
                      setValidUntil(event.target.value)
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-4 text-sm text-red-400"
                >
                  {error}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={pending}
                  className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                >
                  Отмена
                </button>

                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {pending
                    ? "Сохраняем..."
                    : "Сохранить изменения"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
