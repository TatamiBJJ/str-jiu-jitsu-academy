
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AssignSubscriptionState = {
  success: boolean;
  message: string;
};

export async function assignSubscription(
  _previousState: AssignSubscriptionState,
  formData: FormData,
): Promise<AssignSubscriptionState> {
  const supabase = await createClient();

  // Проверяем авторизацию.
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

  // Проверяем роль на сервере.
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
      message: "Недостаточно прав для назначения абонемента.",
    };
  }

  const studentId = String(
    formData.get("student_id") ?? "",
  ).trim();

  const planId = String(
    formData.get("plan_id") ?? "",
  ).trim();

  const startDate = String(
    formData.get("start_date") ?? "",
  ).trim();

  const notes = String(
    formData.get("notes") ?? "",
  ).trim();

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    !uuidPattern.test(studentId) ||
    !uuidPattern.test(planId)
  ) {
    return {
      success: false,
      message: "Выберите ученика и тариф.",
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return {
      success: false,
      message: "Укажите корректную дату начала.",
    };
  }

  if (notes.length > 1000) {
    return {
      success: false,
      message: "Комментарий не должен превышать 1000 символов.",
    };
  }

  // Цена, академия и дата окончания определяются
  // исключительно внутри защищённой функции Supabase.
  const { error } = await supabase.rpc(
    "assign_student_subscription",
    {
      p_student_id: studentId,
      p_plan_id: planId,
      p_start_date: startDate,
      p_notes: notes || null,
    },
  );

  if (error) {
    console.error("Subscription assignment failed:", {
      code: error.code,
      message: error.message,
    });

    return {
      success: false,
      message:
        "Не удалось назначить абонемент. Проверьте, нет ли у ученика другого абонемента на этот период.",
    };
  }

  revalidatePath("/dashboard/subscriptions");

  return {
    success: true,
    message: "Абонемент успешно назначен.",
  };
}
