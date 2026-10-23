
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GuardianForm from "./GuardianForm";

export default async function NewGuardianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    notFound();
  }

  const supabase = await createClient();

  const { data: student, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, date_of_birth")
    .eq("id", id)
    .maybeSingle();

  if (error || !student) {
    notFound();
  }

  const isMinor = student.date_of_birth
    ? (() => {
        const today = new Date();
        const birthDate = new Date(
          `${student.date_of_birth}T00:00:00`
        );

        let age = today.getFullYear() - birthDate.getFullYear();

        const beforeBirthday =
          today.getMonth() < birthDate.getMonth() ||
          (today.getMonth() === birthDate.getMonth() &&
            today.getDate() < birthDate.getDate());

        if (beforeBirthday) age--;

        return age < 18;
      })()
    : false;

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
        Добавить родителя
      </h1>

      <p className="mt-2 text-zinc-400">
        Ученик: {student.first_name} {student.last_name}
      </p>

      {isMinor && (
        <div className="mt-6 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
          <p className="font-medium text-orange-400">
            Несовершеннолетний ученик
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Для ученика младше 18 лет необходимо указать
            хотя бы одного родителя или законного представителя.
          </p>
        </div>
      )}

      <GuardianForm studentId={student.id} />
    </div>
  );
}
