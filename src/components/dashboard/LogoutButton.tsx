
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setLoading(true);
    setError("");

    const supabase = createClient();

    // Завершаем сессию пользователя
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError("Не удалось выйти из аккаунта");
      setLoading(false);
      return;
    }

    // Очищаем серверное состояние интерфейса
    router.replace("/login");
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-zinc-400 transition-colors hover:bg-red-600/10 hover:text-red-500 disabled:opacity-50"
      >
        <LogOut size={18} />
        <span>{loading ? "Выход..." : "Выйти"}</span>
      </button>

      {error && (
        <p role="alert" className="mt-2 px-3 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
