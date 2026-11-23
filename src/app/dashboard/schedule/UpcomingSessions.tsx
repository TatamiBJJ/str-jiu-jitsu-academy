
import type { SessionStatus } from "./session-actions";
import SessionStatusButtons from "./SessionStatusButtons";

export type UpcomingSession = {
  id: string;
  group_id: string;
  starts_at: string;
  ends_at: string;
  training_type: string;
  status: SessionStatus;
};

type Props = {
  sessions: UpcomingSession[];
  groupNames: Record<string, string>;
  canManageSessionIds: string[];
};

const trainingTypes: Record<string, string> = {
  gi: "Gi (кимоно)",
  nogi: "No-Gi",
  open_mat: "Open Mat",
  competition: "Подготовка к соревнованиям",
  other: "Другое",
};

const statuses: Record<
  SessionStatus,
  {
    label: string;
    className: string;
  }
> = {
  scheduled: {
    label: "Запланирована",
    className: "bg-blue-500/10 text-blue-400",
  },
  in_progress: {
    label: "Идёт тренировка",
    className: "bg-amber-500/10 text-amber-400",
  },
  completed: {
    label: "Завершена",
    className: "bg-emerald-500/10 text-emerald-400",
  },
  cancelled: {
    label: "Отменена",
    className: "bg-red-500/10 text-red-400",
  },
};

const dateFormatter = new Intl.DateTimeFormat(
  "ru-RU",
  {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  },
);

const timeFormatter = new Intl.DateTimeFormat(
  "ru-RU",
  {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  },
);

export default function UpcomingSessions({
  sessions,
  groupNames,
  canManageSessionIds,
}: Props) {
  const manageableIds = new Set(canManageSessionIds);

  return (
    <section className="mt-12">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">
          Ближайшие занятия
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          Конкретные тренировки, созданные
          из регулярного расписания.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8">
          <p className="text-sm text-zinc-400">
            Занятий пока нет. Сначала необходимо
            сгенерировать тренировки.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => {
            const status = statuses[session.status];

            return (
              <article
                key={session.id}
                className="flex min-h-[230px] flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold capitalize text-white">
                    {dateFormatter.format(
                      new Date(session.starts_at),
                    )}
                  </p>

                  <p className="mt-3 text-xl font-bold text-white">
                    {timeFormatter.format(
                      new Date(session.starts_at),
                    )}
                    {" — "}
                    {timeFormatter.format(
                      new Date(session.ends_at),
                    )}
                  </p>

                  <p className="mt-2 text-sm text-zinc-300">
                    {groupNames[session.group_id] ??
                      "Группа не найдена"}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-200">
                      {trainingTypes[session.training_type] ??
                        session.training_type}
                    </span>

                    <span
                      className={`rounded-md px-3 py-1 text-xs font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                </div>

                {manageableIds.has(session.id) && (
                  <SessionStatusButtons
                    sessionId={session.id}
                    status={session.status}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
