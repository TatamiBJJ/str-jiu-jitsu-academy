
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  recordPayment,
  type RecordPaymentState,
} from "./actions";

export type PayableSubscription = {
  subscription_id: string;
  student_name: string;
  plan_name: string;
  debt_amount: number;
};

type Props = {
  subscriptions: PayableSubscription[];
};

const initialState: RecordPaymentState = {
  success: false,
  message: "",
};

function formatMoney(value: number) {
  return (
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 2,
    }).format(value) + " ₸"
  );
}

export default function PaymentForm({
  subscriptions,
}: Props) {
  const [state, formAction, pending] = useActionState(
    recordPayment,
    initialState,
  );

  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");

  const selected = subscriptions.find(
    (item) => item.subscription_id === selectedId,
  );

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const inputClass =
    "mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-red-500";

  if (state.success) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div
          role="status"
          className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-400"
        >
          {state.message}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/dashboard/subscriptions"
            className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            Проверить задолженность
          </Link>

          <Link
            href="/dashboard/payments"
            className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Зарегистрировать ещё оплату
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <div>
        <label
          htmlFor="subscription_id"
          className="text-sm font-medium text-zinc-300"
        >
          Ученик и абонемент *
        </label>

        <select
          id="subscription_id"
          name="subscription_id"
          required
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setAmount("");
          }}
          className={inputClass}
        >
          <option value="" disabled>
            Выберите абонемент
          </option>

          {subscriptions.map((item) => (
            <option
              key={item.subscription_id}
              value={item.subscription_id}
            >
              {item.student_name} — {item.plan_name}
              {" — долг "}
              {formatMoney(item.debt_amount)}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-5">
          <p className="text-sm text-zinc-400">
            Текущая задолженность
          </p>

          <p className="mt-2 text-2xl font-bold text-red-400">
            {formatMoney(selected.debt_amount)}
          </p>

          <button
            type="button"
            onClick={() =>
              setAmount(String(selected.debt_amount))
            }
            className="mt-3 text-sm font-medium text-red-400 hover:underline"
          >
            Заполнить полную сумму
          </button>
        </div>
      )}

      <div>
        <label
          htmlFor="amount"
          className="text-sm font-medium text-zinc-300"
        >
          Сумма оплаты, ₸ *
        </label>

        <input
          id="amount"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className={inputClass}
          placeholder="Например: 5000"
        />

        {selected && (
          <p className="mt-2 text-xs text-zinc-500">
            Можно внести полную или частичную оплату.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="payment_method"
          className="text-sm font-medium text-zinc-300"
        >
          Способ оплаты *
        </label>

        <select
          id="payment_method"
          name="payment_method"
          required
          defaultValue=""
          className={inputClass}
        >
          <option value="" disabled>
            Выберите способ оплаты
          </option>
          <option value="kaspi">Kaspi</option>
          <option value="halyk">Halyk</option>
          <option value="cash">Наличные</option>
          <option value="bank_transfer">
            Банковский перевод
          </option>
          <option value="other">Другое</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="payment_date"
          className="text-sm font-medium text-zinc-300"
        >
          Дата оплаты *
        </label>

        <input
          id="payment_date"
          name="payment_date"
          type="date"
          required
          defaultValue={today}
          className={inputClass}
        />
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
          placeholder="Например: частичная оплата через Kaspi"
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
            !selected ||
            !amount ||
            Number(amount) <= 0 ||
            Number(amount) > (selected?.debt_amount ?? 0)
          }
          className="rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Сохраняем..." : "Зарегистрировать оплату"}
        </button>

        <Link
          href="/dashboard/subscriptions"
          className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
