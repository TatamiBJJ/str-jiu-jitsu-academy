
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ScheduleActionState = {
  success: boolean;
  message: string;
};

const allowedTrainingTypes = new Set([
  "gi",
  "nogi",
  "open_mat",
  "competition",
  "other",
]);

const allowedRoles = new Set([
  "super_admin",
  "admin",
  "manager",
]);

function validTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function createTrainingSchedule(
  _previousState: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
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

  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (
    roleError ||
    !allowedRoles.has(String(role))
  ) {
    return {
      success: false,
      message: "Недостаточно прав.",
    };
  }

  const {
    data: academyId,
    error: academyError,
  } = await supabase.rpc(
    "get_my_str_admin_academy_id",
  );

  if (academyError || !academyId) {
    return {
      success: false,
      message: "Академия не найдена.",
    };
  }

  const groupId = String(
    formData.get("group_id") ?? "",
  );

  const dayOfWeek = Number(
    formData.get("day_of_week"),
  );

  const startTime = String(
    formData.get("start_time") ?? "",
  );

  const endTime = String(
    formData.get("end_time") ?? "",
  );

  const trainingType = String(
    formData.get("training_type") ?? "",
  );

  const validFrom = String(
    formData.get("valid_from") ?? "",
  );

  const validUntil = String(
    formData.get("valid_until") ?? "",
  );

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(groupId)) {
    return {
      success: false,
      message: "Выберите тренировочную группу.",
    };
  }

  if (
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 1 ||
    dayOfWeek > 7
  ) {
    return {
      success: false,
      message: "Некорректный день недели.",
    };
  }

  if (
    !validTime(startTime) ||
    !validTime(endTime) ||
    endTime <= startTime
  ) {
    return {
      success: false,
      message: "Время окончания должно быть позже начала.",
    };
  }

  if (!allowedTrainingTypes.has(trainingType)) {
    return {
      success: false,
      message: "Некорректный тип тренировки.",
    };
  }

  if (
    !validDate(validFrom) ||
    (validUntil && !validDate(validUntil))
  ) {
    return {
      success: false,
      message: "Некорректная дата.",
    };
  }

  if (validUntil && validUntil < validFrom) {
    return {
      success: false,
      message: "Дата окончания раньше даты начала.",
    };
  }

  const { data: group, error: groupError } =
    await supabase
      .from("training_groups")
      .select("id")
      .eq("id", groupId)
      .eq("academy_id", academyId)
      .maybeSingle();

  if (groupError || !group) {
    return {
      success: false,
      message: "Группа не найдена в вашей академии.",
    };
  }

  const { error: insertError } = await supabase
    .from("training_schedules")
    .insert({
      academy_id: academyId,
      group_id: groupId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      training_type: trainingType,
      valid_from: validFrom,
      valid_until: validUntil || null,
      is_active: true,
    });

  if (insertError) {
    console.error(
      "Schedule creation failed:",
      insertError.code,
    );

    return {
      success: false,
      message: "Не удалось создать расписание.",
    };
  }

  revalidatePath("/dashboard/schedule");

  return {
    success: true,
    message: "Расписание создано.",
  };
}

export async function deactivateTrainingSchedule(
  scheduleId: string,
): Promise<{
  success: boolean;
  message: string;
}> {
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
      message: "Недостаточно прав.",
    };
  }

  const { data: academyId, error: academyError } =
    await supabase.rpc(
      "get_my_str_admin_academy_id",
    );

  if (academyError || !academyId) {
    return {
      success: false,
      message: "Академия не найдена.",
    };
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(scheduleId)) {
    return {
      success: false,
      message: "Некорректный идентификатор.",
    };
  }

  const { data, error } = await supabase
    .from("training_schedules")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId)
    .eq("academy_id", academyId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "Schedule deactivation failed:",
      error.code,
    );

    return {
      success: false,
      message: "Не удалось отключить тренировку.",
    };
  }

  if (!data) {
    return {
      success: false,
      message: "Тренировка не найдена или уже отключена.",
    };
  }

  revalidatePath("/dashboard/schedule");

  return {
    success: true,
    message: "Тренировка удалена из расписания.",
  };
}

export type UpdateScheduleInput = {
  scheduleId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  trainingType: string;
  validFrom: string;
  validUntil: string | null;
};

export async function updateTrainingSchedule(
  input: UpdateScheduleInput,
): Promise<ScheduleActionState> {
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

  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (
    roleError ||
    !allowedRoles.has(String(role))
  ) {
    return {
      success: false,
      message: "Недостаточно прав.",
    };
  }

  const { data: academyId, error: academyError } =
    await supabase.rpc(
      "get_my_str_admin_academy_id",
    );

  if (academyError || !academyId) {
    return {
      success: false,
      message: "Академия не найдена.",
    };
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(input.scheduleId)) {
    return {
      success: false,
      message: "Некорректный ID расписания.",
    };
  }

  if (
    !Number.isInteger(input.dayOfWeek) ||
    input.dayOfWeek < 1 ||
    input.dayOfWeek > 7
  ) {
    return {
      success: false,
      message: "Некорректный день недели.",
    };
  }

  if (
    !validTime(input.startTime) ||
    !validTime(input.endTime) ||
    input.endTime <= input.startTime
  ) {
    return {
      success: false,
      message: "Некорректное время тренировки.",
    };
  }

  if (!allowedTrainingTypes.has(input.trainingType)) {
    return {
      success: false,
      message: "Некорректный тип тренировки.",
    };
  }

  if (
    !validDate(input.validFrom) ||
    (input.validUntil !== null &&
      !validDate(input.validUntil))
  ) {
    return {
      success: false,
      message: "Некорректная дата.",
    };
  }

  if (
    input.validUntil !== null &&
    input.validUntil < input.validFrom
  ) {
    return {
      success: false,
      message: "Дата окончания раньше даты начала.",
    };
  }

  const { data: schedule, error: scheduleError } =
    await supabase
      .from("training_schedules")
      .select("id")
      .eq("id", input.scheduleId)
      .eq("academy_id", academyId)
      .eq("is_active", true)
      .maybeSingle();

  if (scheduleError || !schedule) {
    return {
      success: false,
      message: "Активное расписание не найдено.",
    };
  }

  const { count, error: sessionsError } =
    await supabase
      .from("training_sessions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("academy_id", academyId)
      .eq("schedule_id", input.scheduleId);

  if (sessionsError) {
    return {
      success: false,
      message: "Не удалось проверить связанные занятия.",
    };
  }

  if ((count ?? 0) > 0) {
    return {
      success: false,
      message:
        "К расписанию уже привязаны занятия. Изменение необходимо оформить с новой даты.",
    };
  }

  const { data: updated, error: updateError } =
    await supabase
      .from("training_schedules")
      .update({
        day_of_week: input.dayOfWeek,
        start_time: input.startTime,
        end_time: input.endTime,
        training_type: input.trainingType,
        valid_from: input.validFrom,
        valid_until: input.validUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.scheduleId)
      .eq("academy_id", academyId)
      .eq("is_active", true)
      .select("id")
      .maybeSingle();

  if (updateError) {
    console.error(
      "Schedule update failed:",
      updateError.code,
    );

    return {
      success: false,
      message:
        updateError.code === "23P01"
          ? "Расписание пересекается с другой тренировкой этой группы."
          : "Не удалось обновить расписание.",
    };
  }

  if (!updated) {
    return {
      success: false,
      message: "Расписание не найдено или уже отключено.",
    };
  }

  revalidatePath("/dashboard/schedule");

  return {
    success: true,
    message: "Расписание обновлено.",
  };
}
