
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import EnrollmentManager from "./EnrollmentManager";
import GroupStudents, {
  type GroupStudent,
} from "./GroupStudents";

const groupTypeLabels: Record<string, string> = {
  kids: "Детская",
  adults: "Взрослая",
  mixed: "Смешанная",
  competition: "Соревновательная",
  private: "Индивидуальные занятия",
};

function formatAgeRange(
  minAge: number | null,
  maxAge: number | null,
): string {
  if (minAge == null && maxAge == null) return "Без ограничений";
  if (minAge == null) return `До ${maxAge} лет`;
  if (maxAge == null) return `От ${minAge} лет`;
  return `${minAge}–${maxAge} лет`;
}

export default function GroupDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<GroupLoading />}>
      <GroupDetailsContent params={params} />
    </Suspense>
  );
}

function GroupLoading() {
  return (
    <div
      role="status"
      className="mx-auto max-w-5xl rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400"
    >
      Загружаем информацию о группе...
    </div>
  );
}

async function GroupDetailsContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;
  const supabase = await createClient();

  const { data: group, error: groupError } = await supabase
    .from("training_groups")
    .select(
      "id, academy_id, name, description, group_type, min_age, max_age, capacity, is_active, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (groupError) {
    throw new Error("Не удалось загрузить тренировочную группу.");
  }

  if (!group) {
    notFound();
  }

  const { data: enrollments, error: enrollmentError } =
    await supabase
      .from("group_enrollments")
      .select("id, student_id, enrolled_at, status")
      .eq("group_id", group.id)
      .eq("academy_id", group.academy_id)
      .order("enrolled_at", { ascending: false });

  if (enrollmentError) {
    throw new Error("Не удалось загрузить состав группы.");
  }

  const activeEnrollments = (enrollments ?? []).filter(
    (enrollment) => enrollment.status === "active",
  );

  const activeStudentIds = new Set(
    activeEnrollments.map((enrollment) => enrollment.student_id),
  );

  const { data: allStudents, error: studentsError } =
    await supabase
      .from("students")
      .select("id, first_name, last_name, belt, phone, status")
      .eq("academy_id", group.academy_id)
      .order("last_name", { ascending: true })
      .limit(500);

  if (studentsError) {
    throw new Error("Не удалось загрузить список учеников.");
  }

  const students = allStudents ?? [];

  const studentById = new Map(
    students.map((student) => [student.id, student]),
  );

  const availableStudents = students.filter(
    (student) =>
      student.status === "active" &&
      !activeStudentIds.has(student.id),
  );

  const groupStudents: GroupStudent[] = activeEnrollments.map(
    (enrollment) => {
      const student = studentById.get(enrollment.student_id);

      return {
        enrollmentId: enrollment.id,
        studentId: enrollment.student_id,
        firstName: student?.first_name ?? "Данные",
        lastName: student?.last_name ?? "недоступны",
        belt: student?.belt ?? "",
        phone: student?.phone ?? null,
        enrolledAt: enrollment.enrolled_at,
      };
    },
  );

  const capacity = group.capacity;

  const availablePlaces =
    capacity == null
      ? null
      : Math.max(0, capacity - activeEnrollments.length);

  const canEnroll =
    group.is_active &&
    (capacity == null || activeEnrollments.length < capacity);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/dashboard/groups"
        className="text-sm text-zinc-400 transition-colors hover:text-white"
      >
        ← Назад к группам
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold tracking-widest text-red-500">
          STR OF JIU JITSU
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">{group.name}</h1>

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              group.is_active
                ? "bg-green-500/10 text-green-400"
                : "bg-zinc-700/50 text-zinc-300"
            }`}
          >
            {group.is_active ? "Активна" : "Неактивна"}
          </span>
        </div>

        <p className="mt-3 text-zinc-400">
          Информация и управление тренировочной группой
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">
            Основная информация
          </h2>

          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-sm text-zinc-400">Тип группы</dt>
              <dd className="mt-1 font-medium">
                {groupTypeLabels[group.group_type] ?? group.group_type}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-zinc-400">
                Возраст участников
              </dt>
              <dd className="mt-1 font-medium">
                {formatAgeRange(group.min_age, group.max_age)}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-zinc-400">Вместимость</dt>
              <dd className="mt-1 font-medium">
                {capacity == null
                  ? `${activeEnrollments.length} учеников · без ограничения`
                  : `${activeEnrollments.length} из ${capacity} учеников`}
              </dd>

              {availablePlaces != null && (
                <p className="mt-1 text-sm text-zinc-400">
                  Свободных мест: {availablePlaces}
                </p>
              )}
            </div>

            <div>
              <dt className="text-sm text-zinc-400">Описание</dt>
              <dd className="mt-1 whitespace-pre-wrap text-zinc-300">
                {group.description || "Описание не указано"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Ученики</h2>

            <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
              {activeEnrollments.length}
            </span>
          </div>

          <GroupStudents
            groupId={group.id}
            students={groupStudents}
          />

          <div className="mt-6 border-t border-zinc-800 pt-5">
            <h3 className="font-semibold">Добавить ученика</h3>

            <EnrollmentManager
              groupId={group.id}
              students={availableStudents}
              canEnroll={canEnroll}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
