
import Link from "next/link";
import StudentForm from "./StudentForm";

export default function NewStudentPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/dashboard/students"
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← Назад к ученикам
      </Link>

      <h1 className="mt-6 text-3xl font-bold">
        Добавить ученика
      </h1>

      <p className="mt-2 text-zinc-400">
        Регистрация нового ученика STR OF JIU JITSU
      </p>

      <StudentForm />
    </div>
  );
}
