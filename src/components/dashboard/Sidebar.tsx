
"use client";

import LogoutButton from "./LogoutButton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  UserRound,
  GraduationCap,
  CalendarDays,
  CreditCard,
  Wallet,
  ClipboardCheck,
  Trophy,
  ShieldCheck,
  Settings,
} from "lucide-react";

const menuItems = [
  { title: "Главная", href: "/dashboard", icon: LayoutDashboard },
  { title: "Ученики", href: "/dashboard/students", icon: Users },
  {
    title: "Тренировочные группы",
    href: "/dashboard/groups",
    icon: Dumbbell,
  },
  { title: "Родители", href: "/dashboard/parents", icon: UserRound },
  { title: "Тренеры", href: "/dashboard/coaches", icon: GraduationCap },
  { title: "Расписание", href: "/dashboard/schedule", icon: CalendarDays },
  { title: "Абонементы", href: "/dashboard/subscriptions", icon: CreditCard },
  { title: "Оплаты", href: "/dashboard/payments", icon: Wallet },
  {
    title: "Посещаемость",
    href: "/dashboard/attendance",
    icon: ClipboardCheck,
  },
  { title: "STR Points", href: "/dashboard/points", icon: Trophy },
  { title: "Пользователи", href: "/dashboard/users", icon: ShieldCheck },
  { title: "Настройки", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-5 text-white">
      <div className="mb-8 border-b border-zinc-800 pb-6">
        <h2 className="text-xl font-black">
          STR <span className="text-red-500">JIU JITSU</span>
        </h2>
        <p className="mt-2 text-xs text-zinc-500">
          Academy Management
        </p>
      </div>

      <nav aria-label="Меню управления" className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(item.href + "/"));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${
                active
                  ? "bg-red-600 font-semibold text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-zinc-800 pt-4">
        <LogoutButton />
      </div>
    </aside>
  );
}
