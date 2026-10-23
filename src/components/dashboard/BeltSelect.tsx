
"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";

const beltGroups = [
  {
    label: "Начальный пояс",
    belts: [{ value: "white", label: "Белый" }],
  },
  {
    label: "Детские пояса",
    belts: [
      { value: "grey_white", label: "Серо-белый" },
      { value: "grey", label: "Серый" },
      { value: "grey_black", label: "Серо-чёрный" },
      { value: "yellow_white", label: "Жёлто-белый" },
      { value: "yellow", label: "Жёлтый" },
      { value: "yellow_black", label: "Жёлто-чёрный" },
      { value: "orange_white", label: "Оранжево-белый" },
      { value: "orange", label: "Оранжевый" },
      { value: "orange_black", label: "Оранжево-чёрный" },
      { value: "green_white", label: "Зелёно-белый" },
      { value: "green", label: "Зелёный" },
      { value: "green_black", label: "Зелёно-чёрный" },
    ],
  },
  {
    label: "Взрослые пояса",
    belts: [
      { value: "blue", label: "Синий" },
      { value: "purple", label: "Пурпурный" },
      { value: "brown", label: "Коричневый" },
      { value: "black", label: "Чёрный" },
    ],
  },
];

export default function BeltSelect() {
  const [selected, setSelected] = useState("white");
  const [open, setOpen] = useState(false);

  const selectedLabel = beltGroups
    .flatMap((group) => group.belts)
    .find((belt) => belt.value === selected)?.label;

  return (
    <div className="relative">
      <input type="hidden" name="belt" value={selected} />

      <button
        type="button"
        aria-expanded={open}
        aria-controls="belt-options"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-left text-white"
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={18} className="text-zinc-400" />
      </button>

      {open && (
        <div
          id="belt-options"
          className="absolute top-full z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl"
        >
          {beltGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 py-2 text-xs font-bold text-zinc-400">
                {group.label}
              </p>

              {group.belts.map((belt) => (
                <button
                  key={belt.value}
                  type="button"
                  onClick={() => {
                    setSelected(belt.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-white hover:bg-zinc-800"
                >
                  {belt.label}
                  {selected === belt.value && (
                    <Check size={16} className="text-red-500" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
