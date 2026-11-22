
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RecordPaymentState = {
  success: boolean;
  message: string;
};

const PAYMENT_METHODS = [
  "kaspi",
  "halyk",
  "cash",
  "bank_transfer",
  "other",
] as const;

export async function recordPayment(
  _previousState: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      message: "Сессия истекла. Войдите повторно.",
    };
  }

  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (
    roleError ||
    !["super_admin", "admin", "manager"].includes(
      String(role),
    )
  ) {
    return {
      success: false,
      message: "Недостаточно прав для регистрации оплаты.",
    };
  }

  const subscriptionId = String(
    formData.get("subscription_id") ?? "",
  ).trim();

  const amountRaw = String(
    formData.get("amount") ?? "",
  ).trim();

  const paymentMethod = String(
    formData.get("payment_method") ?? "",
  ).trim();

  const paymentDate = String(
    formData.get("payment_date") ?? "",
  ).trim();

  const notes = String(
    formData.get("notes") ?? "",
  ).trim();

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(subscriptionId)) {
    return {
      success: false,
      message: "Выберите абонемент.",
    };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(amountRaw)) {
    return {
      success: false,
      message: "Укажите корректную сумму оплаты.",
    };
  }

  const amount = Number(amountRaw);

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false,
      message: "Сумма должна быть больше нуля.",
    };
  }

  if (
    !PAYMENT_METHODS.includes(
      paymentMethod as (typeof PAYMENT_METHODS)[number],
    )
  ) {
    return {
      success: false,
      message: "Выберите способ оплаты.",
    };
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) ||
    Number.isNaN(Date.parse(`${paymentDate}T00:00:00Z`))
  ) {
    return {
      success: false,
      message: "Укажите корректную дату оплаты.",
    };
  }

  if (notes.length > 1000) {
    return {
      success: false,
      message: "Комментарий не должен превышать 1000 символов.",
    };
  }

  // Сумма задолженности и права проверяются
  // повторно внутри защищённой RPC в Supabase.
  const { error } = await supabase.rpc(
    "record_subscription_payment",
    {
      p_subscription_id: subscriptionId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_payment_date: paymentDate,
      p_notes: notes || null,
    },
  );

  if (error) {
    console.error("Payment registration failed:", {
      code: error.code,
      message: error.message,
    });

    return {
      success: false,
      message:
        "Не удалось зарегистрировать оплату. Проверьте сумму, задолженность и статус абонемента.",
    };
  }

  revalidatePath("/dashboard/subscriptions");
  revalidatePath("/dashboard/payments");

  return {
    success: true,
    message: "Оплата успешно зарегистрирована.",
  };
}

export type VoidPaymentState = {
  success: boolean;
  message: string;
};

export async function voidPayment(
  _previousState: VoidPaymentState,
  formData: FormData,
): Promise<VoidPaymentState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      message: "Необходимо войти в систему.",
    };
  }

  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (
    roleError ||
    !["super_admin", "admin", "manager"].includes(
      String(role),
    )
  ) {
    return {
      success: false,
      message: "Недостаточно прав для отмены платежа.",
    };
  }

  const paymentId = String(
    formData.get("payment_id") ?? "",
  ).trim();

  const reason = String(
    formData.get("reason") ?? "",
  ).trim();

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(paymentId)) {
    return {
      success: false,
      message: "Некорректный идентификатор платежа.",
    };
  }

  if (reason.length < 5 || reason.length > 500) {
    return {
      success: false,
      message: "Укажите причину отмены от 5 до 500 символов.",
    };
  }

  const { error } = await supabase.rpc(
    "void_subscription_payment",
    {
      p_payment_id: paymentId,
      p_reason: reason,
    },
  );

  if (error) {
    console.error("Payment cancellation failed:", {
      code: error.code,
      message: error.message,
    });

    return {
      success: false,
      message:
        "Не удалось отменить платёж. Проверьте его статус и права доступа.",
    };
  }

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/subscriptions");

  return {
    success: true,
    message: "Платёж отменён. Задолженность пересчитана.",
  };
}
