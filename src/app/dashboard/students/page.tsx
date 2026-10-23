
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

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

function formatDate(value: string | null): string {
  if (!value) return "—";

  const parts = value.split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export default async function StudentsPage() {
  const supabase = await createClient();

  const { data: students, error } = await supabase
    .from("students")
    .select(
      "id, first_name, last_name, date_of_birth, belt, status, phone"
    )
    .order("last_name", { ascending: true })
    .limit(100);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-semibold tracking-widest text-red-500">
        STR OF JIU JITSU
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Ученики</h1>

        <Link
          href="/dashboard/students/new"
          className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          + Добавить ученика
        </Link>
      </div>

      <p className="mt-3 text-zinc-400">
        Управление учениками академии
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {error ? (
          <p role="alert" className="p-6 text-red-400">
            Не удалось загрузить учеников.
          </p>
        ) : !students || students.length === 0 ? (
          <p className="p-6 text-zinc-400">
            В академии пока нет зарегистрированных учеников.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="p-4">Ученик</th>
                  <th className="p-4">Дата рождения</th>
                  <th className="p-4">Пояс</th>
                  <th className="p-4">Телефон</th>
                  <th className="p-4">Статус</th>
                </tr>
              </thead>

              <tbody>
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-zinc-800/60 transition-colors hover:bg-zinc-800/40"
                  >
                    <td className="p-4 font-medium">
                      <Link
                        href={`/dashboard/students/${student.id}`}
                        className="text-white transition-colors hover:text-red-500 hover:underline"
                      >
                        {student.first_name} {student.last_name}
                      </Link>
                    </td>

                    <td className="p-4 text-zinc-300">
                      {formatDate(student.date_of_birth)}
                    </td>

                    <td className="p-4">
                      {beltLabels[student.belt] ?? student.belt}
                    </td>

                    <td className="p-4 text-zinc-300">
                      {student.phone ?? "—"}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          student.status === "active"
                            ? "bg-green-500/10 text-green-400"
                            : student.status === "suspended"
                              ? "bg-orange-500/10 text-orange-400"
                              : "bg-zinc-700/50 text-zinc-300"
                        }`}
                      >
                        {statusLabels[student.status] ?? student.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
