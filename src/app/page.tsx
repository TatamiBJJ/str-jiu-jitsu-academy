
export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-xl font-black tracking-wider">
          STR of <span className="text-red-500">JIU - JITSU</span>
        </div>

        <a
          href="/login"
          className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold hover:bg-red-500"
        >
          Личный кабинет
        </a>
      </header>

      <section className="mx-auto flex min-h-[75vh] max-w-6xl flex-col justify-center px-6 py-20">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
          Brazilian Jiu-Jitsu Academy
        </p>

        <h1 className="text-5xl font-black tracking-tight md:text-7xl">
          STR OF
          <br />
          <span className="text-red-500">JIU - JITSU</span>
        </h1>

        <p className="mt-8 max-w-xl text-lg leading-relaxed text-zinc-400">
          Академия бразильского джиу-джитсу в Астане.
          Тренируйся, развивайся, отслеживай свои достижения
          и становись сильнее каждый день.
        </p>

        <div className="mt-10">
          <a
            href="/login"
            className="inline-block rounded-xl bg-red-600 px-7 py-4 font-bold transition hover:bg-red-500"
          >
            Начать тренировки
          </a>
        </div>
      </section>

      <section className="border-t border-zinc-800 bg-zinc-900 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold">
            Больше, чем тренировки
          </h2>

          <p className="mt-5 max-w-2xl text-zinc-400">
            Расписание, посещаемость, абонементы и STR Points —
            всё в одной системе.
          </p>
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-6 py-8 text-center text-sm text-zinc-500">
        © STR OF JIU JITSU
      </footer>
    </main>
  );
}
