
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deactivateTrainingSchedule } from "./actions";

type Props = {
  scheduleId: string;
};

export default function DeleteScheduleButton({
  scheduleId,
}: Props) {
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleDelete() {
    const confirmed = window.confirm(
      "Убрать тренировку из расписания? Запись останется в истории.",
    );

    if (!confirmed) return;

    setError("");

    startTransition(async () => {
      try {
        const result =
          await deactivateTrainingSchedule(scheduleId);

        if (!result.success) {
          setError(result.message);
          return;
        }

        router.refresh();
      } catch {
        setError("Ошибка соединения. Попробуйте снова.");
      }
    });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
      >
        <Trash2 size={14} />

        {pending ? "Удаляем..." : "Удалить"}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
