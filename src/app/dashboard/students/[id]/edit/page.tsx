
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StudentEditForm from "./StudentEditForm";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Получаем идентификатор ученика.
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    notFound();
  }

  const supabase = await createClient();

  // Проверяем действующую сессию.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Доступ разрешён только Super Admin.
  const { data: role, error: roleError } =
    await supabase.rpc("get_my_str_role");

  if (roleError || role !== "super_admin") {
    redirect("/dashboard");
  }

  // Получаем академию текущего администратора.
  const { data: academyId, error: academyError } =
    await supabase.rpc("get_my_str_admin_academy_id");

  if (academyError || !academyId) {
    notFound();
  }

  // Загружаем ученика только из своей академии.
  const { data: student, error: studentError } =
    await supabase
      .from("students")
      .select(
        "id, first_name, last_name, date_of_birth, phone, belt, status"
      )
      .eq("id", id)
      .eq("academy_id", academyId)
      .maybeSingle();

  if (studentError || !student) {
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
        Редактирование ученика
      </h1>

      <p className="mt-2 text-zinc-400">
        Ученик: {student.first_name} {student.last_name}
      </p>

      <p className="mt-4 text-sm text-yellow-400">
                Статус из Supabase: {student.status}
      </p>

<StudentEditForm
  key={`${student.id}-${student.status}-${student.belt}-${student.first_name}-${student.last_name}`}
  student={student}
/>
    </div>
  );
}
