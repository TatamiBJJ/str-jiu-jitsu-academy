"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-red-500";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleRegister(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (loading) return;

    setError("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("Введите имя и фамилию.");
      return;
    }

    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: authError } =
        await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo:
              `${window.location.origin}/auth/callback`,
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              phone: phone.trim(),
            },
          },
        });

      if (authError) {
        setError(
          "Не удалось зарегистрироваться. Проверьте данные или попробуйте позже."
        );
        return;
      }

      if (data.session) {
        await supabase.auth.signOut();
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch {
      setError(
        "Произошла ошибка. Попробуйте позже."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

        <h1 className="text-center text-3xl font-black">
          STR <span className="text-red-500">JIU JITSU</span>
        </h1>

        <p className="mt-3 text-center text-zinc-400">
          Создание личного кабинета
        </p>

        {success ? (
          <div className="mt-8 space-y-5">

            <div
              role="status"
              className="rounded-xl border border-green-500/30 bg-green-500/10 p-5"
            >
              <h2 className="font-bold text-green-400">
                Запрос на регистрацию отправлен
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                Если требуется подтверждение электронной
                почты, проверьте входящие сообщения
                и папку «Спам».
              </p>

              <p className="mt-3 text-sm text-zinc-400">
                Для получения доступа к системе необходимо
                назначение роли администратором академии.
              </p>
            </div>

            <Link
              href="/login"
              className="block w-full rounded-lg bg-red-600 py-3 text-center font-bold transition hover:bg-red-500"
            >
              Перейти ко входу
            </Link>

          </div>
        ) : (
          <form
            onSubmit={handleRegister}
            className="mt-8 space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">

              <div>
                <label
                  htmlFor="firstName"
                  className="mb-2 block text-sm"
                >
                  Имя *
                </label>

                <input
                  id="firstName"
                  type="text"
                  required
                  maxLength={80}
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) =>
                    setFirstName(e.target.value)
                  }
                  placeholder="Ваше имя"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="mb-2 block text-sm"
                >
                  Фамилия *
                </label>

                <input
                  id="lastName"
                  type="text"
                  required
                  maxLength={80}
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) =>
                    setLastName(e.target.value)
                  }
                  placeholder="Ваша фамилия"
                  className={inputClass}
                />
              </div>

            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm"
              >
                Номер телефона *
              </label>

              <input
                id="phone"
                type="tel"
                required
                maxLength={25}
                autoComplete="tel"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value)
                }
                placeholder="+7 (700) 000-00-00"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm"
              >
                Email *
              </label>

              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="example@email.com"
                className={inputClass}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm"
                >
                  Пароль *
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  {showPassword ? "Скрыть" : "Показать"}
                </button>
              </div>

              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Минимум 8 символов"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm"
              >
                Подтверждение пароля *
              </label>

              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                placeholder="Повторите пароль"
                className={inputClass}
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
                ? "Создаём аккаунт..."
                : "Зарегистрироваться"}
            </button>

            <p className="text-center text-sm text-zinc-400">
              Уже есть аккаунт?{" "}
              <Link
                href="/login"
                className="font-semibold text-red-500 hover:text-red-400"
              >
                Войти
              </Link>
            </p>

          </form>
        )}

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