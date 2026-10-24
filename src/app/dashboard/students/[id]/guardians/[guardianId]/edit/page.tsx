
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GuardianEditForm from "./GuardianEditForm";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditGuardianPage({
  params,
}: {
  params: Promise<{ id: string; guardianId: string }>;
}) {
  // 1. Получаем идентификаторы из адреса страницы.
  const { id, guardianId } = await params;

  if (!UUID_REGEX.test(id) || !UUID_REGEX.test(guardianId)) {
    notFound();
  }

  const supabase = await createClient();

  // 2. Проверяем авторизацию.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // 3. Проверяем роль администратора.
  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (roleError || role !== "super_admin") {
    redirect("/dashboard");
  }

  // 4. Получаем академию администратора.
  const { data: academyId, error: academyError } =
    await supabase.rpc("get_my_str_admin_academy_id");

  if (academyError || !academyId) {
    notFound();
  }

  // 5. Загружаем ученика из своей академии.
  const { data: student, error: studentError } =
    await supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("id", id)
      .eq("academy_id", academyId)
      .maybeSingle();

  if (studentError || !student) {
    notFound();
  }

  // 6. Загружаем представителя именно этого ученика.
  const { data: guardian, error: guardianError } =
    await supabase
      .from("student_guardians")
      .select(
        "id, first_name, last_name, phone, email, relationship"
      )
      .eq("id", guardianId)
      .eq("student_id", student.id)
      .eq("academy_id", academyId)
      .maybeSingle();

  if (guardianError || !guardian) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/dashboard/students/${student.id}`}
        className="text-sm text-zinc-400 transition-colors hover:text-white"
      >
        ← Назад к ученику
      </Link>

      <p className="mt-8 text-sm font-semibold tracking-widest text-red-500">
        STR OF JIU JITSU
      </p>

      <h1 className="mt-3 text-3xl font-bold">
        Редактирование родителя
      </h1>

      <p className="mt-2 text-zinc-400">
        Ученик: {student.first_name} {student.last_name}
      </p>

      <GuardianEditForm
        studentId={student.id}
        guardian={guardian}
      />
    </div>
  );
}
