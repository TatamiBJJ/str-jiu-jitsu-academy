
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const GROUP_TYPES = [
  "kids",
  "adults",
  "mixed",
  "competition",
  "private",
] as const;

export type CreateGroupState = {
  success: boolean;
  message: string;
};

export async function createTrainingGroup(
  _previousState: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const supabase = await createClient();

  // Повторно проверяем авторизацию на сервере.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      message: "Сессия истекла. Войдите в систему повторно.",
    };
  }

  // Проверяем роль независимо от проверки в интерфейсе.
  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (roleError || role !== "super_admin") {
    return {
      success: false,
      message: "Недостаточно прав для создания группы.",
    };
  }

  // Академию определяем на сервере, а не из формы.
  const { data: academyId, error: academyError } =
    await supabase.rpc("get_my_str_admin_academy_id");

  if (academyError || !academyId) {
    return {
      success: false,
      message: "Не удалось определить академию пользователя.",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const groupType = String(formData.get("group_type") ?? "");

  if (!name || name.length > 120) {
    return {
      success: false,
      message: "Название обязательно и должно содержать не более 120 символов.",
    };
  }

  if (
    !GROUP_TYPES.includes(
      groupType as (typeof GROUP_TYPES)[number],
    )
  ) {
    return {
      success: false,
      message: "Выберите допустимый тип тренировочной группы.",
    };
  }

  function parseOptionalInteger(
    field: string,
  ): number | null | undefined {
    const raw = String(formData.get(field) ?? "").trim();

    if (!raw) return null;

    if (!/^\d+$/.test(raw)) return undefined;

    const value = Number(raw);

    if (!Number.isSafeInteger(value)) return undefined;

    return value;
  }

  const minAge = parseOptionalInteger("min_age");
  const maxAge = parseOptionalInteger("max_age");
  const capacity = parseOptionalInteger("capacity");

  if (
    minAge === undefined ||
    maxAge === undefined ||
    capacity === undefined
  ) {
    return {
      success: false,
      message: "Возраст и вместимость должны быть целыми неотрицательными числами.",
    };
  }

  if (
    (minAge !== null && minAge > 120) ||
    (maxAge !== null && maxAge > 120)
  ) {
    return {
      success: false,
      message: "Возраст должен быть не больше 120 лет.",
    };
  }

  if (
    minAge !== null &&
    maxAge !== null &&
    minAge > maxAge
  ) {
    return {
      success: false,
      message: "Минимальный возраст не может превышать максимальный.",
    };
  }

  if (capacity !== null && capacity <= 0) {
    return {
      success: false,
      message: "Вместимость должна быть больше нуля.",
    };
  }

  const { error: insertError } = await supabase
    .from("training_groups")
    .insert({
      academy_id: academyId,
      name,
      description,
      group_type: groupType,
      min_age: minAge,
      max_age: maxAge,
      capacity,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        success: false,
        message: "Группа с таким названием уже существует в академии.",
      };
    }

    if (
      insertError.code === "42501" ||
      insertError.code === "23503"
    ) {
      return {
        success: false,
        message: "База данных отклонила операцию. Проверьте права доступа.",
      };
    }

    // Подробности ошибки не показываем пользователю.
    console.error("Training group creation failed:", {
      code: insertError.code,
    });

    return {
      success: false,
      message: "Не удалось создать группу. Попробуйте позже.",
    };
  }

  revalidatePath("/dashboard/groups");

  return {
    success: true,
    message: "Тренировочная группа успешно создана.",
  };
}
