"use client";

import { useState } from "react";

const COLORS = [
  {
    button: "border-blue-400/30 bg-blue-700/50 text-blue-100 hover:bg-blue-500/20",
    badge: "bg-blue-500/20 text-blue-200 border-blue-400/30",
    hex: "#3b82f6",
  },
  {
    button: "border-green-300/50 bg-green-600/50 text-green-100 hover:bg-green-500/20",
    badge: "bg-green-500/20 text-green-200 border-green-400/30",
    hex: "#22c55e",
  },
  {
    button: "border-orange-400/30 bg-orange-600/50 text-orange-100 hover:bg-orange-500/20",
    badge: "bg-orange-500/20 text-orange-200 border-orange-400/30",
    hex: "#f97316",
  },
  {
    button: "border-purple-400/30 bg-purple-600/50 text-purple-100 hover:bg-purple-500/20",
    badge: "bg-purple-500/20 text-purple-200 border-purple-400/30",
    hex: "#a855f7",
  },
];

export function loadColors(uid: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(`person_picker_colors_${uid}`);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function saveColors(uid: string, colors: Record<string, string>): void {
  localStorage.setItem(`person_picker_colors_${uid}`, JSON.stringify(colors));
}

export function getPersonColor(uid: string, name: string, names: string[]): string {
  const custom = loadColors(uid)[name];
  if (custom) return custom;
  const i = names.indexOf(name);
  return COLORS[i >= 0 ? i % COLORS.length : 0].hex;
}

export function loadNames(uid: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(`person_picker_names_${uid}`);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function getPerson(uid: string): string | null {
  if (typeof window === "undefined") return null;
  const p = localStorage.getItem(`person_${uid}`);
  if (!p) return null;
  const names = loadNames(uid);
  if (names.includes(p)) return p;
  return null;
}

export default function PersonPicker({ uid, onNamesChange }: { uid: string; onNamesChange?: (names: string[]) => void }) {
  const [names, setNames] = useState<string[]>(() => loadNames(uid));
  const [person, setPerson] = useState<string | null>(() => getPerson(uid));
  const [newName, setNewName] = useState("");
  const [colors, setColors] = useState<Record<string, string>>(() => loadColors(uid));

  const handlePick = (name: string) => {
    setPerson(name);
    localStorage.setItem(`person_${uid}`, name);
  };

  const handleAdd = () => {
    const name = newName.trim().toLowerCase();
    if (!name || names.includes(name) || names.length >= 4) return;
    const updated = [...names, name];
    setNames(updated);
    localStorage.setItem(`person_picker_names_${uid}`, JSON.stringify(updated));
    onNamesChange?.(updated);
    setNewName("");
  };

  const handleColorChange = (name: string, hex: string) => {
    const updated = { ...colors, [name]: hex };
    setColors(updated);
    saveColors(uid, updated);
    onNamesChange?.([...names]);
  };

  const handleDelete = (name: string) => {
    const updated = names.filter((n) => n !== name);
    setNames(updated);
    localStorage.setItem(`person_picker_names_${uid}`, JSON.stringify(updated));
    if (person === name) {
      localStorage.removeItem(`person_${uid}`);
      setPerson(null);
    }
    onNamesChange?.(updated);
  };

  const colorIndex = names.indexOf(person ?? "");
  const selectedColor = person
  ? getPersonColor(uid, person, names)
  : COLORS[colorIndex >= 0 ? colorIndex : 0].hex;

  if (!person) {
    return (
      <div className="flex flex-col gap-3">
        {names.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {names.map((name, i) => (
              <div key={name} className="flex items-center gap-1">
                <button
                  onClick={() => handlePick(name)}
                  className="rounded-xl border px-4 py-2 font-semibold text-white shadow-sm backdrop-blur transition hover:brightness-125"
                  style={{
                    backgroundColor: `${colors[name] ?? COLORS[i % COLORS.length].hex}80`,
                    borderColor: `${colors[name] ?? COLORS[i % COLORS.length].hex}aa`,
                  }}
                >
                  SOY {name.toUpperCase()}
                </button>
                <input
                  type="color"
                  value={colors[name] ?? COLORS[i % COLORS.length].hex}
                  onChange={(e) => handleColorChange(name, e.target.value)}
                  title={`Color de ${name}`}
                  className="h-8 w-8 cursor-pointer rounded-lg border border-white/20 bg-transparent p-0.5"
                />
                <button
                  onClick={() => handleDelete(name)}
                  className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs text-white/40 hover:bg-red-500/20 hover:text-red-300 transition"
                  title={`Eliminar ${name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {names.length < 4 && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Tu nombre..."
              maxLength={20}
              className="flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-white/30"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-40"
            >
              Añadir
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[340px] flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur sm:max-w-none sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className="shrink-0 rounded-full border px-3 py-1 text-sm font-semibold"
          style={{
            backgroundColor: `${selectedColor}33`,
            borderColor: `${selectedColor}99`,
            color: selectedColor,
          }}
        >
          {person.charAt(0).toUpperCase() + person.slice(1)}
        </span>

        <span className="text-sm leading-snug text-white/70">
          Se usará este color para marcar tus gastos.
        </span>
      </div>

      <button
        onClick={() => {
          localStorage.removeItem(`person_${uid}`);
          setPerson(null);
        }}
        className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 transition sm:w-auto"
      >
        Cambiar
      </button>
    </div>
  );
}
