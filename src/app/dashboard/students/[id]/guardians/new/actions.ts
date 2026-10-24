
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionState = {
  error?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createGuardian(
  studentId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Проверяем идентификатор ученика.
  if (!UUID_REGEX.test(studentId)) {
    return {
      error: "Некорректный идентификатор ученика.",
    };
  }

  // 2. Получаем и нормализуем данные формы.
  const firstName = String(
    formData.get("first_name") ?? ""
  ).trim();

  const lastName = String(
    formData.get("last_name") ?? ""
  ).trim();

  const phone = String(
    formData.get("phone") ?? ""
  ).trim();

  const email = String(
    formData.get("email") ?? ""
  ).trim();

  const relationship = String(
    formData.get("relationship") ?? ""
  ).trim();

  // 3. Проверяем обязательные поля.
  if (!firstName || !lastName) {
    return {
      error: "Укажите имя и фамилию.",
    };
  }

  if (firstName.length > 100 || lastName.length > 100) {
    return {
      error: "Имя и фамилия не должны превышать 100 символов.",
    };
  }

  // 4. Проверяем телефон.
  if (phone.length < 5 || phone.length > 30) {
    return {
      error: "Проверьте номер телефона.",
    };
  }

  // 5. Проверяем email, если он указан.
  if (
    email.length > 254 ||
    (email !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    return {
      error: "Укажите корректный email.",
    };
  }

  // 6. Проверяем степень родства.
  if (!["parent", "guardian"].includes(relationship)) {
    return {
      error: "Выберите степень родства.",
    };
  }

  // 7. Проверяем действующую пользовательскую сессию.
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

  // 8. Создаём представителя через защищённую SQL-функцию.
  // Проверки роли, академии и основного представителя
  // выполняются внутри функции Supabase.
  const { data: guardianId, error: createError } =
    await supabase.rpc("create_student_guardian", {
      p_student_id: studentId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_phone: phone,
      p_email: email || null,
      p_relationship: relationship,
    });

  // 9. Обрабатываем ошибки сохранения.
  if (createError || !guardianId) {
    console.error("Guardian creation failed:", {
      code: createError?.code,
    });

    if (
      createError?.message?.includes(
        "Insufficient privileges"
      )
    ) {
      return {
        error: "Недостаточно прав для этой операции.",
      };
    }

    if (
      createError?.message?.includes(
        "Student not found in academy"
      )
    ) {
      return {
        error: "Ученик не найден в вашей академии.",
      };
    }

    return {
      error:
        "Не удалось сохранить представителя. Проверьте данные и права доступа.",
    };
  }

  // 10. Обновляем страницы после успешного сохранения.
  revalidatePath("/dashboard/students");
  revalidatePath(`/dashboard/students/${studentId}`);

  // 11. Возвращаемся в карточку ученика.
  redirect(`/dashboard/students/${studentId}`);
}
