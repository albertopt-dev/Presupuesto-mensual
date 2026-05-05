"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Check,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  doc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";

type Category = "essential" | "personal" | "saving";

type BudgetItem = {
  id: string;
  name: string;
  amount: number;
  category: Category;
};

type HistoryEntry = {
  month: string;
  items: BudgetItem[];
};

const SECTIONS = [
  {
    key: "essential" as Category,
    label: "Esenciales",
    emoji: "🔵",
    pct: 50,
    gradientBg: "from-blue-500/20 to-blue-600/10",
    border: "border-blue-400/30",
    barColor: "bg-blue-400",
    textColor: "text-blue-300",
  },
  {
    key: "personal" as Category,
    label: "Personal",
    emoji: "🟠",
    pct: 30,
    gradientBg: "from-orange-500/20 to-amber-600/10",
    border: "border-orange-400/30",
    barColor: "bg-orange-400",
    textColor: "text-orange-300",
  },
  {
    key: "saving" as Category,
    label: "Ahorro",
    emoji: "🟢",
    pct: 20,
    gradientBg: "from-emerald-500/20 to-green-600/10",
    border: "border-emerald-400/30",
    barColor: "bg-emerald-400",
    textColor: "text-emerald-300",
  },
] as const;

type Props = {
  uid: string;
  month: string;
  totalIncome: number;
  onClose: () => void;
};

export default function BudgetModal({ uid, month, totalIncome, onClose }: Props) {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [tab, setTab] = useState<"budget" | "history">("budget");

  // Add form
  const [addingCategory, setAddingCategory] = useState<Category | null>(null);
  const [addName, setAddName] = useState("");
  const [addAmount, setAddAmount] = useState("");

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");

  // History
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryEntry | null>(null);

  // Fade-in animation
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const budgetPath = `budgets/${uid}/months/${month}/budget`;

  // Real-time subscription to current month
  useEffect(() => {
    const unsub = onSnapshot(collection(db, budgetPath), (snap) => {
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          name: String(d.data().name ?? ""),
          amount: Number(d.data().amount ?? 0),
          category: d.data().category as Category,
        }))
      );
    });
    return () => unsub();
  }, [budgetPath]);

  // Load history: check last 12 months
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [curYear, curMonthNum] = month.split("-").map(Number);
      const pastMonths: string[] = [];
      for (let i = 1; i <= 12; i++) {
        let m = curMonthNum - i;
        let y = curYear;
        while (m <= 0) { m += 12; y--; }
        pastMonths.push(`${y}-${String(m).padStart(2, "0")}`);
      }

      const results: HistoryEntry[] = [];
      await Promise.all(
        pastMonths.map(async (m) => {
          const snap = await getDocs(
            collection(db, `budgets/${uid}/months/${m}/budget`)
          );
          if (!snap.empty) {
            results.push({
              month: m,
              items: snap.docs.map((d) => ({
                id: d.id,
                name: String(d.data().name ?? ""),
                amount: Number(d.data().amount ?? 0),
                category: d.data().category as Category,
              })),
            });
          }
        })
      );

      results.sort((a, b) => b.month.localeCompare(a.month));
      setHistoryEntries(results);
    } finally {
      setHistoryLoading(false);
    }
  }, [uid, month]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  async function handleAdd(category: Category) {
    const name = addName.trim();
    const amount = parseFloat(addAmount.replace(",", "."));
    if (!name || isNaN(amount) || amount <= 0) return;
    await addDoc(collection(db, budgetPath), {
      name,
      amount,
      category,
      ownerId: uid,
      createdAt: serverTimestamp(),
    });
    setAddName("");
    setAddAmount("");
    setAddingCategory(null);
  }

  async function handleDelete(id: string) {
    await deleteDoc(doc(db, budgetPath, id));
  }

  async function handleUpdate(id: string) {
    const name = editName.trim();
    const amount = parseFloat(editAmount.replace(",", "."));
    if (!name || isNaN(amount) || amount <= 0) return;
    await updateDoc(doc(db, budgetPath, id), { name, amount });
    setEditingId(null);
  }

  function startEdit(item: BudgetItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(String(item.amount));
    setAddingCategory(null);
  }

  function formatMonth(m: string) {
    const [y, mo] = m.split("-");
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    });
  }

  function sectionTotal(key: Category) {
    return items.filter((i) => i.category === key).reduce((s, i) => s + i.amount, 0);
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      onClick={handleBackdrop}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`relative flex flex-col w-full sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/98 via-indigo-950/95 to-slate-900/98 shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        {/* ── Modal header ── */}
        <div className="flex-none flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                Presupuesto estimado
              </h2>
              <p className="text-[11px] sm:text-xs text-white/50 capitalize">{formatMonth(month)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/50 hover:text-white hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Regla 50-30-20 — siempre visible ── */}
        

        {/* ── Tabs ── */}
        <div className="flex-none mx-4 sm:mx-5 mt-3 sm:mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/60 backdrop-blur p-1 sticky top-0 z-10">
          <button
            onClick={() => { setTab("budget"); setSelectedHistory(null); }}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              tab === "budget"
                ? "bg-indigo-500/40 text-white shadow"
                : "text-white/45 hover:text-white/70"
            }`}
          >
            📋 Presupuesto
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${
              tab === "history"
                ? "bg-indigo-500/40 text-white shadow"
                : "text-white/45 hover:text-white/70"
            }`}
          >
            <History size={14} />
            Historial
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-6 pt-4 space-y-4">

          <div className="rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 p-4 sm:p-4">
            <p className="text-sm font-bold text-indigo-200 mb-1">Guía 50-30-20</p>

            <p className="text-xs sm:text-xs text-white/60 leading-relaxed">
              La regla 50-30-20 es una guía para repartir tus ingresos de forma equilibrada.
              El{" "}
              <span className="font-semibold text-blue-300">50%</span>{" "}
              se reserva para gastos esenciales: alquiler o hipoteca, luz, agua, internet,
              transporte, seguros, préstamos y compra semanal. El{" "}
              <span className="font-semibold text-orange-300">30%</span>{" "}
              es para gastos personales o de estilo de vida: ocio, restaurantes, ropa,
              caprichos, suscripciones, viajes o compras no imprescindibles. El{" "}
              <span className="font-semibold text-emerald-300">20%</span>{" "}
              se destina al ahorro: fondo de emergencia, objetivos futuros, inversión o
              amortizar deudas. Puedes ajustarla a tu situación, pero sirve como referencia
              para saber si el mes está equilibrado.{" "}
              <span className="text-base">💡</span>
            </p>

            {totalIncome > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg border border-blue-400/35 bg-blue-500/15 px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-blue-300">
                  🔵 Esenciales: {(totalIncome * 0.5).toFixed(2)} €
                </span>
                <span className="rounded-lg border border-orange-400/35 bg-orange-500/15 px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-orange-300">
                  🟠 Personal: {(totalIncome * 0.3).toFixed(2)} €
                </span>
                <span className="rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-emerald-300">
                  🟢 Ahorro: {(totalIncome * 0.2).toFixed(2)} €
                </span>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2">
                <p className="text-xs text-amber-300">
                  Introduce los ingresos del mes para ver los importes recomendados.
                </p>
              </div>
            )}
          </div>

          {/* ────── TAB PRESUPUESTO ────── */}
          {tab === "budget" &&
            SECTIONS.map((section) => {
              const limit = totalIncome > 0 ? totalIncome * (section.pct / 100) : 0;
              const total = sectionTotal(section.key);
              const pct = limit > 0 ? Math.min(100, (total / limit) * 100) : 0;
              const over = limit > 0 && total > limit;
              const sectionItems = items.filter((i) => i.category === section.key);
              const isAdding = addingCategory === section.key;

              return (
                <div
                  key={section.key}
                  className={`rounded-2xl border ${section.border} bg-gradient-to-br ${section.gradientBg} p-3 sm:p-4`}
                >
                  {/* Section header */}
                  <div className="flex items-start sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{section.emoji}</span>
                      <span className="text-sm sm:text-sm font-bold text-white">{section.label}</span>
                      <span className={`text-xs font-medium ${section.textColor}`}>
                        {section.pct}%
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold ${over ? "text-red-300" : section.textColor}`}
                    >
                      {total.toFixed(2)} €
                      {totalIncome > 0 ? ` / ${limit.toFixed(2)} €` : ""}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {totalIncome > 0 && (
                    <div className="mb-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          over ? "bg-red-400" : section.barColor
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  {/* Item list */}
                  <div className="space-y-1.5">
                    {sectionItems.map((item) =>
                      editingId === item.id ? (
                        /* Edit row */
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-3 py-2"
                        >
                          <input
                            autoFocus
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate(item.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="flex-1 min-w-0 rounded-lg border border-white/20 bg-black/35 px-2 py-1 text-sm text-white outline-none focus:border-white/40 placeholder-white/30"
                            placeholder="Nombre"
                          />
                          <input
                            type="text"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate(item.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="w-20 rounded-lg border border-white/20 bg-black/35 px-2 py-1 text-sm text-right text-white outline-none focus:border-white/40 placeholder-white/30"
                            placeholder="0.00"
                          />
                          <span className="text-xs text-white/40 flex-none">€</span>
                          <button
                            onClick={() => handleUpdate(item.id)}
                            className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 p-1.5 text-emerald-300 hover:bg-emerald-500/35 transition flex-none"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/45 hover:text-white transition flex-none"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        /* Normal row */
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 group"
                        >
                          <span className="text-sm text-white/85 truncate capitalize">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1.5 flex-none">
                            <span className="text-sm font-semibold text-white">
                              {item.amount.toFixed(2)} €
                            </span>
                            <button
                              onClick={() => startEdit(item)}
                              className="rounded-lg p-1 text-white/30 hover:text-white hover:bg-white/10 transition opacity-0 group-hover:opacity-100"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="rounded-lg p-1 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    )}

                    {/* Add form / Add button */}
                    {isAdding ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          autoFocus
                          type="text"
                          value={addName}
                          onChange={(e) => setAddName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAdd(section.key);
                            if (e.key === "Escape") setAddingCategory(null);
                          }}
                          className="flex-1 min-w-0 rounded-lg border border-white/20 bg-black/35 px-2 py-1.5 text-sm text-white outline-none focus:border-white/40 placeholder-white/30"
                          placeholder="Nombre de la partida"
                        />
                        <input
                          type="text"
                          value={addAmount}
                          onChange={(e) => setAddAmount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAdd(section.key);
                            if (e.key === "Escape") setAddingCategory(null);
                          }}
                          className="w-20 rounded-lg border border-white/20 bg-black/35 px-2 py-1.5 text-sm text-right text-white outline-none focus:border-white/40 placeholder-white/30"
                          placeholder="0.00"
                        />
                        <span className="text-xs text-white/40 flex-none">€</span>
                        <button
                          onClick={() => handleAdd(section.key)}
                          className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 p-1.5 text-emerald-300 hover:bg-emerald-500/35 transition flex-none"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setAddingCategory(null)}
                          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/45 hover:text-white transition flex-none"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingCategory(section.key);
                          setAddName("");
                          setAddAmount("");
                          setEditingId(null);
                        }}
                        className="mt-1 flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition py-1"
                      >
                        <Plus size={13} />
                        Añadir partida
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          {/* ────── TAB HISTORIAL ────── */}
          {tab === "history" && (
            <>
              {selectedHistory ? (
                /* Mes seleccionado — solo lectura */
                <div>
                  <button
                    onClick={() => setSelectedHistory(null)}
                    className="flex items-center gap-1.5 mb-4 text-xs text-white/45 hover:text-white/70 transition"
                  >
                    <ChevronLeft size={14} />
                    Volver al historial
                  </button>
                  <div className="mb-4 flex items-center gap-2">
                    <h3 className="text-base font-bold text-white capitalize">
                      {formatMonth(selectedHistory.month)}
                    </h3>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/40">
                      Solo lectura
                    </span>
                  </div>
                  {SECTIONS.map((section) => {
                    const sectionItems = selectedHistory.items.filter(
                      (i) => i.category === section.key
                    );
                    if (sectionItems.length === 0) return null;
                    const total = sectionItems.reduce((s, i) => s + i.amount, 0);
                    return (
                      <div
                        key={section.key}
                        className={`mb-3 rounded-2xl border ${section.border} bg-gradient-to-br ${section.gradientBg} p-4`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="flex items-center gap-2 text-sm font-bold text-white">
                            <span>{section.emoji}</span>
                            {section.label}
                          </span>
                          <span className={`text-xs font-semibold ${section.textColor}`}>
                            {total.toFixed(2)} €
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {sectionItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                            >
                              <span className="text-sm text-white/80 capitalize">
                                {item.name}
                              </span>
                              <span className="text-sm font-semibold text-white">
                                {item.amount.toFixed(2)} €
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : historyLoading ? (
                <div className="py-16 text-center text-white/35 text-sm">
                  Cargando historial...
                </div>
              ) : historyEntries.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-4xl mb-3">📂</div>
                  <p className="text-white/35 text-sm">
                    No hay meses anteriores con datos de presupuesto
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyEntries.map((entry) => {
                    const total = entry.items.reduce((s, i) => s + i.amount, 0);
                    return (
                      <button
                        key={entry.month}
                        onClick={() => setSelectedHistory(entry)}
                        className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 transition group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base">📅</span>
                          <div>
                            <span className="block text-sm font-semibold text-white capitalize">
                              {formatMonth(entry.month)}
                            </span>
                            <span className="text-xs text-white/35">
                              {entry.items.length} partida
                              {entry.items.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white/75">
                            {total.toFixed(2)} €
                          </span>
                          <ChevronRight
                            size={15}
                            className="text-white/25 group-hover:text-white/55 transition"
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
