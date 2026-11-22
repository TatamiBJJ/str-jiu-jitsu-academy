
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import PaymentForm, {
  type PayableSubscription,
} from "./PaymentForm";

import PaymentHistory, {
  type PaymentHistoryRow,
} from "./PaymentHistory";

type BalanceRow = {
  subscription_id: string;
  academy_id: string;
  student_id: string;
  plan_id: string;
  debt_amount: number;
  subscription_status: string;
};

type FinancialSummary = {
  today_income: number | string;
  month_income: number | string;
  total_debt: number | string;
  debtors_count: number | string;
};

type PaymentRow = {
  id: string;
  subscription_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

const money = (value: number) =>
  `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(value)} ₸`;

function ErrorMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400"
    >
      {message}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  accent = false,
}: {
  title: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-sm text-zinc-400">
        {title}
      </p>

      <p
        className={`mt-3 text-2xl font-bold ${
          accent
            ? "text-red-400"
            : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <Suspense fallback={<PaymentsLoading />}>
        <PaymentsContent />
      </Suspense>
    </div>
  );
}

function PaymentsLoading() {
  return (
    <div
      role="status"
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-sm text-zinc-400"
    >
      Загружаем финансовые данные...
    </div>
  );
}

async function PaymentsContent() {
  await connection();

  const supabase = await createClient();

  // 1. Авторизация

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const {
    data: role,
    error: roleError,
  } = await supabase.rpc("get_my_str_role");

  if (
    roleError ||
    !["super_admin", "admin", "manager"].includes(
      String(role),
    )
  ) {
    return (
      <ErrorMessage message="Недостаточно прав для просмотра платежей." />
    );
  }

  const {
    data: academyId,
    error: academyError,
  } = await supabase.rpc(
    "get_my_str_admin_academy_id",
  );

  if (academyError || !academyId) {
    return (
      <ErrorMessage message="Не удалось определить академию." />
    );
  }

  // 2. Финансовая сводка из PostgreSQL

  const {
    data: summaryData,
    error: summaryError,
  } = await supabase.rpc(
    "get_str_financial_summary",
  );

  if (summaryError) {
    console.error(
      "Financial summary failed:",
      {
        code: summaryError.code,
        message: summaryError.message,
      },
    );

    return (
      <ErrorMessage message="Не удалось загрузить финансовую сводку." />
    );
  }

  const summary = (
    summaryData as FinancialSummary[] | null
  )?.[0];

  if (!summary) {
    return (
      <ErrorMessage message="Финансовая сводка вернула пустой результат." />
    );
  }

  const todayIncome = Number(
    summary.today_income,
  );

  const monthIncome = Number(
    summary.month_income,
  );

  const totalDebt = Number(
    summary.total_debt,
  );

  const debtorsCount = Number(
    summary.debtors_count,
  );

  // 3. Загружаем неоплаченные абонементы
  // для регистрации новых платежей.

  const balances: BalanceRow[] = [];

  const pageSize = 500;
  let offset = 0;

  while (true) {
    const {
      data,
      error,
    } = await supabase
      .from("subscription_balances")
      .select(
        "subscription_id, academy_id, student_id, plan_id, debt_amount, subscription_status",
      )
      .eq("academy_id", academyId)
      .gt("debt_amount", 0)
      .neq(
        "subscription_status",
        "cancelled",
      )
      .order(
        "subscription_id",
        { ascending: true },
      )
      .range(
        offset,
        offset + pageSize - 1,
      );

    if (error) {
      console.error(
        "Balances loading failed:",
        error.code,
      );

      return (
        <ErrorMessage message="Не удалось загрузить задолженности." />
      );
    }

    const rows = (
      data ?? []
    ) as BalanceRow[];

    balances.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  // 4. Загружаем имена учеников и тарифы

  const studentIds = [
    ...new Set(
      balances.map(
        (item) => item.student_id,
      ),
    ),
  ];

  const planIds = [
    ...new Set(
      balances.map(
        (item) => item.plan_id,
      ),
    ),
  ];

  const [
    studentsResult,
    plansResult,
  ] = await Promise.all([
    studentIds.length
      ? supabase
          .from("students")
          .select(
            "id, first_name, last_name",
          )
          .eq(
            "academy_id",
            academyId,
          )
          .in("id", studentIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    planIds.length
      ? supabase
          .from("subscription_plans")
          .select("id, name")
          .eq(
            "academy_id",
            academyId,
          )
          .in("id", planIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (
    studentsResult.error ||
    plansResult.error
  ) {
    return (
      <ErrorMessage message="Не удалось загрузить учеников или тарифы." />
    );
  }

  const studentNames = new Map(
    (
      studentsResult.data ?? []
    ).map((student) => [
      student.id,
      `${student.last_name ?? ""} ${
        student.first_name ?? ""
      }`.trim(),
    ]),
  );

  const planNames = new Map(
    (
      plansResult.data ?? []
    ).map((plan) => [
      plan.id,
      plan.name,
    ]),
  );

  const subscriptions: PayableSubscription[] =
    balances.map((item) => ({
      subscription_id:
        item.subscription_id,

      student_name:
        studentNames.get(
          item.student_id,
        ) ?? "Ученик не найден",

      plan_name:
        planNames.get(
          item.plan_id,
        ) ?? "Тариф не найден",

      debt_amount: Number(
        item.debt_amount,
      ),
    }));

  // 5. История платежей
  // Последние 500 операций.

  const {
    data: paymentData,
    error: paymentsError,
  } = await supabase
    .from("subscription_payments")
    .select(
      "id, subscription_id, amount, payment_date, payment_method, status, notes, created_by, created_at",
    )
    .eq("academy_id", academyId)
    .order(
      "created_at",
      { ascending: false },
    )
    .limit(500);

  if (paymentsError) {
    console.error(
      "Payment history failed:",
      paymentsError.code,
    );
  }

  const paymentRows = (
    paymentData ?? []
  ) as PaymentRow[];

  const historySubscriptionIds = [
    ...new Set(
      paymentRows.map(
        (payment) =>
          payment.subscription_id,
      ),
    ),
  ];

  const administratorIds = [
    ...new Set(
      paymentRows
        .map(
          (payment) =>
            payment.created_by,
        )
        .filter(
          (id): id is string =>
            Boolean(id),
        ),
    ),
  ];

  // 6. Получаем информацию
  // об абонементах и администраторах.

  const [
    historySubscriptionsResult,
    administratorsResult,
  ] = await Promise.all([
    historySubscriptionIds.length
      ? supabase
          .from(
            "student_subscriptions",
          )
          .select(
            "id, student_id, plan_id",
          )
          .eq(
            "academy_id",
            academyId,
          )
          .in(
            "id",
            historySubscriptionIds,
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),

    administratorIds.length
      ? supabase
          .from("profiles")
          .select(
            "id, first_name, last_name",
          )
          .in(
            "id",
            administratorIds,
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  const historySubscriptions =
    historySubscriptionsResult.data ?? [];

  const historyStudentIds = [
    ...new Set(
      historySubscriptions.map(
        (item) => item.student_id,
      ),
    ),
  ];

  const historyPlanIds = [
    ...new Set(
      historySubscriptions.map(
        (item) => item.plan_id,
      ),
    ),
  ];

  const [
    historyStudentsResult,
    historyPlansResult,
  ] = await Promise.all([
    historyStudentIds.length
      ? supabase
          .from("students")
          .select(
            "id, first_name, last_name",
          )
          .eq(
            "academy_id",
            academyId,
          )
          .in(
            "id",
            historyStudentIds,
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),

    historyPlanIds.length
      ? supabase
          .from(
            "subscription_plans",
          )
          .select("id, name")
          .eq(
            "academy_id",
            academyId,
          )
          .in(
            "id",
            historyPlanIds,
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  const historyError =
    paymentsError ||
    historySubscriptionsResult.error ||
    administratorsResult.error ||
    historyStudentsResult.error ||
    historyPlansResult.error;

  const historyStudentNames =
    new Map(
      (
        historyStudentsResult.data ??
        []
      ).map((student) => [
        student.id,
        `${
          student.last_name ?? ""
        } ${
          student.first_name ?? ""
        }`.trim(),
      ]),
    );

  const historyPlanNames = new Map(
    (
      historyPlansResult.data ?? []
    ).map((plan) => [
      plan.id,
      plan.name,
    ]),
  );

  const administratorNames = new Map(
    (
      administratorsResult.data ?? []
    ).map((profile) => [
      profile.id,
      `${
        profile.first_name ?? ""
      } ${
        profile.last_name ?? ""
      }`.trim(),
    ]),
  );

  const subscriptionDetails = new Map(
    historySubscriptions.map(
      (subscription) => [
        subscription.id,
        subscription,
      ],
    ),
  );

  const payments: PaymentHistoryRow[] =
    paymentRows.map((payment) => {
      const subscription =
        subscriptionDetails.get(
          payment.subscription_id,
        );

      return {
        id: payment.id,

        student_name: subscription
          ? historyStudentNames.get(
              subscription.student_id,
            ) ??
            "Ученик не найден"
          : "Абонемент не найден",

        plan_name: subscription
          ? historyPlanNames.get(
              subscription.plan_id,
            ) ??
            "Тариф не найден"
          : "Тариф не найден",

        amount: Number(
          payment.amount,
        ),

        payment_date:
          payment.payment_date,

        payment_method:
          payment.payment_method,

        status: payment.status,

        administrator_name:
          payment.created_by
            ? administratorNames.get(
                payment.created_by,
              ) ||
              "Администратор не найден"
            : "Не указан",

        notes: payment.notes,
      };
    });

  // 7. Интерфейс

  return (
    <>
      <p className="text-sm font-semibold tracking-widest text-red-500">
        STR OF JIU JITSU
      </p>

      <div className="mt-4">
        <Link
          href="/dashboard/subscriptions"
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← Назад к абонементам
        </Link>

        <h1 className="mt-5 text-3xl font-bold">
          Оплаты
        </h1>

        <p className="mt-3 text-zinc-400">
          Финансовая сводка,
          регистрация платежей
          и история операций.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Поступления сегодня"
          value={money(todayIncome)}
        />

        <SummaryCard
          title="Поступления за месяц"
          value={money(monthIncome)}
        />

        <SummaryCard
          title="Общая задолженность"
          value={money(totalDebt)}
          accent
        />

        <SummaryCard
          title="Должников"
          value={String(debtorsCount)}
        />
      </div>

      <div className="mt-10 max-w-3xl">
        <h2 className="mb-5 text-xl font-bold">
          Зарегистрировать оплату
        </h2>

        {subscriptions.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <h3 className="text-lg font-semibold">
              Нет неоплаченных абонементов
            </h3>

            <p className="mt-2 text-sm text-zinc-400">
              Все оформленные абонементы
              оплачены либо ещё
              не назначены.
            </p>
          </div>
        ) : (
          <PaymentForm
            subscriptions={subscriptions}
          />
        )}
      </div>

      {historyError ? (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-400"
        >
          Не удалось загрузить
          историю платежей.
          Проверьте права доступа
          в Supabase.
        </div>
      ) : (
        <PaymentHistory
          payments={payments}
        />
      )}
    </>
  );
}
