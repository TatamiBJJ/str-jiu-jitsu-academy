
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionState = {
  error: string | null;
};

const allowedBelts = new Set([
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

const allowedStatuses = new Set([
  "active",
  "inactive",
  "suspended",
  "archived",
]);

export async function createStudent(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const belt = String(formData.get("belt") ?? "");
  const status = String(formData.get("status") ?? "");

  // Проверяем обязательные поля.
  if (
    !firstName ||
    !lastName ||
    firstName.length > 100 ||
    lastName.length > 100
  ) {
    return { error: "Проверьте имя и фамилию ученика." };
  }

  if (!allowedBelts.has(belt) || !allowedStatuses.has(status)) {
    return { error: "Недопустимый пояс или статус." };
  }

  if (phone.length > 30) {
    return { error: "Номер телефона слишком длинный." };
  }

  // Проверяем дату рождения.
  if (dateOfBirth) {
    const parsedDate = new Date(`${dateOfBirth}T00:00:00Z`);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== dateOfBirth ||
      dateOfBirth > new Date().toISOString().slice(0, 10)
    ) {
      return { error: "Некорректная дата рождения." };
    }
  }

  const supabase = await createClient();

  // Проверяем авторизацию на сервере.
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: "Необходимо войти в аккаунт." };
  }

  // Получаем разрешённую академию через защищённую функцию.
  const { data: academyId, error: roleError } =
    await supabase.rpc("get_my_str_admin_academy_id");

  if (roleError || !academyId) {
    return { error: "Недостаточно прав для добавления ученика." };
  }

  // RLS дополнительно проверяет academy_id при INSERT.
  const { error: insertError } = await supabase
    .from("students")
    .insert({
      academy_id: academyId,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth || null,
      phone: phone || null,
      belt,
      status,
    });

  if (insertError) {
    console.error("Ошибка создания ученика:", insertError.code);
    return { error: "Не удалось сохранить ученика." };
  }

  revalidatePath("/dashboard/students");
  redirect("/dashboard/students");
}
