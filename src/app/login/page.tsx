"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (authError) {
        setError(
          "Не удалось войти. Проверьте email, пароль и подтверждение почты."
        );

        setLoading(false);
        return;
      }

      // Сервер определяет роль пользователя
      // и перенаправляет в соответствующий кабинет.

      router.replace("/pending");
      router.refresh();

    } catch {
      setError(
        "Не удалось выполнить вход. Попробуйте позже."
      );

      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-white">

      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

        <h1 className="text-center text-3xl font-black">
          STR{" "}
          <span className="text-red-500">
            JIU JITSU
          </span>
        </h1>

        <p className="mt-3 text-center text-zinc-400">
          Вход в личный кабинет
        </p>

        <form
          onSubmit={handleLogin}
          className="mt-8 space-y-5"
        >

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              disabled={loading}
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-red-500 disabled:opacity-50"
              placeholder="example@email.com"
            />
          </div>

          <div>

            <div className="mb-2 flex items-center justify-between">

              <label
                htmlFor="password"
                className="text-sm"
              >
                Пароль
              </label>

              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                className="text-xs text-zinc-400 hover:text-white disabled:opacity-50"
              >
                {showPassword ? "Скрыть" : "Показать"}
              </button>

            </div>

            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              disabled={loading}
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-red-500 disabled:opacity-50"
              placeholder="Введите пароль"
            />

          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-red-600 py-3 font-bold transition hover:bg-red-500 disabled:opacity-50"
          >
            {loading
              ? "Выполняется вход..."
              : "Войти"}
          </button>

        </form>

        <div className="mt-6 border-t border-zinc-800 pt-6">

          <p className="mb-4 text-center text-sm text-zinc-400">
            Ещё нет аккаунта?
          </p>

          <Link
            href="/register"
            className="block w-full rounded-lg border border-red-600 py-3 text-center font-bold text-red-500 transition hover:bg-red-600/10"
          >
            Зарегистрироваться
          </Link>

        </div>

        <Link
          href="/"
          className="mt-6 block text-center text-sm text-zinc-400 hover:text-white"
        >
          Вернуться на главную
        </Link>

      </div>

    </main>
  );
}