
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
    return { status: "error", message: "Выберите ученика." };
  }

  const { supabase, error: accessError } =
    await verifySuperAdmin();

  if (accessError) {
    return { status: "error", message: accessError };
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

  if (!groupId || !enrollmentId) {
    return {
      status: "error",
      message: "Не удалось определить зачисление.",
    };
  }

  const { supabase, error: accessError } =
    await verifySuperAdmin();

  if (accessError) {
    return { status: "error", message: accessError };
  }

  const { error } = await supabase.rpc(
    "remove_student_from_training_group",
    {
      p_enrollment_id: enrollmentId,
    },
  );

  if (error) {
    return {
      status: "error",
      message: error.message.includes("не найден")
        ? "Активное зачисление не найдено. Обновите страницу."
        : "Не удалось исключить ученика. Проверьте доступ и попробуйте ещё раз.",
    };
  }

  revalidatePath(`/dashboard/groups/${groupId}`);
  revalidatePath("/dashboard/groups");
  revalidatePath("/dashboard/students");

  return {
    status: "success",
    message: "Ученик исключён из группы. История зачисления сохранена.",
  };
}
