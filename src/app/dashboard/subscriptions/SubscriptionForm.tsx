
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  assignSubscription,
  type AssignSubscriptionState,
} from "./actions";

type Student = {
  id: string;
  first_name: string;
  last_name: string;
};

type Plan = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  sessions_per_week: number | null;
  is_unlimited: boolean;
};

type Props = {
  students: Student[];
  plans: Plan[];
};

const initialState: AssignSubscriptionState = {
  success: false,
  message: "",
};

function formatMoney(value: number) {
  return (
    new Intl.NumberFormat("ru-RU").format(value) + " ₸"
  );
}

export default function SubscriptionForm({
  students,
  plans,
}: Props) {
  const [state, formAction, pending] = useActionState(
    assignSubscription,
    initialState,
  );

  const [selectedPlanId, setSelectedPlanId] =
    useState("");

  const selectedPlan = plans.find(
    (plan) => plan.id === selectedPlanId,
  );

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const inputClass =
    "mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-red-500";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      {state.success ? (
        <div className="space-y-4">
          <div
            role="status"
            className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-400"
          >
            {state.message}
          </div>

          <Link
            href="/dashboard/subscriptions"
            className="inline-flex rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            Перейти к абонементам
          </Link>
        </div>
      ) : (
        <form action={formAction} className="space-y-6">
          <div>
            <label
              htmlFor="student_id"
              className="text-sm font-medium text-zinc-300"
            >
              Ученик *
            </label>

            <select
              id="student_id"
              name="student_id"
              required
              defaultValue=""
              className={inputClass}
            >
              <option value="" disabled>
                Выберите ученика
              </option>

              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.last_name} {student.first_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="plan_id"
              className="text-sm font-medium text-zinc-300"
            >
              Тариф *
            </label>

            <select
              id="plan_id"
              name="plan_id"
              required
              value={selectedPlanId}
              onChange={(event) =>
                setSelectedPlanId(event.target.value)
              }
              className={inputClass}
            >
              <option value="" disabled>
                Выберите тариф
              </option>

              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {formatMoney(plan.price)}
                </option>
              ))}
            </select>
          </div>

          {selectedPlan && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-5">
              <h3 className="font-semibold">
                Условия абонемента
              </h3>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-400">
                    Стоимость
                  </span>
                  <span className="font-semibold text-white">
                    {formatMoney(selectedPlan.price)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-zinc-400">
                    Срок действия
                  </span>
                  <span>
                    {selectedPlan.duration_days} дн.
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-zinc-400">
                    Тренировки
                  </span>
                  <span>
                    {selectedPlan.is_unlimited
                      ? "Безлимит"
                      : `${selectedPlan.sessions_per_week} в неделю`}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="start_date"
              className="text-sm font-medium text-zinc-300"
            >
              Дата начала *
            </label>

            <input
              id="start_date"
              name="start_date"
              type="date"
              required
              defaultValue={today}
              className={inputClass}
            />

            <p className="mt-2 text-xs text-zinc-500">
              Дата окончания рассчитывается автоматически.
            </p>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="text-sm font-medium text-zinc-300"
            >
              Комментарий
            </label>

            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={1000}
              placeholder="Например: согласовано с родителем"
              className={inputClass}
            />
          </div>

          {state.message && (
            <div
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
            >
              {state.message}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={
                pending ||
                students.length === 0 ||
                plans.length === 0
              }
              className="rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending
                ? "Сохраняем..."
                : "Назначить абонемент"}
            </button>

            <Link
              href="/dashboard/subscriptions"
              className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              Отмена
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
