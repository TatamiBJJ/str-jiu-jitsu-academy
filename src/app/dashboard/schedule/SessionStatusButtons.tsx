
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  CheckCheck,
  Ban,
} from "lucide-react";

import {
  changeTrainingSessionStatus,
  type SessionStatus,
} from "./session-actions";

type Props = {
  sessionId: string;
  status: SessionStatus;
};

export default function SessionStatusButtons({
  sessionId,
  status,
}: Props) {
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(
    newStatus: SessionStatus,
  ) {
    const confirmation =
      newStatus === "cancelled"
        ? "Отменить эту тренировку?"
        : newStatus === "completed"
          ? "Завершить эту тренировку?"
          : null;

    if (
      confirmation &&
      !window.confirm(confirmation)
    ) {
      return;
    }

    setError("");
    setSuccess("");

    startTransition(async () => {
      try {
        const result =
          await changeTrainingSessionStatus(
            sessionId,
            newStatus,
          );

        if (!result.success) {
          setError(result.message);
          return;
        }

        setSuccess(result.message);
        router.refresh();
      } catch {
        setError(
          "Не удалось изменить статус тренировки.",
        );
      }
    });
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {status === "scheduled" && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                handleChange("in_progress")
              }
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <Play size={14} />
              Начать
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                handleChange("cancelled")
              }
              className="inline-flex items-center gap-2 rounded-lg border border-red-800 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-950 disabled:opacity-50"
            >
              <Ban size={14} />
              Отменить
            </button>
          </>
        )}

        {status === "in_progress" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              handleChange("completed")
            }
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
          >
            <CheckCheck size={14} />
            Завершить
          </button>
        )}
      </div>

      {pending && (
        <p className="mt-2 text-xs text-zinc-400">
          Сохраняем...
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 text-xs text-red-400"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="mt-2 text-xs text-emerald-400"
        >
          {success}
        </p>
      )}
    </div>
  );
}
