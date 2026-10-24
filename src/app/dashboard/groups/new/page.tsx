
import Link from "next/link";
import GroupCreateForm from "../GroupCreateForm";

export default function NewTrainingGroupPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/dashboard/groups"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
      >
        ← Назад к группам
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold tracking-widest text-red-500">
          STR OF JIU JITSU
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Создание группы
        </h1>

        <p className="mt-3 text-zinc-400">
          Создайте тренировочную группу для вашей академии.
        </p>
      </div>

      <div className="mt-8">
        <GroupCreateForm />
      </div>
    </div>
  );
}
