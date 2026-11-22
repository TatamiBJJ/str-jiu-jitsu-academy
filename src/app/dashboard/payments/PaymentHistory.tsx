
"use client";

import { useActionState, useState } from "react";
import { voidPayment, type VoidPaymentState } from "./actions";

export type PaymentHistoryRow = {
  id: string;
  student_name: string;
  plan_name: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  administrator_name: string;
  notes: string | null;
};

type Props = {
  payments: PaymentHistoryRow[];
};

const initialState: VoidPaymentState = {
  success: false,
  message: "",
};

const methodLabels: Record<string, string> = {
  kaspi: "Kaspi",
  halyk: "Halyk",
  cash: "Наличные",
  bank_transfer: "Банковский перевод",
  other: "Другое",
};

function money(value: number) {
  return (
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 2,
    }).format(value) + " ₸"
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function CancelPayment({
  paymentId,
}: {
  paymentId: string;
}) {
  const [open, setOpen] = useState(false);

  const [state, formAction, pending] = useActionState(
    voidPayment,
    initialState,
  );

  if (state.success) {
    return (
      <span className="text-xs text-green-400">
        Платёж отменён
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-red-400 hover:underline"
      >
        Отменить
      </button>
    );
  }

  return (
    <form action={formAction} className="min-w-56 space-y-2">
      <input
        type="hidden"
        name="payment_id"
        value={paymentId}
      />

      <label
        htmlFor={`reason-${paymentId}`}
        className="block text-xs text-zinc-300"
      >
        Причина отмены
      </label>

      <textarea
        id={`reason-${paymentId}`}
        name="reason"
        required
        minLength={5}
        maxLength={500}
        rows={2}
        placeholder="Например: ошибочно внесённая сумма"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-xs text-white outline-none focus:border-red-500"
      />

      {state.message && (
        <p role="alert" className="text-xs text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Отменяем..." : "Подтвердить"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Назад
        </button>
      </div>
    </form>
  );
}

export default function PaymentHistory({
  payments,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = payments.filter((payment) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      payment.student_name.toLowerCase().includes(query) ||
      payment.plan_name.toLowerCase().includes(query) ||
      payment.administrator_name.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "all" ||
      payment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const inputClass =
    "rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-red-500";

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">
            История платежей
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Все зарегистрированные и отменённые платежи
          </p>
        </div>

        <span className="text-sm text-zinc-400">
          Записей: {filtered.length}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по ученику или администратору"
          className={`${inputClass} min-w-64 flex-1`}
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
          className={inputClass}
        >
          <option value="all">Все платежи</option>
          <option value="completed">Проведённые</option>
          <option value="voided">Отменённые</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-400">
            Платежи не найдены.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="p-4">Дата</th>
                <th className="p-4">Ученик</th>
                <th className="p-4">Тариф</th>
                <th className="p-4">Сумма</th>
                <th className="p-4">Способ</th>
                <th className="p-4">Администратор</th>
                <th className="p-4">Статус</th>
                <th className="p-4">Действие</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-zinc-800/60 align-top hover:bg-zinc-800/40"
                >
                  <td className="whitespace-nowrap p-4 text-zinc-300">
                    {formatDate(payment.payment_date)}
                  </td>

                  <td className="p-4 font-medium text-white">
                    {payment.student_name}
                  </td>

                  <td className="p-4 text-zinc-300">
                    {payment.plan_name}
                  </td>

                  <td className="whitespace-nowrap p-4 font-semibold">
                    {money(payment.amount)}
                  </td>

                  <td className="p-4 text-zinc-300">
                    {methodLabels[payment.payment_method] ??
                      payment.payment_method}
                  </td>

                  <td className="p-4 text-zinc-300">
                    {payment.administrator_name}
                  </td>

                  <td className="p-4">
                    <span
                      className={`text-xs font-medium ${
                        payment.status === "completed"
                          ? "text-green-400"
                          : "text-zinc-400"
                      }`}
                    >
                      {payment.status === "completed"
                        ? "Проведён"
                        : payment.status === "voided"
                          ? "Отменён"
                          : payment.status}
                    </span>

                    {payment.notes && (
                      <p className="mt-2 max-w-xs whitespace-pre-wrap text-xs text-zinc-500">
                        {payment.notes}
                      </p>
                    )}
                  </td>

                  <td className="p-4">
                    {payment.status === "completed" ? (
                      <CancelPayment paymentId={payment.id} />
                    ) : (
                      <span className="text-xs text-zinc-500">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
