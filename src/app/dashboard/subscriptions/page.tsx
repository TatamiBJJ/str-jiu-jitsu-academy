
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubscriptionRow = {
  subscription_id: string;
  academy_id: string;
  student_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  subscription_status: string;
  total_price: number;
  paid_amount: number;
  debt_amount: number;
  payment_status: string;
};

type Student = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type Plan = {
  id: string;
  name: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(value) + " ₸";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function subscriptionStatus(
  row: SubscriptionRow,
  today: string,
) {
  if (row.subscription_status === "cancelled") {
    return {
      label: "Отменён",
      className: "bg-zinc-700/50 text-zinc-300",
    };
  }

  if (row.subscription_status === "completed") {
    return {
      label: "Завершён",
      className: "bg-zinc-700/50 text-zinc-300",
    };
  }

  if (row.start_date > today) {
    return {
      label: "Ожидает начала",
      className: "bg-blue-500/10 text-blue-400",
    };
  }

  if (row.end_date < today) {
    return {
      label: "Истёк",
      className: "bg-orange-500/10 text-orange-400",
    };
  }

  return {
    label: "Активен",
    className: "bg-green-500/10 text-green-400",
  };
}

function paymentStatus(status: string) {
  switch (status) {
    case "paid":
      return {
        label: "Оплачено",
        className: "text-green-400",
      };
    case "partially_paid":
      return {
        label: "Частично оплачено",
        className: "text-yellow-400",
      };
    default:
      return {
        label: "Не оплачено",
        className: "text-red-400",
      };
  }
}

export default function SubscriptionsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<Loading />}>
        <SubscriptionsContent />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-sm text-zinc-400">
      Загружаем абонементы...
    </div>
  );
}

async function SubscriptionsContent() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-red-400">
          Необходимо войти в систему.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-block text-red-400 hover:underline"
        >
          Перейти к авторизации
        </Link>
      </div>
    );
  }

  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (
    roleError ||
    !["super_admin", "admin", "manager"].includes(
      String(role),
    )
  ) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-red-400">
        Недостаточно прав для просмотра абонементов.
      </div>
    );
  }

  const { data: academyId, error: academyError } =
    await supabase.rpc("get_my_str_admin_academy_id");

  if (academyError || !academyId) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-red-400">
        Не удалось определить академию.
      </div>
    );
  }

  const { data, error } = await supabase
    .from("subscription_balances")
    .select("*")
    .eq("academy_id", academyId)
    .order("start_date", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Subscriptions loading failed:", {
      code: error.code,
      message: error.message,
    });
  }

  const subscriptions =
    (data ?? []) as SubscriptionRow[];

  const studentIds = [
    ...new Set(subscriptions.map((s) => s.student_id)),
  ];

  const planIds = [
    ...new Set(subscriptions.map((s) => s.plan_id)),
  ];

  const [studentsResult, plansResult] = await Promise.all([
    studentIds.length
      ? supabase
          .from("students")
          .select("id, first_name, last_name")
          .eq("academy_id", academyId)
          .in("id", studentIds)
      : Promise.resolve({ data: [] as Student[], error: null }),
    planIds.length
      ? supabase
          .from("subscription_plans")
          .select("id, name")
          .eq("academy_id", academyId)
          .in("id", planIds)
      : Promise.resolve({ data: [] as Plan[], error: null }),
  ]);

  const students = new Map(
    (studentsResult.data ?? []).map((s) => [
      s.id,
      `${s.last_name ?? ""} ${s.first_name ?? ""}`.trim(),
    ]),
  );

  const plans = new Map(
    (plansResult.data ?? []).map((p) => [p.id, p.name]),
  );

  const totalDebt = subscriptions.reduce(
    (sum, s) => sum + Number(s.debt_amount),
    0,
  );

  const unpaidCount = subscriptions.filter(
    (s) => Number(s.debt_amount) > 0,
  ).length;

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <>
      <p className="text-sm font-semibold tracking-widest text-red-500">
        STR OF JIU JITSU
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Абонементы
          </h1>
          <p className="mt-3 text-zinc-400">
            Учёт абонементов, оплат и задолженностей учеников
          </p>
        </div>

        <Link
          href="/dashboard/subscriptions/new"
          className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          + Назначить абонемент
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Абонементов"
          value={String(subscriptions.length)}
        />
        <SummaryCard
          title="С задолженностью"
          value={String(unpaidCount)}
        />
        <SummaryCard
          title="Общая задолженность"
          value={money(totalDebt)}
          danger
        />
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {error || studentsResult.error || plansResult.error ? (
          <div className="p-6 text-red-400">
            Не удалось загрузить данные абонементов.
            Проверьте права доступа в Supabase.
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-lg font-semibold">
              Пока нет абонементов
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Назначьте первый абонемент ученику.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="p-4">Ученик</th>
                  <th className="p-4">Тариф</th>
                  <th className="p-4">Период</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4">Стоимость</th>
                  <th className="p-4">Оплачено</th>
                  <th className="p-4">Долг</th>
                  <th className="p-4">Оплата</th>
                </tr>
              </thead>

              <tbody>
                {subscriptions.map((s) => {
                  const status = subscriptionStatus(s, today);
                  const payment = paymentStatus(
                    s.payment_status,
                  );

                  return (
                    <tr
                      key={s.subscription_id}
                      className="border-b border-zinc-800/60 hover:bg-zinc-800/40"
                    >
                      <td className="p-4 font-medium text-white">
                        {students.get(s.student_id) ??
                          "Ученик не найден"}
                      </td>
                      <td className="p-4 text-zinc-300">
                        {plans.get(s.plan_id) ??
                          "Тариф не найден"}
                      </td>
                      <td className="whitespace-nowrap p-4 text-zinc-300">
                        {formatDate(s.start_date)}
                        <span className="mx-1 text-zinc-500">—</span>
                        {formatDate(s.end_date)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap p-4">
                        {money(Number(s.total_price))}
                      </td>
                      <td className="whitespace-nowrap p-4">
                        {money(Number(s.paid_amount))}
                      </td>
                      <td
                        className={`whitespace-nowrap p-4 font-semibold ${
                          Number(s.debt_amount) > 0
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {money(Number(s.debt_amount))}
                      </td>
                      <td
                        className={`whitespace-nowrap p-4 text-xs font-medium ${payment.className}`}
                      >
                        {payment.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function SummaryCard({
  title,
  value,
  danger = false,
}: {
  title: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-400">{title}</p>
      <p
        className={`mt-3 text-2xl font-bold ${
          danger ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
