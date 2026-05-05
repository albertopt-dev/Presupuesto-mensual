import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

const defaultMeta = {
  incomes: {} as Record<string, number>,

  // Campos antiguos para compatibilidad
  incomeP1: 0,
  incomeP2: 0,

  savingTarget: 0,
  savingsSoFar: 0,
  savingsGoal: 0,
  extraSavings: 0,
  savingsConsolidated: false,
};

function getPreviousMonth(month: string, offset: number) {
  const [yearRaw, monthRaw] = month.split("-").map(Number);

  let year = yearRaw;
  let monthNumber = monthRaw - offset;

  while (monthNumber <= 0) {
    monthNumber += 12;
    year -= 1;
  }

  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

async function findPreviousSavingsSoFar(uid: string, month: string) {
  for (let i = 1; i <= 24; i++) {
    const previousMonth = getPreviousMonth(month, i);

    const snap = await adminDb
      .doc(`budgets/${uid}/months/${previousMonth}/meta/main`)
      .get();

    if (!snap.exists) continue;

    const value = Number(snap.data()?.savingsSoFar ?? 0);

    if (value > 0) {
      return value;
    }
  }

  return 0;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    const month = searchParams.get("month");

    if (!uid || !month) {
      return NextResponse.json(
        { error: "Missing uid or month" },
        { status: 400 }
      );
    }

    const metaRef = adminDb.doc(`budgets/${uid}/months/${month}/meta/main`);
    const txsRef = adminDb
      .collection(`budgets/${uid}/months/${month}/transactions`)
      .orderBy("date", "asc");

    const [metaSnap, txsSnap] = await Promise.all([
      metaRef.get(),
      txsRef.get(),
    ]);

    const metaData = metaSnap.exists ? metaSnap.data() ?? {} : {};

    const previousSavingsSoFar = await findPreviousSavingsSoFar(uid, month);
    const currentSavingsSoFar = Number(metaData.savingsSoFar ?? 0);

    const meta = {
      ...defaultMeta,
      ...metaData,
      incomes:
        typeof metaData.incomes === "object" && metaData.incomes !== null
          ? metaData.incomes
          : {},
      savingsSoFar: currentSavingsSoFar > 0 ? currentSavingsSoFar : previousSavingsSoFar,
      savingsConsolidated: Boolean(metaData.savingsConsolidated),
    };

    const transactions = txsSnap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date ?? "",
          category: data.category ?? "",
          concept: data.concept ?? "",
          amount: Number(data.amount ?? 0),
          person: data.person,
          type: data.type,
        };
      })
      .filter((tx) => tx.type === "expense");

    return NextResponse.json({ meta, transactions });
  } catch (error) {
    console.error("bootstrap-month error:", error);
    return NextResponse.json(
      { error: "Failed to bootstrap month" },
      { status: 500 }
    );
  }
}
