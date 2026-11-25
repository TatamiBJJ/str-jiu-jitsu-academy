"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import {
  ASSIGNABLE_ROLES,
  type AssignableRole,
  type ActionResult,
} from "./types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


// Проверка полномочий Super Admin

async function requireSuperAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Authentication required");
  }

  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (roleError || role !== "super_admin") {
    throw new Error("Access denied");
  }

  return { supabase, user };
}


// Обработка ошибок RPC

function getErrorMessage(message: string): string {
  switch (message) {
    case "Authentication required":
      return "Необходимо войти в систему.";

    case "Access denied":
      return "Недостаточно прав для выполнения операции.";

    case "Invalid or restricted role":
      return "Выбранная роль недоступна для назначения.";

    case "Cannot modify your own roles":
      return "Нельзя изменять собственные роли.";

    case "Cannot modify your own access":
      return "Нельзя изменять собственный доступ.";

    case "Cannot modify Super Admin access":
      return "Нельзя изменять доступ Super Admin.";

    case "Email is not confirmed":
      return "Пользователь ещё не подтвердил электронную почту.";

    case "Membership not found":
      return "Назначенная роль не найдена.";

    case "Invalid parameters":
      return "Переданы некорректные параметры.";

    default:
      return "Не удалось выполнить операцию. Попробуйте повторно.";
  }
}


// Назначение роли пользователю

export async function assignUserRole(
  userId: string,
  role: AssignableRole
): Promise<ActionResult> {

  if (
    typeof userId !== "string" ||
    !UUID_REGEX.test(userId)
  ) {
    return {
      success: false,
      message: "Некорректный идентификатор пользователя.",
    };
  }

  if (!ASSIGNABLE_ROLES.includes(role)) {
    return {
      success: false,
      message: "Недопустимая роль.",
    };
  }

  try {
    const { supabase, user } =
      await requireSuperAdmin();

    if (user.id === userId) {
      return {
        success: false,
        message: "Нельзя изменять собственные роли.",
      };
    }

    const { error } = await supabase.rpc(
      "admin_assign_str_user_role",
      {
        p_user_id: userId,
        p_role: role,
      }
    );

    if (error) {
      console.error(
        "assignUserRole RPC error:",
        error.code
      );

      return {
        success: false,
        message: getErrorMessage(error.message),
      };
    }

    revalidatePath("/dashboard/users");

    return {
      success: true,
      message: "Роль успешно назначена.",
    };

  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(
        error instanceof Error
          ? error.message
          : ""
      ),
    };
  }
}


// Блокировка и восстановление роли

export async function setUserRoleStatus(
  memberId: string,
  isActive: boolean
): Promise<ActionResult> {

  if (
    typeof memberId !== "string" ||
    !UUID_REGEX.test(memberId)
  ) {
    return {
      success: false,
      message: "Некорректный идентификатор роли.",
    };
  }

  if (typeof isActive !== "boolean") {
    return {
      success: false,
      message: "Некорректный статус доступа.",
    };
  }

  try {
    const { supabase } =
      await requireSuperAdmin();

    const { error } = await supabase.rpc(
      "admin_set_str_user_role_status",
      {
        p_member_id: memberId,
        p_is_active: isActive,
      }
    );

    if (error) {
      console.error(
        "setUserRoleStatus RPC error:",
        error.code
      );

      return {
        success: false,
        message: getErrorMessage(error.message),
      };
    }

    revalidatePath("/dashboard/users");

    return {
      success: true,
      message: isActive
        ? "Доступ успешно восстановлен."
        : "Доступ успешно отключён.",
    };

  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(
        error instanceof Error
          ? error.message
          : ""
      ),
    };
  }
}