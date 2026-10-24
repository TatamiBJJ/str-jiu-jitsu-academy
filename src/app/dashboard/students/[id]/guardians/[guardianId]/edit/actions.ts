
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionState = {
  error?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateGuardian(
  studentId: string,
  guardianId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Проверяем идентификаторы.
  if (
    !UUID_REGEX.test(studentId) ||
    !UUID_REGEX.test(guardianId)
  ) {
    return {
      error: "Некорректный идентификатор ученика или представителя.",
    };
  }

  // 2. Получаем данные формы.
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const relationship = String(formData.get("relationship") ?? "").trim();

  // 3. Проверяем данные.
  if (
    !firstName ||
    !lastName ||
    firstName.length > 100 ||
    lastName.length > 100
  ) {
    return { error: "Проверьте имя и фамилию." };
  }

  if (phone.length < 5 || phone.length > 30) {
    return { error: "Проверьте номер телефона." };
  }

  if (
    email.length > 254 ||
    (email !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    return { error: "Укажите корректный email." };
  }

  if (!["parent", "guardian"].includes(relationship)) {
    return { error: "Выберите степень родства." };
  }

  // 4. Проверяем авторизацию.
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "Сессия истекла. Войдите в систему заново.",
    };
  }

  // 5. Обновляем представителя через защищённую RPC-функцию.
  const { data, error } = await supabase.rpc(
    "update_student_guardian",
    {
      p_student_id: studentId,
      p_guardian_id: guardianId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_phone: phone,
      p_email: email || null,
      p_relationship: relationship,
    }
  );

  if (error || !data) {
    console.error("Guardian update failed:", {
      code: error?.code,
    });

    if (error?.code === "42501") {
      return {
        error: "Недостаточно прав для изменения представителя.",
      };
    }

    if (error?.message?.includes("Student not found in academy")) {
      return {
        error: "Ученик не найден в вашей академии.",
      };
    }

    if (error?.message?.includes("Guardian not found in academy")) {
      return {
        error: "Представитель не найден.",
      };
    }

    return {
      error: "Не удалось сохранить изменения. Попробуйте ещё раз.",
    };
  }

  // 6. Обновляем карточку ученика.
  revalidatePath(`/dashboard/students/${studentId}`);

  // 7. Возвращаемся к ученику.
  redirect(`/dashboard/students/${studentId}`);
}
