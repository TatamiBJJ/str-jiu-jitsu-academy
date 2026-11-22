
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EnrollState = {
  status: "idle" | "success" | "error";
  message: string;
};

async function verifySuperAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      error: "Необходимо войти в систему.",
    };
  }

  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (roleError || role !== "super_admin") {
    return {
      supabase,
      error: "Недостаточно прав для выполнения операции.",
    };
  }

  return { supabase, error: null };
}

export async function enrollStudent(
  _previousState: EnrollState,
  formData: FormData,
): Promise<EnrollState> {
  const groupId = String(formData.get("groupId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");

  if (!groupId || !studentId) {
    return {
      status: "error",
      message: "Выберите ученика.",
    };
  }

  const { supabase, error: accessError } =
    await verifySuperAdmin();

  if (accessError) {
    return {
      status: "error",
      message: accessError,
    };
  }

  const { error } = await supabase.rpc(
    "enroll_student_in_training_group",
    {
      p_group_id: groupId,
      p_student_id: studentId,
    },
  );

  if (error) {
    if (error.message.includes("уже состоит")) {
      return {
        status: "error",
        message: "Ученик уже состоит в этой группе.",
      };
    }

    if (error.message.includes("нет свободных мест")) {
      return {
        status: "error",
        message: "В группе нет свободных мест.",
      };
    }

    return {
      status: "error",
      message: error.message,
    };
  }

  revalidatePath(`/dashboard/groups/${groupId}`);
  revalidatePath("/dashboard/groups");
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/groups/history");

  return {
    status: "success",
    message: "Ученик успешно добавлен в группу.",
  };
}

export async function removeStudent(
  _previousState: EnrollState,
  formData: FormData,
): Promise<EnrollState> {
  const groupId = String(formData.get("groupId") ?? "");
  const enrollmentId = String(
    formData.get("enrollmentId") ?? "",
  );

  const reason = String(
    formData.get("removalReason") ?? "",
  ).trim();

  if (!groupId || !enrollmentId) {
    return {
      status: "error",
      message: "Не удалось определить зачисление.",
    };
  }

  if (reason.length < 3 || reason.length > 500) {
    return {
      status: "error",
      message:
        "Укажите причину исключения от 3 до 500 символов.",
    };
  }

  const { supabase, error: accessError } =
    await verifySuperAdmin();

  if (accessError) {
    return {
      status: "error",
      message: accessError,
    };
  }

  const { error } = await supabase.rpc(
    "remove_student_from_training_group",
    {
      p_enrollment_id: enrollmentId,
      p_reason: reason,
    },
  );

  if (error) {
    if (error.message.includes("не найден")) {
      return {
        status: "error",
        message:
          "Активное зачисление не найдено. Обновите страницу.",
      };
    }

    if (error.message.includes("причину исключения")) {
      return {
        status: "error",
        message:
          "Укажите причину исключения от 3 до 500 символов.",
      };
    }

    return {
      status: "error",
      message:
        "Не удалось исключить ученика. Проверьте доступ и попробуйте ещё раз.",
    };
  }

  revalidatePath(`/dashboard/groups/${groupId}`);
  revalidatePath("/dashboard/groups");
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/groups/history");

  return {
    status: "success",
    message:
      "Ученик исключён из группы. Причина и история сохранены.",
  };
}
