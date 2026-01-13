"use client";

import { useState } from "react";

type Person = "ALBA" | "ALBERTO";

export function getPerson(): Person | null {
  if (typeof window === "undefined") return null;
  const p = localStorage.getItem("person");
  if (p === "ALBA" || p === "ALBERTO") return p;
  return null;
}

export default function PersonPicker() {
  const [person, setPerson] = useState<Person | null>(() => getPerson());

  const choose = (p: Person) => {
    localStorage.setItem("person", p);
    setPerson(p);
  };

  const badge =
    person === "ALBA"
      ? "bg-blue-500/20 text-blue-200 border-blue-400/30"
      : "bg-green-500/20 text-green-200 border-green-400/30";

  if (!person) {
    return (
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => choose("ALBA")}
          className="rounded-xl border border-blue-400/30 bg-blue-700/50 px-4 py-2 text-blue-100 font-semibold shadow-sm backdrop-blur hover:bg-blue-500/20 transition"
        >
          SOY ALBA
        </button>
        <button
          onClick={() => choose("ALBERTO")}
          className="rounded-xl border border-green-300/90 bg-green-500/50 px-4 py-2 text-green-200 font-semibold shadow-sm backdrop-blur hover:bg-green-400/20 transition"
        >
          SOY ALBERTO
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
      <div className="flex items-center gap-3">
        <span className={`rounded-full border px-3 py-1 text-sm ${badge}`}>
          {person === "ALBA" ? "Alba" : "Alberto"}
        </span>
        <span className="text-sm text-white/70">
          Se usará este color para marcar tus gastos.
        </span>
      </div>

      <button
        onClick={() => {
          localStorage.removeItem("person");
          setPerson(null);
        }}
        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15 transition"
      >
        Cambiar
      </button>
    </div>
  );
}
