"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  ShieldCheck,
  ShieldOff,
  UserPlus,
  RotateCcw,
  Loader2,
} from "lucide-react";

import {
  assignUserRole,
  setUserRoleStatus,
} from "./actions";

import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  type AssignableRole,
  type ActionResult,
  type UserWithMemberships,
  type UserMembership,
} from "./types";

interface UserRoleActionsProps {
  user: UserWithMemberships;
  currentUserId: string;
}

export default function UserRoleActions({
  user,
  currentUserId,
}: UserRoleActionsProps) {

  const router = useRouter();

  const [isPending, startTransition] =
    useTransition();

  const [selectedRole, setSelectedRole] =
    useState<AssignableRole | "">("");

  const [result, setResult] =
    useState<ActionResult | null>(null);

  const isProtected =
    user.user_id === currentUserId ||
    user.roles.includes("super_admin");

  const availableRoles = ASSIGNABLE_ROLES.filter(
    (role) =>
      !user.memberships.some(
        (membership) => membership.role === role
      )
  );

  // Назначение новой роли

  function handleAssignRole() {

    if (
      !selectedRole ||
      isPending ||
      isProtected ||
      !user.email_confirmed
    ) {
      return;
    }

    const role = selectedRole;

    const confirmed = window.confirm(
      `Назначить пользователю роль «${ROLE_LABELS[role]}»?`
    );

    if (!confirmed) return;

    setResult(null);

    startTransition(async () => {

      try {

        const response = await assignUserRole(
          user.user_id,
          role
        );

        setResult(response);

        if (response.success) {
          setSelectedRole("");
          router.refresh();
        }

      } catch {

        setResult({
          success: false,
          message: "Не удалось назначить роль.",
        });

      }

    });
  }

  // Блокировка или восстановление роли

  function handleChangeStatus(
    membership: UserMembership
  ) {

    if (
      isPending ||
      isProtected ||
      membership.role === "super_admin"
    ) {
      return;
    }

    const nextStatus = !membership.is_active;

    if (nextStatus && !user.email_confirmed) {
      return;
    }

    const action = nextStatus
      ? "Восстановить"
      : "Отключить";

    const confirmed = window.confirm(
      `${action} доступ по роли «${ROLE_LABELS[membership.role]}»?`
    );

    if (!confirmed) return;

    setResult(null);

    startTransition(async () => {

      try {

        const response = await setUserRoleStatus(
          membership.member_id,
          nextStatus
        );

        setResult(response);

        if (response.success) {
          router.refresh();
        }

      } catch {

        setResult({
          success: false,
          message: "Не удалось изменить статус роли.",
        });

      }

    });
  }

  // Защищённые аккаунты

  if (isProtected) {

    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2">

        <ShieldCheck className="h-4 w-4 shrink-0 text-zinc-400" />

        <span className="text-xs text-zinc-400">
          Защищённый аккаунт
        </span>

      </div>
    );
  }

  return (
    <div className="min-w-[240px] space-y-3">

      {/* Существующие роли */}

      {user.memberships.length > 0 && (

        <div className="space-y-2">

          {user.memberships.map((membership) => (

            <div
              key={membership.member_id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3"
            >

              <div className="min-w-0">

                <p className="text-sm font-medium text-white">
                  {ROLE_LABELS[membership.role]}
                </p>

                <p
                  className={`mt-1 text-xs ${
                    membership.is_active
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {membership.is_active
                    ? "Доступ активен"
                    : "Доступ отключён"}
                </p>

              </div>

              <button
                type="button"
                disabled={
                  isPending ||
                  membership.role === "super_admin" ||
                  (
                    !membership.is_active &&
                    !user.email_confirmed
                  )
                }
                onClick={() =>
                  handleChangeStatus(membership)
                }
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  membership.is_active
                    ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
                    : "border-green-500/20 text-green-400 hover:bg-green-500/10"
                }`}
              >

                {membership.is_active ? (
                  <ShieldOff size={14} />
                ) : (
                  <RotateCcw size={14} />
                )}

                {membership.is_active
                  ? "Отключить"
                  : "Восстановить"}

              </button>

            </div>

          ))}

        </div>

      )}

      {/* Предупреждение о неподтверждённой почте */}

      {!user.email_confirmed && (

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-400">

          Пользователь должен подтвердить электронную
          почту перед назначением или восстановлением роли.

        </div>

      )}

      {/* Назначение новой роли */}

      {user.email_confirmed &&
        availableRoles.length > 0 && (

        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">

          <p className="text-xs font-medium text-zinc-400">

            {user.memberships.length === 0
              ? "Подтверждение аккаунта"
              : "Назначение дополнительной роли"}

          </p>

          <select
            aria-label="Выберите роль пользователя"
            value={selectedRole}
            disabled={isPending}
            onChange={(event) =>
              setSelectedRole(
                event.target.value as AssignableRole | ""
              )
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-red-500 disabled:opacity-50"
          >

            <option value="">
              Выберите роль
            </option>

            {availableRoles.map((role) => (

              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>

            ))}

          </select>

          <button
            type="button"
            disabled={!selectedRole || isPending}
            onClick={handleAssignRole}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >

            {isPending ? (

              <Loader2
                size={15}
                className="animate-spin"
              />

            ) : (

              <UserPlus size={15} />

            )}

            {user.memberships.length === 0
              ? "Подтвердить аккаунт"
              : "Назначить роль"}

          </button>

        </div>

      )}

      {/* Результат операции */}

      {result && (

        <div
          role={result.success ? "status" : "alert"}
          className={`rounded-lg border p-3 text-xs leading-relaxed ${
            result.success
              ? "border-green-500/20 bg-green-500/10 text-green-400"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          }`}
        >
          {result.message}
        </div>

      )}

    </div>
  );
}