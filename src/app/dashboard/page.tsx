
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-semibold tracking-widest text-red-500">
        STR OF JIU JITSU
      </p>

      <h1 className="mt-4 text-3xl font-bold">
        Панель Super Admin
      </h1>

      <p className="mt-3 text-zinc-400">
        Система управления академией
      </p>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-400">
          Ваша роль
        </p>

        <p className="mt-2 text-xl font-semibold text-red-500">
          Super Admin
        </p>
      </div>
    </div>
  );
}
