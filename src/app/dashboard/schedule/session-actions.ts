
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SessionStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export type SessionActionResult = {
  success: boolean;
  message: string;
};

export async function changeTrainingSessionStatus(
  sessionId: string,
  newStatus: SessionStatus,
): Promise<SessionActionResult> {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(sessionId)) {
    return {
      success: false,
      message: "Некорректный ID занятия.",
    };
  }

  if (
    !["in_progress", "completed", "cancelled"].includes(
      newStatus,
    )
  ) {
    return {
      success: false,
      message: "Некорректный статус.",
    };
  }

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

  // Проверка роли и принадлежности группы
  // выполняется в защищённой PostgreSQL RPC.
  const { data, error } = await supabase.rpc(
    "change_str_training_session_status",
    {
      p_session_id: sessionId,
      p_new_status: newStatus,
    },
  );

  if (error) {
    console.error(
      "Training session status update failed:",
      error.code,
    );

    return {
      success: false,
      message:
        "Не удалось изменить статус. Проверьте права доступа или текущее состояние тренировки.",
    };
  }

  revalidatePath("/dashboard/schedule");

  const messages: Record<string, string> = {
    in_progress: "Тренировка начата.",
    completed: "Тренировка завершена.",
    cancelled: "Тренировка отменена.",
  };

  return {
    success: true,
    message:
      messages[String(data)] ?? "Статус обновлён.",
  };
}
