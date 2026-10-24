
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionState = {
  error?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_BELTS = new Set([
  "white",
  "grey_white",
  "grey",
  "grey_black",
  "yellow_white",
  "yellow",
  "yellow_black",
  "orange_white",
  "orange",
  "orange_black",
  "green_white",
  "green",
  "green_black",
  "blue",
  "purple",
  "brown",
  "black",
]);

const ALLOWED_STATUSES = new Set([
  "active",
  "inactive",
  "suspended",
  "archived",
]);

export async function updateStudent(
  studentId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!UUID_REGEX.test(studentId)) {
    return { error: "Некорректный идентификатор ученика." };
  }

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const dateOfBirth = String(
    formData.get("date_of_birth") ?? ""
  ).trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const belt = String(formData.get("belt") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  // Проверяем персональные данные.
  if (
    !firstName ||
    !lastName ||
    firstName.length > 100 ||
    lastName.length > 100
  ) {
    return { error: "Проверьте имя и фамилию ученика." };
  }

  if (phone.length > 30) {
    return { error: "Номер телефона слишком длинный." };
  }

  // Проверяем дату рождения.
  if (dateOfBirth) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return { error: "Некорректный формат даты рождения." };
    }

    const parsedDate = new Date(`${dateOfBirth}T00:00:00Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== dateOfBirth
    ) {
      return { error: "Укажите существующую дату рождения." };
    }

    if (parsedDate.getTime() > Date.now()) {
      return { error: "Дата рождения не может быть в будущем." };
    }
  }

  if (!ALLOWED_BELTS.has(belt)) {
    return { error: "Выберите корректный пояс." };
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return { error: "Выберите корректный статус." };
  }

  const supabase = await createClient();

  // Проверяем действующую сессию.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "Сессия истекла. Войдите в систему заново.",
    };
  }

  // Изменение выполняет защищённая SQL-функция.
  const { data, error } = await supabase.rpc(
    "update_str_student",
    {
      p_student_id: studentId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_date_of_birth: dateOfBirth || null,
      p_phone: phone || null,
      p_belt: belt,
      p_status: status,
    }
  );

  if (error || !data) {
    console.error("Student update failed:", {
      code: error?.code,
    });

    if (error?.code === "42501") {
      return {
        error: "Недостаточно прав для редактирования ученика.",
      };
    }

    if (
      error?.message?.includes(
        "Student not found in academy"
      )
    ) {
      return {
        error: "Ученик не найден в вашей академии.",
      };
    }

    return {
      error: "Не удалось сохранить изменения. Попробуйте ещё раз.",
    };
  }

  revalidatePath(`/dashboard/students/${studentId}`);
  revalidatePath("/dashboard/students");

  redirect(`/dashboard/students/${studentId}`);
}
