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
  savingsSoFar: number; // ahorro acumulado total (solo informativo)

  // Ya lo tenías: lo tratamos como "ahorro apartado este mes"
  savingTarget: number;

  // NUEVO: objetivo mensual de ahorro (para progreso)
  savingsGoal: number;

  // NUEVO: ahorro extra del mes
  extraSavings: number;
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
  savingTarget: 0,
  savingsSoFar: 0,
  savingsGoal: 0, // NUEVO
  extraSavings: 0, // NUEVO
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
  "gastos fijos": {
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
  casa: {
    card: "bg-orange-500/35 border-orange-200/60 ring-1 ring-orange-200/30 shadow-lg shadow-orange-500/15",
    badge: "bg-orange-500/45 border-orange-200/70 text-white",
    inner: "bg-black/20 border-white/20",
    dot: "bg-orange-400",
  },
  compras: {
    card: "bg-purple-500/35 border-purple-200/60 ring-1 ring-purple-200/30 shadow-lg shadow-purple-500/15",
    badge: "bg-purple-500/45 border-purple-200/70 text-white",
    inner: "bg-black/20 border-white/20",
    dot: "bg-purple-400",
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
    "gastos fijos": "#fb7185", // rojo
    "cuidado personal": "#e879f9", // fucsia
    casa: "#fb923c", // naranja
    compras: "#a855f7", // púrpura
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
  // Obtener mes actual automáticamente
  const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const result = `${year}-${month}`;
    console.log('📅 Mes actual detectado:', result);
    return result;
  };
  const [month, setMonth] = useState(getCurrentMonth());

  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterPerson, setFilterPerson] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Función para obtener fecha actual en formato YYYY-MM-DD
  const getCurrentDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // inputs para añadir gasto
  const [date, setDate] = useState(getCurrentDate());
  const [category, setCategory] = useState("comida");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState<string>(""); // Cambiar a string vacío

  // Reset de inputs al cambiar de mes (recomendado)
  useEffect(() => {
    setDate(getCurrentDate()); // Usar fecha actual en lugar del día 1
    setCategory("comida"); // Cambiar categoría por defecto
    setConcept("");
    setAmount(""); // Cambiar a string vacío
  }, [month]);

  // Función para manejar entrada de importe con coma/punto
  const handleAmountChange = (value: string) => {
    // Reemplazar coma por punto para decimales
    const normalizedValue = value.replace(',', '.');
    setAmount(normalizedValue);
  };

  // Opciones de categorías disponibles
  const CATEGORY_OPTIONS = [
    "comida",
    "ocio",
    "entretenimiento",
    "gastos fijos", 
    "casa",
    "transporte",
    "compras",
    "cuidado personal"
  ];

  // 1) Escuchar META en tiempo real
  useEffect(() => {
    console.log('🔥 Firebase path:', `budgets/${BUDGET_ID}/months/${month}/meta/main`);
    const metaRef = doc(db, `budgets/${BUDGET_ID}/months/${month}/meta/main`);
    const unsub = onSnapshot(metaRef, async (snap) => {
      if (!snap.exists()) {
        console.log('⚠️ No hay datos meta para este mes, creando defaults...');
        await setDoc(metaRef, defaultMeta);
        setMeta(defaultMeta);
      } else {
        const data = snap.data() as Partial<Meta>;
        console.log('✅ Meta cargada:', data);
        setMeta({ ...defaultMeta, ...data });
      }
    });
    return () => unsub();
  }, [month]);

  // 2) Escuchar TRANSACCIONES en tiempo real
  useEffect(() => {
    console.log('🔥 Firebase transactions path:', `budgets/${BUDGET_ID}/months/${month}/transactions`);
    const colRef = collection(
      db,
      `budgets/${BUDGET_ID}/months/${month}/transactions`
    );
    const qy = query(colRef, orderBy("date", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
      console.log(`📊 Transacciones encontradas: ${snap.docs.length}`);
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
      const expenses = rows.filter((r) => r.type === "expense");
      console.log(`💸 Gastos filtrados: ${expenses.length}`, expenses);
      setTxs(expenses);
    });
    return () => unsub();
  }, [month]);

  const totals = useMemo(() => {
    const incomeP1 = Number(meta.incomeP1) || 0;
    const incomeP2 = Number(meta.incomeP2) || 0;

    const saving = Number(meta.savingTarget) || 0; // ahorro programado este mes
    const extraSaving = Number(meta.extraSavings) || 0; // ahorro extra este mes
    const totalSavingThisMonth = saving + extraSaving; // total ahorro mes actual
    const totalIncome = incomeP1 + incomeP2;

    // Disponible real (lo que queda para gastar) = ingresos - ahorro total - gastos
    const totalExpenses = txs.reduce(
      (acc, t) => acc + (Number(t.amount) || 0),
      0
    );
    const available = totalIncome - totalSavingThisMonth;
    const saldoFinalMes = available - totalExpenses; // puede ser negativo si gastas más de lo disponible

    // Progreso ahorro
    const goal = Number(meta.savingsGoal) || 0;
    const savingsProgress =
      goal > 0 ? Math.min(100, (totalSavingThisMonth / goal) * 100) : 0;

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
      extraSaving,
      totalSavingThisMonth,
      goal,
      savingsProgress,
      savingsSoFar: Number(meta.savingsSoFar) || 0,
    };
  }, [meta, txs]);

  async function saveMeta(next: Meta) {
    const metaRef = doc(db, `budgets/${BUDGET_ID}/months/${month}/meta/main`);
    await setDoc(metaRef, next, { merge: true });
  }

  // NUEVA FUNCIONALIDAD: Consolidar ahorro del mes
  async function consolidateMonthSavings() {
    const totalSavingsThisMonth = (Number(meta.savingTarget) || 0) + (Number(meta.extraSavings) || 0);
    
    if (totalSavingsThisMonth <= 0) {
      alert("No hay ahorro del mes para consolidar.");
      return;
    }

    const confirmMessage = `¿Consolidar ${totalSavingsThisMonth.toFixed(2)}€ del mes actual al ahorro total?\n\nEsto sumará el ahorro de este mes al total acumulado y lo reseteará para el próximo mes.`;
    
    if (confirm(confirmMessage)) {
      const newTotal = (Number(meta.savingsSoFar) || 0) + totalSavingsThisMonth;
      await saveMeta({ 
        ...meta, 
        savingsSoFar: newTotal,
        savingTarget: 0, // Resetear ahorro programado
        extraSavings: 0, // Resetear ahorro extra
      });
      alert(`¡Éxito! Ahorro consolidado: ${totalSavingsThisMonth.toFixed(2)}€\nNuevo total acumulado: ${newTotal.toFixed(2)}€`);
    }
  }

  // NUEVA FUNCIONALIDAD: Añadir ahorro extra rápido
  async function addQuickSavings(amount: number) {
    const currentExtra = Number(meta.extraSavings) || 0;
    await saveMeta({ 
      ...meta, 
      extraSavings: currentExtra + amount
    });
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
    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (!amount.trim() || isNaN(numericAmount) || numericAmount <= 0) {
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
      amount: parseFloat(amount.replace(',', '.')),
      person,
      createdAt: serverTimestamp(),
    });

    setConcept("");
    setAmount("");
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
              <h1 className="text-2xl font-bold text-white">Presupuesto</h1>
            </div>

            {/* DERECHA: controles */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Selector de mes */}
              <input
                type="month"
                value={month}
                onChange={(e) => {
                  console.log('🗓️ Cambiando mes a:', e.target.value);
                  setMonth(e.target.value);
                }}
                className="rounded-xl border border-white/100 bg-yellow-100/80 px-3 py-2 text-sm text-black font-semibold outline-none focus:ring-2 focus:ring-white/20"
              />

              {/* Chip disponible con color */}
              <div className="hidden sm:flex items-center gap-2 whitespace-nowrap rounded-2xl border border-cyan-300/80 bg-cyan-500/10 px-4 py-2 text-sm shadow backdrop-blur">
                <span className="text-white/70">Para gastar:</span>
                <span className={`font-bold text-base ${
                  totals.saldoFinalMes >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {totals.saldoFinalMes.toFixed(2)} €
                </span>
              </div>
              
              {/* Botón forzar actualización - separado a la derecha */}
              <div className="ml-auto flex flex-col items-center gap-1">
                <button
                  onClick={() => {
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(registrations => {
                        registrations.forEach(registration => {
                          registration.unregister();
                        });
                      });
                      caches.keys().then(names => {
                        names.forEach(name => {
                          caches.delete(name);
                        });
                      });
                      setTimeout(() => {
                        window.location.reload();
                      }, 100);
                    }
                  }}
                  className="rounded-xl border border-orange-400/50 bg-orange-500/20 px-3 py-2 text-xs font-bold text-orange-200 hover:bg-orange-500/30 transition"
                  title="Forzar actualización de la app"
                >
                  🔄
                </button>
                <span className="text-xs text-white/60 hidden sm:block">Actualizar</span>
              </div>
            </div>
          </div>

          <div className="mt-6"></div>
          <PersonPicker />
        </div>

        {/* RESUMEN */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Card resumen inputs */}
          <div className="lg:col-span-2 rounded-3xl border border-white/80 bg-indigo-500/40 p-4 shadow-xl backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Resumen</h2>
              <span className="rounded-full border border-indigo-200/80 bg-blue-400/45 px-3 py-1 text-xs text-white/90">
                Ingresos / Ahorro
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* INGRESOS */}
              <div className="rounded-3xl border border-emerald-200/20 bg-gradient-to-br from-emerald-500/10 to-green-400/5 p-6 backdrop-blur">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-500/20 p-2 text-xl">
                    💵
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Ingresos</h3>
                    <p className="text-sm text-emerald-200">{totals.totalIncome.toFixed(2)} € este mes</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="group">
                    <label className="block text-sm font-medium text-white/90 mb-2">👩‍💼 Alba</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={meta.incomeP1}
                        onChange={(e) => saveMeta({ ...meta, incomeP1: Number(e.target.value) })}
                        className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white placeholder-white/50 outline-none focus:border-emerald-400/50 focus:bg-black/40 focus:ring-2 focus:ring-emerald-400/20 transition-all"
                        placeholder="Nómina..."
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 text-sm">€</span>
                    </div>
                  </div>
                  
                  <div className="group">
                    <label className="block text-sm font-medium text-white/90 mb-2">👨‍💻 Alberto</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={meta.incomeP2}
                        onChange={(e) => saveMeta({ ...meta, incomeP2: Number(e.target.value) })}
                        className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white placeholder-white/50 outline-none focus:border-emerald-400/50 focus:bg-black/40 focus:ring-2 focus:ring-emerald-400/20 transition-all"
                        placeholder="Nómina..."
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 text-sm">€</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AHORRO */}
              <div className="rounded-3xl border border-indigo-200/20 bg-gradient-to-br from-indigo-500/10 to-purple-400/5 p-6 backdrop-blur">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-indigo-500/20 p-2">
                    🎯
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">Ahorro del mes</h3>
                    <p className="text-sm text-indigo-200">
                      {totals.totalSavingThisMonth.toFixed(2)} € de {totals.goal > 0 ? totals.goal.toFixed(2) : '--'} €
                    </p>
                  </div>
                  {totals.goal > 0 && (
                    <div className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-200">
                      {Math.round(totals.savingsProgress)}%
                    </div>
                  )}
                </div>

                {/* Barra de progreso prominente */}
                {totals.goal > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between text-xs text-white/70 mb-2">
                      <span>Progreso del objetivo</span>
                      <span>{totals.totalSavingThisMonth.toFixed(2)} / {totals.goal.toFixed(2)} €</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(totals.savingsProgress, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">📦 Programado</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={meta.savingTarget}
                          onChange={(e) => saveMeta({ ...meta, savingTarget: Number(e.target.value) })}
                          className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white text-sm placeholder-white/50 outline-none focus:border-indigo-400/50 focus:bg-black/40 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                          placeholder="500..."
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 text-xs">€</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">✨ Extra</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={meta.extraSavings}
                          onChange={(e) => saveMeta({ ...meta, extraSavings: Number(e.target.value) })}
                          className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white text-sm placeholder-white/50 outline-none focus:border-purple-400/50 focus:bg-black/40 focus:ring-2 focus:ring-purple-400/20 transition-all"
                          placeholder="0..."
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 text-xs">€</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">🎥 Objetivo</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={meta.savingsGoal}
                        onChange={(e) => saveMeta({ ...meta, savingsGoal: Number(e.target.value) })}
                        className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white placeholder-white/50 outline-none focus:border-indigo-400/50 focus:bg-black/40 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                        placeholder="Meta mensual..."
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 text-sm">€</span>
                    </div>
                  </div>

                  {/* Botones de acción mejorados */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[10, 20, 30].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          const goal = (totals.totalIncome * p) / 100;
                          saveMeta({ ...meta, savingsGoal: Number(goal.toFixed(2)) });
                        }}
                        className="rounded-lg bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 py-2 text-xs font-bold text-indigo-200 hover:from-indigo-500/30 hover:to-purple-500/30 hover:border-indigo-400/50 transition-all duration-200"
                      >
                        {p}%
                      </button>
                    ))}
                  </div>

                  {/* Acciones rápidas */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={consolidateMonthSavings}
                      className="col-span-1 rounded-lg bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-400/30 py-2.5 px-3 text-xs font-bold text-emerald-200 hover:from-emerald-500/30 hover:to-green-500/30 hover:border-emerald-400/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={totals.totalSavingThisMonth <= 0}
                    >
                      📦 Consolidar
                    </button>
                    <button
                      onClick={() => addQuickSavings(50)}
                      className="rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 py-2.5 text-xs font-bold text-blue-200 hover:from-blue-500/30 hover:to-cyan-500/30 hover:border-blue-400/50 transition-all duration-200"
                    >
                      +50€
                    </button>
                    <button
                      onClick={() => addQuickSavings(100)}
                      className="rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 py-2.5 text-xs font-bold text-blue-200 hover:from-blue-500/30 hover:to-cyan-500/30 hover:border-blue-400/50 transition-all duration-200"
                    >
                      +100€
                    </button>
                  </div>

                  {totals.totalSavingThisMonth > totals.totalIncome && (
                    <div className="rounded-lg bg-red-500/10 border border-red-400/30 p-3 text-center">
                      <span className="text-xs text-red-200 font-medium">
                        ⚠️ El ahorro supera los ingresos
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            

            {/* AHORRO ACUMULADO - Sección especial */}
            <div className="mt-6 rounded-3xl border border-amber-200/20 bg-gradient-to-br from-amber-500/10 to-orange-400/5 p-6 backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-amber-500/20 p-3">
                    🏆
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Ahorro total acumulado</h3>
                    <p className="text-amber-200 text-sm">Tu progreso de ahorro a largo plazo</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-amber-200">
                    {totals.savingsSoFar.toFixed(2)} €
                  </div>
                  <span className="text-xs text-amber-300/70">Acumulado</span>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-white/90 mb-2">💰 Actualizar total real</label>
                <div className="relative">
                  <input
                    type="number"
                    value={meta.savingsSoFar}
                    onChange={(e) => saveMeta({ ...meta, savingsSoFar: Number(e.target.value) })}
                    className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white placeholder-white/50 outline-none focus:border-amber-400/50 focus:bg-black/40 focus:ring-2 focus:ring-amber-400/20 transition-all"
                    placeholder="Total en tu cuenta/hucha..."
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 text-sm">€</span>
                </div>
                <p className="text-xs text-amber-300/70 mt-2">
                  💡 Actualiza esto con el dinero real que tienes ahorrado
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RESUMEN FINANCIERO - Diseño mejorado */}
        <div className="mt-12">
          <div className="grid gap-5 lg:grid-cols-3 mb-5">
              {/* INGRESOS */}
              <div className="group relative overflow-hidden rounded-3xl border border-cyan-200/30 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-cyan-400/5 p-4 sm:p-7 shadow-xl backdrop-blur transition-all hover:shadow-2xl hover:shadow-cyan-500/20 min-h-[160px] sm:min-h-[200px] flex flex-col">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="relative flex-1 flex flex-col">
                  <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-3">
                    <div className="rounded-xl bg-cyan-500/30 p-2 sm:p-3 text-2xl sm:text-3xl backdrop-blur flex-shrink-0">
                      💰
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-cyan-200/90 mb-1">Total ingresos</div>
                      <div className="text-2xl sm:text-4xl font-bold text-white tracking-tight truncate">
                        {totals.totalIncome.toFixed(2)} €
                      </div>
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-cyan-200/80 mt-auto">
                    💼 Nóminas del mes
                  </div>
                </div>
              </div>

              {/* TOTAL GASTOS */}
              <div className="group relative overflow-hidden rounded-3xl border border-rose-200/30 bg-gradient-to-br from-rose-500/20 via-red-500/10 to-rose-400/5 p-4 sm:p-7 shadow-xl backdrop-blur transition-all hover:shadow-2xl hover:shadow-rose-500/20 min-h-[160px] sm:min-h-[200px] flex flex-col">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 rounded-full bg-rose-400/10 blur-3xl" />
                <div className="relative flex-1 flex flex-col">
                  <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-3">
                    <div className="rounded-xl bg-rose-500/30 p-2 sm:p-3 text-2xl sm:text-3xl backdrop-blur flex-shrink-0">
                      💸
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-rose-200/90 mb-1">Total gastos</div>
                      <div className="text-2xl sm:text-4xl font-bold text-white tracking-tight truncate">
                        {totals.totalExpenses.toFixed(2)} €
                      </div>
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-rose-200/80 leading-relaxed mt-auto">
                    🛍️ Gastos del mes
                  </div>
                </div>
              </div>

              {/* DISPONIBLE PARA GASTAR */}
              <div className="group relative overflow-hidden rounded-3xl border border-violet-200/30 bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-fuchsia-500/15 p-4 sm:p-7 shadow-xl backdrop-blur transition-all hover:shadow-2xl hover:shadow-violet-500/20 min-h-[160px] sm:min-h-[200px] flex flex-col">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 rounded-full bg-violet-400/10 blur-3xl" />
                <div className="relative flex-1 flex flex-col">
                  <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-3">
                    <div className="rounded-xl bg-violet-500/30 p-2 sm:p-3 text-2xl sm:text-3xl backdrop-blur flex-shrink-0">
                      💳
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-violet-200/90 mb-1 truncate">Disponible para gastar</div>
                      <div className={`text-2xl sm:text-4xl font-bold tracking-tight truncate ${
                        totals.saldoFinalMes >= 0 ? 'text-white' : 'text-red-300'
                      }`}>
                        {totals.saldoFinalMes.toFixed(2)} €
                      </div>
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-violet-200/80 leading-relaxed mt-auto space-y-1">
                    <div className="truncate">💰 Ingresos: {totals.totalIncome.toFixed(2)}€</div>
                    <div className="truncate">🎯 Ahorro: -{totals.totalSavingThisMonth.toFixed(2)}€</div>
                    <div className="truncate">💸 Gastado: -{totals.totalExpenses.toFixed(2)}€</div>
                  </div>
                </div>
              </div>

              {/* AHORRO DEL MES */}
              <div className="group relative overflow-hidden rounded-3xl border border-indigo-200/30 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-indigo-400/5 p-4 sm:p-7 shadow-xl backdrop-blur transition-all hover:shadow-2xl hover:shadow-indigo-500/20 min-h-[160px] sm:min-h-[200px] flex flex-col">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 rounded-full bg-indigo-400/10 blur-3xl" />
                <div className="relative flex-1 flex flex-col">
                  <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-3">
                    <div className="rounded-xl bg-indigo-500/30 p-2 sm:p-3 text-2xl sm:text-3xl backdrop-blur flex-shrink-0">
                      🎯
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-indigo-200/90 mb-1">Ahorro del mes</div>
                      <div className="text-2xl sm:text-4xl font-bold text-white tracking-tight truncate">
                        {totals.totalSavingThisMonth.toFixed(2)} €
                      </div>
                    </div>
                  </div>
                  {totals.goal > 0 ? (
                    <div className="mt-auto">
                      <div className="text-xs sm:text-sm text-indigo-200/80 mb-2 leading-relaxed truncate">
                        Objetivo: {totals.goal.toFixed(2)} € · {Math.round(totals.savingsProgress)}%
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(totals.savingsProgress, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm text-indigo-200/80 leading-relaxed mt-auto">
                      💾 Programado: {totals.saving.toFixed(2)}€<br/>
                      ✨ Extra: {totals.extraSaving.toFixed(2)}€
                    </div>
                  )}
                </div>
              </div>

              {/* AHORRO ACUMULADO */}
              <div className="group relative overflow-hidden rounded-3xl border border-amber-200/30 bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-amber-400/5 p-4 sm:p-7 shadow-xl backdrop-blur transition-all hover:shadow-2xl hover:shadow-amber-500/20 min-h-[160px] sm:min-h-[200px] flex flex-col">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
                <div className="relative flex-1 flex flex-col">
                  <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-3">
                    <div className="rounded-xl bg-amber-500/30 p-2 sm:p-3 text-2xl sm:text-3xl backdrop-blur flex-shrink-0">
                      🏆
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-amber-200/90 mb-1">Ahorro acumulado</div>
                      <div className="text-2xl sm:text-4xl font-bold text-white tracking-tight truncate">
                        {totals.savingsSoFar.toFixed(2)} €
                      </div>
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-amber-200/80 leading-relaxed mt-auto">
                    💰 Acumulado hasta el día de hoy
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* AÑADIR GASTO - Sección Principal */}
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-emerald-300/40 bg-gradient-to-br from-emerald-500/30 via-teal-500/20 to-cyan-500/15 p-4 sm:p-8 shadow-2xl backdrop-blur-lg ring-1 ring-emerald-400/20">
          {/* Efectos visuales de fondo */}
          <div className="absolute top-0 left-0 -ml-20 -mt-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 -mr-20 -mb-20 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          
          <div className="relative">
            {/* Header mejorado */}
            <div className="mb-6 sm:mb-8 flex flex-col gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500/40 to-teal-500/40 p-3 sm:p-4 backdrop-blur">
                  <span className="text-3xl sm:text-4xl">💸</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Registrar Gasto</h2>
                  <p className="text-xs sm:text-sm text-emerald-100/70 mt-1 truncate">
                    Añade tus gastos diarios de forma rápida
                  </p>
                </div>
              </div>
              <div className="sm:hidden rounded-2xl border border-emerald-300/40 bg-emerald-500/20 px-4 py-2 backdrop-blur">
                <div className="text-center">
                  <div className="text-xs text-emerald-100/70 uppercase tracking-wide">Disponible</div>
                  <div className={`text-xl font-bold mt-1 ${
                    totals.saldoFinalMes >= 0 ? 'text-white' : 'text-red-300'
                  }`}>
                    {totals.saldoFinalMes.toFixed(2)} €
                  </div>
                </div>
              </div>
            </div>

            {/* Formulario reorganizado */}
            <div className="space-y-6">
              {/* Primera fila: Importe (destacado) */}
              <div className="rounded-2xl border border-cyan-300/30 bg-gradient-to-r from-cyan-500/15 to-blue-500/10 p-4 sm:p-6 backdrop-blur">
                <label className="block">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3">
                    <div className="rounded-xl bg-cyan-500/30 p-2 text-xl sm:text-2xl backdrop-blur">
                      💰
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm sm:text-base font-bold text-white">Importe</span>
                      <p className="text-xs text-cyan-100/60 truncate">¿Cuánto has gastado?</p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border-2 border-cyan-400/30 bg-black/40 px-4 sm:px-6 py-3 sm:py-4 text-2xl sm:text-3xl font-bold text-white placeholder-white/30 outline-none transition-all focus:border-cyan-400/60 focus:bg-black/50 focus:ring-4 focus:ring-cyan-400/20"
                    />
                    <span className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-xl sm:text-2xl font-bold text-white/50">€</span>
                  </div>
                </label>
              </div>

              {/* Segunda fila: Categoría y Concepto */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-purple-300/30 bg-gradient-to-br from-purple-500/15 to-pink-500/10 p-5 backdrop-blur">
                  <label className="block">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="rounded-lg bg-purple-500/30 p-2 text-xl backdrop-blur">
                        🏷️
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white">Categoría</span>
                        <p className="text-xs text-purple-100/60">Tipo de gasto</p>
                      </div>
                    </div>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-xl border-2 border-purple-400/30 bg-black/40 px-4 py-3 text-base font-semibold text-white outline-none transition-all focus:border-purple-400/60 focus:bg-black/50 focus:ring-4 focus:ring-purple-400/20"
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat} className="bg-black text-white capitalize">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-500/15 to-orange-500/10 p-5 backdrop-blur">
                  <label className="block">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="rounded-lg bg-amber-500/30 p-2 text-xl backdrop-blur">
                        📝
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white">Concepto</span>
                        <p className="text-xs text-amber-100/60">¿En qué lo gastaste?</p>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      placeholder="ej: cervezas, gasolina..."
                      className="w-full rounded-xl border-2 border-amber-400/30 bg-black/40 px-4 py-3 text-base font-medium text-white placeholder-white/30 outline-none transition-all focus:border-amber-400/60 focus:bg-black/50 focus:ring-4 focus:ring-amber-400/20"
                    />
                  </label>
                </div>
              </div>

              {/* Tercera fila: Fecha */}
              <div className="rounded-2xl border border-blue-300/30 bg-gradient-to-br from-blue-500/15 to-indigo-500/10 p-5 backdrop-blur">
                <label className="block">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="rounded-lg bg-blue-500/30 p-2 text-xl backdrop-blur">
                      📅
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white">Fecha</span>
                      <p className="text-xs text-blue-100/60">¿Cuándo fue el gasto?</p>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border-2 border-blue-400/30 bg-black/40 pl-2 pr-0 py-2 sm:px-4 sm:py-3 text-sm sm:text-base font-medium text-white outline-none transition-all focus:border-blue-400/60 focus:bg-black/50 focus:ring-4 focus:ring-blue-400/20"
                  />
                </label>
              </div>

              {/* Botón de acción destacado */}
              <div className="pt-4">
                <button
                  onClick={addExpense}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-1 shadow-2xl shadow-emerald-500/50 transition-all duration-300 hover:shadow-emerald-500/70 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="relative rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 sm:px-8 py-4 sm:py-5 transition-all">
                    <div className="flex items-center justify-center gap-2 sm:gap-3">
                      <span className="text-xl sm:text-2xl">✅</span>
                      <span className="text-lg sm:text-xl font-bold text-white tracking-tight">
                        Registrar Gasto
                      </span>
                      <span className="text-xl sm:text-2xl group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                    <div className="mt-1 text-xs text-emerald-100/80 text-center hidden sm:block">
                      Pulsa para guardar el movimiento
                    </div>
                  </div>
                </button>
              </div>

              {/* Info adicional */}
              <div className="flex items-center justify-center gap-2 text-xs text-white/50">
                <span>💡</span>
                <span>Tip: Usa categorías consistentes para mejores estadísticas</span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTONES DE ACCIONES - Centrados */}
        <div className="mt-8 flex justify-center">
          <div className="flex gap-4">
            {/* Botón Análisis de gastos */}
            <button
              onClick={() => setShowAnalytics((v) => !v)}
              className="group relative overflow-hidden rounded-2xl border border-violet-300/40 bg-gradient-to-r from-violet-500/30 to-purple-500/20 px-8 py-4 shadow-xl backdrop-blur transition-all duration-300 hover:shadow-2xl hover:shadow-violet-500/30 hover:scale-105 active:scale-95"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{showAnalytics ? "📊" : "📈"}</span>
                <span className="text-base font-bold text-white">
                  {showAnalytics ? "Ocultar análisis" : "Análisis de gastos"}
                </span>
              </div>
            </button>

            {/* Botón Ver gastos */}
            <button
              onClick={() => setShowExpenses((v) => !v)}
              className="group relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-500/30 to-orange-500/20 px-8 py-4 shadow-xl backdrop-blur transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/30 hover:scale-105 active:scale-95"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{showExpenses ? "📋" : "🗂️"}</span>
                <span className="text-base font-bold text-white">
                  {showExpenses ? "Ocultar gastos" : "Ver gastos"}
                </span>
              </div>
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
        {showExpenses && (
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
        )}
      </div>
    </div>
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
  // Calcular estadísticas
  const totalFiltered = filteredTxs.reduce((sum, t) => sum + t.amount, 0);
  const avgTransaction = filteredTxs.length > 0 ? totalFiltered / filteredTxs.length : 0;
  const topCategory = pieData.length > 0 ? pieData.reduce((a, b) => a.value > b.value ? a : b) : null;
  
  return (
    <div className="mt-8 space-y-5">
      {/* Header con stats rápidas */}
      <div className="rounded-3xl border border-purple-200/30 bg-gradient-to-br from-purple-500/20 via-indigo-500/10 to-purple-400/5 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-purple-500/30 p-2.5 text-2xl backdrop-blur">
                📊
              </div>
              <div>
                <div className="text-xl font-bold text-white">Análisis de Gastos</div>
                <div className="text-sm text-purple-200/70">Periodo: {month}</div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-3">
              <div className="text-xs text-white/70 mb-1">Movimientos</div>
              <div className="text-2xl font-bold text-white">{filteredTxs.length}</div>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-3">
              <div className="text-xs text-white/70 mb-1">Promedio</div>
              <div className="text-xl font-bold text-white">{avgTransaction.toFixed(0)}€</div>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-3 col-span-2 sm:col-span-1">
              <div className="text-xs text-white/70 mb-1">Top categoría</div>
              <div className="text-lg font-bold text-white capitalize truncate">{topCategory?.name || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros modernizados */}
      <div className="rounded-3xl border border-cyan-200/30 bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-cyan-400/5 p-5 shadow-xl backdrop-blur">
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-cyan-500/30 p-2 text-xl backdrop-blur">
            🔍
          </div>
          <div className="text-base font-semibold text-white">Filtros</div>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-cyan-100/80 uppercase tracking-wide">
              Categoría
            </label>
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white backdrop-blur outline-none transition-all focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-cyan-100/80 uppercase tracking-wide">
              Persona
            </label>
            <select
              value={filterPerson}
              onChange={(e) => setFilterPerson(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white backdrop-blur outline-none transition-all focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
            >
              <option value="all">Ambos</option>
              <option value="alba">Alba</option>
              <option value="alberto">Alberto</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-cyan-100/80 uppercase tracking-wide">
              Buscar concepto
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="cervezas, gasolina..."
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white placeholder-white/40 backdrop-blur outline-none transition-all focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>
        </div>
      </div>

      {/* Gráficas modernizadas */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Donut Chart - Distribución */}
        <div className="group relative overflow-hidden rounded-3xl border border-rose-200/30 bg-gradient-to-br from-rose-500/20 via-pink-500/10 to-rose-400/5 p-6 shadow-xl backdrop-blur transition-all hover:shadow-2xl hover:shadow-rose-500/20">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 rounded-full bg-rose-400/10 blur-3xl" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-rose-500/30 p-2.5 text-2xl backdrop-blur">
                🥧
              </div>
              <div>
                <div className="text-base font-bold text-white">Distribución por Categoría</div>
                <div className="text-xs text-rose-200/70">Proporción del gasto total</div>
              </div>
            </div>
            
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    onClick={(data) => {
                      setSelectedCat(String(data?.name ?? ""));
                    }}
                    className="cursor-pointer outline-none"
                  >
                    {pieData.map((entry) => (
                      <Cell 
                        key={entry.name} 
                        fill={colorForCategory(entry.name)}
                        className="transition-all hover:opacity-80"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | undefined) => [
                      `${(value ?? 0).toFixed(2)} €`,
                      "Gasto",
                    ]}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "16px",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "white",
                      padding: "12px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.9)", fontWeight: "600" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-xs text-rose-200/60 text-center">
              Haz clic en una categoría para ver detalles
            </div>
          </div>
        </div>

        {/* Bar Chart - Comparativa */}
        <div className="group relative overflow-hidden rounded-3xl border border-amber-200/30 bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-amber-400/5 p-6 shadow-xl backdrop-blur transition-all hover:shadow-2xl hover:shadow-amber-500/20">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-amber-500/30 p-2.5 text-2xl backdrop-blur">
                📊
              </div>
              <div>
                <div className="text-base font-bold text-white">Gastos por Categoría</div>
                <div className="text-xs text-amber-200/70">Comparativa de importes</div>
              </div>
            </div>
            
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 12 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
                  />
                  <YAxis 
                    tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 12 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
                  />
                  <Tooltip
                    formatter={(value: number | string | undefined) =>
                      `${Number(value ?? 0).toFixed(2)} €`
                    }
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "16px",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "white",
                      padding: "12px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.9)", fontWeight: "600" }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {barData.map((entry) => (
                      <Cell key={entry.name} fill={colorForCategory(entry.name)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de movimientos filtrados */}
      <div className="group relative overflow-hidden rounded-3xl border border-violet-200/30 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-violet-400/5 p-6 shadow-xl backdrop-blur">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-500/30 p-2.5 text-2xl backdrop-blur">
                📋
              </div>
              <div>
                <div className="text-base font-bold text-white">Movimientos Filtrados</div>
                <div className="text-xs text-violet-200/70">Últimas transacciones</div>
              </div>
            </div>
            <div className="rounded-full bg-white/20 backdrop-blur px-4 py-1.5 text-sm font-semibold text-white">
              {totalFiltered.toFixed(2)} €
            </div>
          </div>
          
          {filteredTxs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <div className="text-white/60 text-sm">No hay resultados con los filtros aplicados</div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-2 scrollable-area">
              {filteredTxs.slice(0, 20).map((t) => (
                <div
                  key={t.id}
                  className="group/item flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur transition-all hover:border-white/30 hover:bg-white/10"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div 
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: colorForCategory(t.category) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/90 font-medium truncate">
                        {t.concept}
                      </div>
                      <div className="text-xs text-white/50">
                        {t.date} · <span className="capitalize">{t.category}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-base font-bold text-white">
                      {t.amount.toFixed(2)} €
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        t.person === "alba" 
                          ? "bg-blue-500/30 text-blue-200 border border-blue-400/40" 
                          : "bg-green-500/30 text-green-200 border border-green-400/40"
                      }`}
                    >
                      {t.person}
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredTxs.length > 20 && (
                <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <div className="text-xs text-white/60">
                    Mostrando 20 de {filteredTxs.length} movimientos
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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
