"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import PersonPicker, { getPerson } from "@/components/PersonPicker";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  setDoc,
  collection,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";

type Person = "alba" | "alberto";

type Meta = {
  incomeP1: number; // Alba
  incomeP2: number; // Alberto
  carryFromPrev: number; // sobrante del mes anterior (manual por ahora)
  savingsSoFar: number; // ahorro acumulado total (solo informativo)


  // Ya lo tenías: lo tratamos como "ahorro apartado este mes"
  savingTarget: number;

  // NUEVO: objetivo mensual de ahorro (para progreso)
  savingsGoal: number;
};

type Tx = {
  id: string;
  date: string;
  category: string;
  concept: string;
  amount: number;
  person: Person;
  type: "expense";
};

const BUDGET_ID = "shared"; // luego lo hacemos configurable

const defaultMeta: Meta = {
  incomeP1: 0,
  incomeP2: 0,
  carryFromPrev: 0,
  savingTarget: 0,
  savingsSoFar: 0,
  savingsGoal: 0, // NUEVO
};

// Colores por categoría (fallback si no existe)
const CATEGORY_STYLES: Record<
  string,
  { card: string; badge: string; inner: string; dot: string }
> = {
  ocio: {
    card: "bg-blue-400/75 border-blue-100/90 ring-1 ring-blue-200/30 shadow-lg shadow-blue-500/15",
    badge: "bg-blue-500/45 border-blue-200/70 text-white",
    inner: "bg-black/20 border-white/20",
    dot: "bg-blue-500",
  },
  comida: {
    card: "bg-emerald-500/25 border-emerald-200/60 ring-1 ring-emerald-200/30 shadow-lg shadow-emerald-500/15",
    badge: "bg-emerald-500/45 border-emerald-200/70 text-white",
    inner: "bg-black/20 border-white/20",
    dot: "bg-emerald-400",
  },
  entretenimiento: {
    card: "bg-pink-500/35 border-pink-200/60 ring-1 ring-pink-200/30 shadow-lg shadow-pink-500/15",
    badge: "bg-pink-500/45 border-pink-200/70 text-white",
    inner: "bg-black/20 border-white/20",
    dot: "bg-pink-400",
  },
  alojamiento: {
    card: "bg-amber-500/35 border-amber-200/60 ring-1 ring-amber-200/30 shadow-lg shadow-amber-500/15",
    badge: "bg-amber-500/45 border-amber-200/70 text-white",
    inner: "bg-black/20 border-white/20",
    dot: "bg-amber-400",
  },
  transporte: {
    card: "bg-cyan-500/35 border-cyan-200/60 ring-1 ring-cyan-200/30 shadow-lg shadow-cyan-500/15",
    badge: "bg-cyan-500/45 border-cyan-200/70 text-white",
    inner: "bg-black/20 border-white/20",
    dot: "bg-cyan-400",
  },
  prestamos: {
    card: "bg-red-500/30 border-red-200/60 ring-1 ring-red-200/25 shadow-lg shadow-red-500/10",
    badge: "bg-red-500/40 border-red-200/70 text-white",
    inner: "bg-black/20 border-white/20",
    dot: "bg-red-400",
  },
  "cuidado personal": {
    card: "bg-fuchsia-500/25 border-fuchsia-200/60 ring-1 ring-fuchsia-200/25 shadow-lg shadow-fuchsia-500/10",
    badge: "bg-fuchsia-500/45 border-fuchsia-200/70 text-white",
    inner: "bg-black/20 border-white/20",
    dot: "bg-fuchsia-400",
  },
};

function colorForCategory(cat: string) {
  const key = (cat || "").trim().toLowerCase();
  const map: Record<string, string> = {
    ocio: "#60a5fa", // azul
    comida: "#34d399", // verde
    entretenimiento: "#f472b6", // rosa
    alojamiento: "#fbbf24", // amarillo
    transporte: "#22d3ee", // cyan
    prestamos: "#fb7185", // rojo
    "cuidado personal": "#e879f9", // fucsia
  };

  return map[key] ?? "#a78bfa"; // violeta por defecto
}

// Normaliza categorías tipo "Ocio" -> "ocio"
function catKey(raw: string) {
  return (raw || "").trim().toLowerCase();
}

function catStyle(cat: string) {
  const key = catKey(cat);
  return (
    CATEGORY_STYLES[key] ?? {
      card: "bg-white/6 border-white/12",
      badge: "bg-white/10 border-white/10 text-white/85",
      inner: "bg-black/10 border-white/10",
      dot: "bg-white/60",
    }
  );
}

export default function HomePage() {
  const [meta, setMeta] = useState<Meta>(defaultMeta);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [month, setMonth] = useState("2026-01");

  const [showAnalytics, setShowAnalytics] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterPerson, setFilterPerson] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // inputs para añadir gasto
  const [date, setDate] = useState(`${month}-01`);
  const [category, setCategory] = useState("ocio");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState<number>(0);

  // Reset de inputs al cambiar de mes (recomendado)
  useEffect(() => {
    setDate(`${month}-01`);
    setCategory("ocio");
    setConcept("");
    setAmount(0);
  }, [month]);

  // 1) Escuchar META en tiempo real
  useEffect(() => {
    const metaRef = doc(db, `budgets/${BUDGET_ID}/months/${month}/meta/main`);
    const unsub = onSnapshot(metaRef, async (snap) => {
      if (!snap.exists()) {
        await setDoc(metaRef, defaultMeta);
        setMeta(defaultMeta);
      } else {
        // IMPORTANTE: fusionamos con defaultMeta para que si falta savingsGoal no rompa
        const data = snap.data() as Partial<Meta>;
        setMeta({ ...defaultMeta, ...data });
      }
    });
    return () => unsub();
  }, [month]);

  // 2) Escuchar transacciones en tiempo real
  useEffect(() => {
    const colRef = collection(
      db,
      `budgets/${BUDGET_ID}/months/${month}/transactions`
    );
    const qy = query(colRef, orderBy("date", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as Omit<Tx, "id">;
        return {
          id: d.id,
          date: data.date,
          category: data.category,
          concept: data.concept,
          amount: data.amount,
          person: data.person,
          type: data.type,
        } as Tx;
      });
      setTxs(rows.filter((r) => r.type === "expense"));
    });
    return () => unsub();
  }, [month]);

  const totals = useMemo(() => {
    const incomeP1 = Number(meta.incomeP1) || 0;
    const incomeP2 = Number(meta.incomeP2) || 0;
    const carry = Number(meta.carryFromPrev) || 0;

    const saving = Number(meta.savingTarget) || 0; // ahorro apartado este mes
    const totalIncome = incomeP1 + incomeP2 + carry;

    // Disponible real (lo que queda para gastar) = ingresos - ahorro - gastos
    const totalExpenses = txs.reduce(
      (acc, t) => acc + (Number(t.amount) || 0),
      0
    );
    const available = totalIncome - saving;
    const saldoFinalMes = available - totalExpenses;

    // Progreso ahorro
    const goal = Number(meta.savingsGoal) || 0;
    const savingsProgress =
      goal > 0 ? Math.min(100, (saving / goal) * 100) : 0;

    // agrupación por categoría y concepto
    const byCat: Record<
      string,
      { total: number; byConcept: Record<string, Tx[]> }
    > = {};

    for (const t of txs) {
      byCat[t.category] ??= { total: 0, byConcept: {} };
      byCat[t.category].total += Number(t.amount) || 0;
      byCat[t.category].byConcept[t.concept] ??= [];
      byCat[t.category].byConcept[t.concept].push(t);
    }

    return {
      totalIncome,
      available,
      totalExpenses,
      saldoFinalMes,
      byCat,
      saving,
      goal,
      savingsProgress,
      savingsSoFar: Number(meta.savingsSoFar) || 0,
    };
  }, [meta, txs]);

  async function saveMeta(next: Meta) {
    const metaRef = doc(db, `budgets/${BUDGET_ID}/months/${month}/meta/main`);
    await setDoc(metaRef, next, { merge: true });
  }

  async function addExpense() {
    const person = getPerson();
    if (!person) {
      alert("Elige primero si eres Alba o Alberto.");
      return;
    }
    if (!concept.trim()) {
      alert("Pon un concepto (ej: cervezas).");
      return;
    }
    if (!category.trim()) {
      alert("Pon una categoría (ej: ocio).");
      return;
    }
    if (!amount || amount <= 0) {
      alert("Importe debe ser mayor que 0.");
      return;
    }

    const colRef = collection(
      db,
      `budgets/${BUDGET_ID}/months/${month}/transactions`
    );

    await addDoc(colRef, {
      type: "expense",
      date,
      category: category.trim().toLowerCase(),
      concept: concept.trim().toLowerCase(),
      amount: Number(amount),
      person,
      createdAt: serverTimestamp(),
    });

    setConcept("");
    setAmount(0);
  }

  async function deleteExpense(id: string) {
    const ref = doc(
      db,
      `budgets/${BUDGET_ID}/months/${month}/transactions/${id}`
    );
    await deleteDoc(ref);
  }

  const filteredTxs = useMemo(() => {
    return txs.filter((t) => {
      const okCat = filterCat === "all" || t.category === filterCat;
      const okPerson = filterPerson === "all" || t.person === filterPerson;
      const okSearch =
        !search.trim() ||
        t.concept.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase());
      return okCat && okPerson && okSearch;
    });
  }, [txs, filterCat, filterPerson, search]);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredTxs) {
      map.set(t.category, (map.get(t.category) ?? 0) + (Number(t.amount) || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTxs]);

  const barData = pieData; // mismo dataset, distinto gráfico

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* IZQUIERDA: icono + título juntos */}
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Logo"
                width={40}
                height={40}
                className="h-10 w-10 rounded-xl"
              />

              <h1 className="text-2xl font-bold tracking-tight">PRESUPUESTO</h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Selector de mes */}
              <label className="text-sm text-white/100"></label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-xl border border-white/100 bg-yellow-100/80 px-3 py-2 text-sm text-black font-semibold outline-none focus:ring-2 focus:ring-white/20"
              />

              {/* Ver gastos */}
              <button
                onClick={() => setShowAnalytics((v) => !v)}
                className="flex items-center gap-2 whitespace-nowrap rounded-2xl border border-cyan-300/80 bg-orange-400/50 px-4 py-2 text-sm shadow backdrop-blur"
              >
                {showAnalytics ? "Ocultar análisis" : "Ver análisis"}
              </button>

              {/* Chip disponible con color */}
              <div className="flex items-center gap-2 whitespace-nowrap rounded-2xl border border-cyan-300/80 bg-cyan-500/10 px-4 py-2 text-sm shadow backdrop-blur">
                <span className="text-white/70">Disponible:</span>
                <span className="text-green-400 font-bold text-base">
                  {totals.available.toFixed(2)} €
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6"></div>
          <PersonPicker />
        </div>

        {/* RESUMEN */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Card resumen inputs */}
          <div className="lg:col-span-2 rounded-3xl border border-white/80 bg-indigo-500/40 p-4 shadow-xl backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Resumen</h2>
              <span className="rounded-full border border-indigo-200/80 bg-blue-400/45 px-3 py-1 text-xs text-white/90">
                Ingresos / Ahorro
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* INGRESOS */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white/90">Ingresos</div>
                  <div className="text-xs text-white/60">
                    Total: <span className="font-semibold text-white">{totals.totalIncome.toFixed(2)} €</span>
                  </div>
                </div>

                <div className="grid gap-4">
                  <Field
                    label="Nómina Alba"
                    value={meta.incomeP1}
                    onChange={(v) => saveMeta({ ...meta, incomeP1: v })}
                    hint=""
                  />
                  <Field
                    label="Nómina Alberto"
                    value={meta.incomeP2}
                    onChange={(v) => saveMeta({ ...meta, incomeP2: v })}
                    hint=""
                  />
                  <Field
                    label="Sobrante mes anterior"
                    value={meta.carryFromPrev}
                    onChange={(v) => saveMeta({ ...meta, carryFromPrev: v })}
                    hint=""
                  />
                </div>
              </div>

              {/* AHORRO DEL MES */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white/90">Ahorro del mes</div>
                  <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs text-white/80">
                    {meta.savingsGoal > 0 ? `${Math.round(totals.savingsProgress)}%` : "Sin objetivo"}
                  </span>
                </div>

                <div className="grid gap-4">
                  <Field
                    label="Ahorro apartado"
                    value={meta.savingTarget}
                    onChange={(v) => saveMeta({ ...meta, savingTarget: v })}
                    hint=""
                  />
                  <Field
                    label="Objetivo del mes"
                    value={meta.savingsGoal}
                    onChange={(v) => saveMeta({ ...meta, savingsGoal: v })}
                    hint=""
                  />
                </div>

                {/* Progreso compact */
                }
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>Progreso</span>
                    <span className="text-white">
                      {totals.saving.toFixed(2)} / {totals.goal.toFixed(2)} €
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-2 bg-sky-400"
                      style={{ width: `${totals.savingsProgress}%` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[10, 20, 30].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          const goal = (totals.totalIncome * p) / 100;
                          saveMeta({ ...meta, savingsGoal: Number(goal.toFixed(2)) });
                        }}
                        className="rounded-xl border border-white/10 bg-white/10 py-2 text-[11px] font-semibold text-white hover:bg-white/15 transition"
                      >
                        {p}%
                      </button>
                    ))}
                  </div>

                  {totals.saving > totals.totalIncome && (
                    <div className="mt-2 text-xs text-red-200">
                      Ojo: el ahorro supera los ingresos.
                    </div>
                  )}
                </div>
              </div>

              {/* AHORRO ACUMULADO */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white/90">Ahorro acumulado</div>
                  <div className="text-xs text-white/60">Informativo</div>
                </div>

                <div className="text-3xl font-bold text-emerald-200">
                  {totals.savingsSoFar.toFixed(2)} €
                </div>

                <div className="mt-3">
                  <Field
                    label="Actualizar ahorro acumulado"
                    value={meta.savingsSoFar}
                    onChange={(v) => saveMeta({ ...meta, savingsSoFar: v })}
                    hint=""
                  />
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                  Consejo: aquí ponéis el total real que lleváis ahorrado (cuenta, hucha, etc.)
                </div>
              </div>
            </div>
          </div>

          {/* KPIs (cada tarjeta con su color) */}
          <div className="grid gap-4">
            {/* CAMBIO: ya no "ingresos + ahorros", ahora separado */}
            <Kpi
              title="Total ingresos"
              value={`${totals.totalIncome.toFixed(2)} €`}
              tone="cyan"
            />

            <Kpi
              title="Ahorro apartado"
              value={`${totals.saving.toFixed(2)} €`}
              sub={
                totals.goal > 0
                  ? `Objetivo: ${totals.goal.toFixed(2)} € · ${Math.round(
                      totals.savingsProgress
                    )}%`
                  : "Sin objetivo"
              }
              progress={totals.goal > 0 ? totals.savingsProgress : undefined}
              tone="indigo"
            />

            <Kpi
              title="Ahorro acumulado"
              value={`${totals.savingsSoFar.toFixed(2)} €`}
              sub="Solo informativo"
              tone="emerald"
            />

            <Kpi
              title="Total gastos"
              value={`${totals.totalExpenses.toFixed(2)} €`}
              tone="rose"
            />

            <Kpi
              title="Saldo final del mes"
              value={`${totals.saldoFinalMes.toFixed(2)} €`}
              accent
              tone="cyan"
            />
          </div>
        </div>

        {/* AÑADIR GASTO */}
        <div className="mt-6 rounded-3xl border border-purple-100/90 bg-gradient-to-br from-purple-600/55 to-blue-400/15 p-4 shadow-xl backdrop-blur">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Añadir gasto</h2>
            <span className="text-xs text-white/80">
              Consejo: usa categorías consistentes (ocio, compras, vivienda…)
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Fecha"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Input
              label="Categoría"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="ocio"
            />
            <Input
              label="Concepto"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="cervezas"
            />
            <Input
              label="Importe (€)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>

          <div className="mt-4 flex items-center justify-end">
            <button
              onClick={addExpense}
              className="rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-400 px-4 py-2 font-bold text-black shadow-lg shadow-emerald-500/20 hover:opacity-90 transition"
            >
              Añadir gasto
            </button>
          </div>
        </div>

        {/* ANÁLISIS GASTOS */}
        {showAnalytics && (
          <AnalyticsPanel
            month={month}
            categories={Array.from(new Set(txs.map((t) => t.category))).sort()}
            filterCat={filterCat}
            setFilterCat={setFilterCat}
            filterPerson={filterPerson}
            setFilterPerson={setFilterPerson}
            search={search}
            setSearch={setSearch}
            filteredTxs={filteredTxs}
            selectedCat={selectedCat}
            setSelectedCat={setSelectedCat}
            pieData={pieData}
            barData={barData}
          />
        )}

        {/* CATEGORÍAS */}
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-extrabold">Gastos por categorías</h2>

          {Object.keys(totals.byCat).length === 0 ? (
            <div className="rounded-2xl border border-white/90 bg-white/50 p-5 text-black/70 backdrop-blur">
              No hay gastos todavía.
            </div>
          ) : (
            <div className="grid gap-4">
              {Object.entries(totals.byCat).map(([cat, info]) => {
                const s = catStyle(cat);
                return (
                  <div
                    key={cat}
                    className={`rounded-3xl border p-4 shadow backdrop-blur ${s.card}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                        <div className="text-base font-semibold capitalize">
                          {cat}
                        </div>
                      </div>
                      <div
                        className={`rounded-full border px-3 py-1 text-sm ${s.badge}`}
                      >
                        {info.total.toFixed(2)} €
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {Object.entries(info.byConcept).map(([cpt, items]) => (
                        <div
                          key={cpt}
                          className={`rounded-2xl border p-4 ${s.inner}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium capitalize">
                              {cpt}{" "}
                              <span className="text-white/50 text-sm">
                                ({items.length})
                              </span>
                            </div>
                          </div>

                          <ul className="mt-2 space-y-2">
                            {items.map((it) => (
                              <li
                                key={it.id}
                                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                              >
                                <span className="text-sm text-white/80">
                                  {it.date}
                                </span>

                                <span className="text-sm font-semibold">
                                  {it.amount.toFixed(2)} €
                                </span>

                                <span
                                  className={`text-xs font-semibold ${
                                    it.person === "alba"
                                      ? "text-blue-400"
                                      : "text-green-400"
                                  }`}
                                >
                                  {it.person}
                                </span>

                                <button
                                  onClick={() => {
                                    if (confirm("¿Borrar gasto?")) {
                                      deleteExpense(it.id);
                                    }
                                  }}
                                  className="ml-auto rounded-lg border border-red-400/90 bg-red-500/50 px-3 py-1 text-xs text-red-100 hover:bg-red-500/90 transition"
                                >
                                  BORRAR
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  sub,
  progress,
  accent,
  tone = "neutral",
}: {
  title: string;
  value: string;
  sub?: string;
  progress?: number;
  accent?: boolean;
  tone?: "neutral" | "emerald" | "rose" | "cyan" | "indigo";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200/20 bg-emerald-500/10"
      : tone === "rose"
      ? "border-rose-200/20 bg-rose-500/10"
      : tone === "cyan"
      ? "border-cyan-200/20 bg-cyan-500/10"
      : tone === "indigo"
      ? "border-indigo-200/20 bg-indigo-500/10"
      : "border-white/10 bg-white/5";

  return (
    <div
      className={`rounded-3xl border p-4 shadow backdrop-blur ${toneClass} ${
        accent ? "ring-1 ring-white/20" : ""
      }`}
    >
      <div className="text-sm text-white/70">{title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>

      {sub ? <div className="mt-2 text-xs text-white/70">{sub}</div> : null}

      {typeof progress === "number" ? (
        <div className="mt-3 h-2 w-full rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-2 bg-white/70"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <label className="text-sm text-white/80">{label}</label>
        {hint ? <span className="text-xs text-white/40">{hint}</span> : null}
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-white/20"
      />
    </div>
  );
}

function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-sm text-white/80">{label}</span>
      <input
        {...props}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-white/20"
      />
    </label>
  );
}

function AnalyticsPanel({
  month,
  categories,
  filterCat,
  setFilterCat,
  filterPerson,
  setFilterPerson,
  search,
  setSearch,
  filteredTxs,
  pieData,
  barData,
  selectedCat,
  setSelectedCat,
}: {
  month: string;
  categories: string[];
  filterCat: string;
  setFilterCat: (v: string) => void;
  filterPerson: string;
  setFilterPerson: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  filteredTxs: Tx[];
  pieData: { name: string; value: number }[];
  barData: { name: string; value: number }[];
  selectedCat: string | null;
  setSelectedCat: (v: string | null) => void;
}) {
  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Análisis</div>
          <div className="text-sm text-white/60">Mes: {month}</div>
        </div>

        <div className="text-sm text-white/70">
          Movimientos:{" "}
          <span className="font-semibold text-white">{filteredTxs.length}</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-white/80">
          Categoría
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
          >
            <option value="all">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-white/80">
          Persona
          <select
            value={filterPerson}
            onChange={(e) => setFilterPerson(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
          >
            <option value="all">Ambos</option>
            <option value="alba">Alba</option>
            <option value="alberto">Alberto</option>
          </select>
        </label>

        <label className="text-sm text-white/80">
          Buscar (concepto)
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="cervezas, gasolina..."
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white placeholder-white/40 outline-none"
          />
        </label>
      </div>

      {/* Gráficas */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Donut */}
        <div className="rounded-3xl border border-white/100 bg-rose-300/50 p-4">
          <div className="mb-2 text-sm font-semibold text-white/80">
            Distribución por categoría
          </div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  onClick={(data) => {
                    // data.name es la categoría
                    setSelectedCat(String(data?.name ?? ""));
                  }}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={colorForCategory(entry.name)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | undefined) => [
                    `${(value ?? 0).toFixed(2)} €`,
                    "Gasto",
                  ]}
                  contentStyle={{
                    backgroundColor: "rgba(150,2000,10,0.9)",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "white",
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Barras */}
        <div className="rounded-3xl border border-white/100 bg-yellow-200/70 p-4">
          <div className="mb-2 text-sm font-bold text-white/80">
            Gastos por categoría
          </div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.8)" }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.8)" }} />
                <Tooltip
                  formatter={(value: number | string | undefined) =>
                    `${Number(value ?? 0).toFixed(2)} €`
                  }
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.92)",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "white",
                  }}
                />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {barData.map((entry) => (
                    <Cell key={entry.name} fill={colorForCategory(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lista filtrada */}
      <div className="mt-5 rounded-3xl border border-white/10 bg-purple-500/20 p-4">
        <div className="mb-2 text-sm font-bold text-white/100">
          Movimientos filtrados
        </div>
        {filteredTxs.length === 0 ? (
          <div className="text-white/60">No hay resultados.</div>
        ) : (
          <div className="space-y-2">
            {filteredTxs.slice(0, 20).map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/100 bg-white/5 px-3 py-2"
              >
                <div className="text-sm text-white/100">
                  {t.date} · <span className="font-bold">{t.category}</span> ·{" "}
                  {t.concept}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold">
                    {t.amount.toFixed(2)} €
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      t.person === "alba" ? "text-blue-500" : "text-orange-500"
                    }`}
                  >
                    {t.person}
                  </div>
                </div>
              </div>
            ))}
            {filteredTxs.length > 20 && (
              <div className="text-xs text-white/50">
                Mostrando 20 de {filteredTxs.length}. (Luego lo hacemos paginado)
              </div>
            )}
          </div>
        )}
      </div>

      {selectedCat && (
        <CategoryModal
          category={selectedCat}
          onClose={() => setSelectedCat(null)}
          items={filteredTxs.filter((t) => t.category === selectedCat)}
        />
      )}
    </div>
  );
}

function CategoryModal({
  category,
  items,
  onClose,
}: {
  category: string;
  items: Tx[];
  onClose: () => void;
}) {
  const total = items.reduce((a, t) => a + (Number(t.amount) || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Fondo oscuro */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Caja */}
      <div
        className="relative w-full max-w-2xl rounded-3xl border border-white/15 bg-[#0b1020]/90 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-white/60">Categoría</div>
            <div className="text-xl font-bold capitalize">{category}</div>
            <div className="mt-1 text-sm text-white/70">
              {items.length} movimientos ·{" "}
              <span className="font-semibold text-white">
                {total.toFixed(2)} €
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 transition"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-auto space-y-2 pr-1">
          {items.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="text-sm text-white/80">
                <span className="text-white/60">{t.date}</span> ·{" "}
                <span className="font-semibold capitalize">{t.concept}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-sm font-bold">{t.amount.toFixed(2)} €</div>
                <div
                  className={`text-xs font-semibold ${
                    t.person === "alba" ? "text-blue-200" : "text-orange-200"
                  }`}
                >
                  {t.person}
                </div>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-white/60">
              No hay movimientos en esta categoría.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
