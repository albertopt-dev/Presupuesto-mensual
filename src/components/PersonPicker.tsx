"use client";

import { useState } from "react";

const COLORS = [
  {
    button: "border-blue-400/30 bg-blue-700/50 text-blue-100 hover:bg-blue-500/20",
    badge: "bg-blue-500/20 text-blue-200 border-blue-400/30",
  },
  {
    button: "border-green-300/50 bg-green-600/50 text-green-100 hover:bg-green-500/20",
    badge: "bg-green-500/20 text-green-200 border-green-400/30",
  },
  {
    button: "border-orange-400/30 bg-orange-600/50 text-orange-100 hover:bg-orange-500/20",
    badge: "bg-orange-500/20 text-orange-200 border-orange-400/30",
  },
  {
    button: "border-purple-400/30 bg-purple-600/50 text-purple-100 hover:bg-purple-500/20",
    badge: "bg-purple-500/20 text-purple-200 border-purple-400/30",
  },
];

function loadNames(uid: string): string[] {
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

export default function PersonPicker({ uid }: { uid: string }) {
  const [names, setNames] = useState<string[]>(() => loadNames(uid));
  const [person, setPerson] = useState<string | null>(() => getPerson(uid));
  const [newName, setNewName] = useState("");

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
    setNewName("");
  };

  const colorIndex = names.indexOf(person ?? "");
  const badge = COLORS[colorIndex >= 0 ? colorIndex : 0].badge;

  if (!person) {
    return (
      <div className="flex flex-col gap-3">
        {names.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {names.map((name, i) => (
              <button
                key={name}
                onClick={() => handlePick(name)}
                className={`rounded-xl border px-4 py-2 font-semibold shadow-sm backdrop-blur transition ${COLORS[i % COLORS.length].button}`}
              >
                SOY {name.toUpperCase()}
              </button>
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
      <div className="flex items-center gap-3">
        <span className={`rounded-full border px-3 py-1 text-sm ${badge}`}>
          {person.charAt(0).toUpperCase() + person.slice(1)}
        </span>
        <span className="text-sm text-white/70">
          Se usará este color para marcar tus gastos.
        </span>
      </div>

      <button
        onClick={() => {
          localStorage.removeItem(`person_${uid}`);
          setPerson(null);
        }}
        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15 transition"
      >
        Cambiar
      </button>
    </div>
  );
}
