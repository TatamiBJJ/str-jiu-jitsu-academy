
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const beltLabels: Record<string, string> = {
  white: "Белый",
  grey_white: "Серо-белый",
  grey: "Серый",
  grey_black: "Серо-чёрный",
  yellow_white: "Жёлто-белый",
  yellow: "Жёлтый",
  yellow_black: "Жёлто-чёрный",
  orange_white: "Оранжево-белый",
  orange: "Оранжевый",
  orange_black: "Оранжево-чёрный",
  green_white: "Зелёно-белый",
  green: "Зелёный",
  green_black: "Зелёно-чёрный",
  blue: "Синий",
  purple: "Пурпурный",
  brown: "Коричневый",
  black: "Чёрный",
};

const statusLabels: Record<string, string> = {
  active: "Активный",
  inactive: "Неактивный",
  suspended: "Приостановлен",
  archived: "В архиве",
};

const relationshipLabels: Record<string, string> = {
  parent: "Родитель",
  guardian: "Законный представитель",
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const parts = value.split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function isUnder18(dateOfBirth: string | null) {
  if (!dateOfBirth) return false;

  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();

  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age >= 0 && age < 18;
}

export default async function StudentDetailsPage({
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
    .select(
      "id, first_name, last_name, date_of_birth, phone, belt, status, joined_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <p role="alert" className="text-red-400">
        Не удалось загрузить карточку ученика.
      </p>
    );
  }

  if (!student) {
    notFound();
  }

  const {
    data: guardians,
    error: guardiansError,
  } = await supabase
    .from("student_guardians")
    .select(
      "id, first_name, last_name, phone, email, relationship, is_primary, is_active"
    )
    .eq("student_id", student.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  const activeGuardians =
    guardians?.filter((guardian) => guardian.is_active) ?? [];

  const minor = isUnder18(student.date_of_birth);

  const studentFields = [
    { label: "Имя", value: student.first_name },
    { label: "Фамилия", value: student.last_name },
    {
      label: "Дата рождения",
      value: formatDate(student.date_of_birth),
    },
    { label: "Телефон", value: student.phone || "—" },
    {
      label: "Пояс",
      value: beltLabels[student.belt] ?? student.belt,
    },
    {
      label: "Статус",
      value: statusLabels[student.status] ?? student.status,
    },
    {
      label: "Дата вступления",
      value: formatDate(student.joined_at),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/dashboard/students"
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← Назад к ученикам
      </Link>

      <p className="mt-8 text-sm font-semibold tracking-widest text-red-500">
        STR OF JIU JITSU
      </p>

      <h1 className="mt-3 text-3xl font-bold">
        {student.first_name} {student.last_name}
      </h1>

      <p className="mt-2 text-zinc-400">
        Персональная карточка ученика
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {studentFields.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <p className="text-sm text-zinc-400">{item.label}</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              Родители / законные представители
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Контактная информация и ответственные представители ученика.
            </p>
          </div>

          <Link
            href={`/dashboard/students/${student.id}/guardians/new`}
            className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            + Добавить родителя
          </Link>
        </div>

        {guardiansError ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-400"
          >
            Не удалось загрузить список представителей.
            Проверьте права доступа к таблице student_guardians.
          </div>
        ) : !guardians || guardians.length === 0 ? (
          <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-zinc-300">
              Родители или законные представители пока не указаны.
            </p>

            {minor && (
              <p className="mt-3 text-sm text-orange-400">
                Необходимо добавить хотя бы одного активного
                представителя для несовершеннолетнего ученика.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {guardians.map((guardian) => (
              <div
                key={guardian.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {guardian.first_name} {guardian.last_name}
                    </h3>

                    <p className="mt-1 text-sm text-zinc-400">
                      {relationshipLabels[guardian.relationship] ??
                        guardian.relationship}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {guardian.is_primary && (
                      <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
                        Основной представитель
                      </span>
                    )}

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        guardian.is_active
                          ? "bg-green-500/10 text-green-400"
                          : "bg-zinc-700/50 text-zinc-300"
                      }`}
                    >
                      {guardian.is_active ? "Активный" : "Неактивный"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-zinc-400">Телефон</p>
                    <p className="mt-1 text-white">
                      {guardian.phone}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-zinc-400">Email</p>
                    <p className="mt-1 break-all text-white">
                      {guardian.email || "Не указан"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!guardiansError && minor && activeGuardians.length === 0 && (
          <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-400">
            Внимание: у несовершеннолетнего ученика нет активного
            представителя. Проверьте список и статус записей.
          </div>
        )}
      </section>
    </div>
  );
}
