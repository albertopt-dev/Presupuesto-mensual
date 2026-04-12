import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

const defaultMeta = {
  incomeP1: 0,
  incomeP2: 0,
  savingTarget: 0,
  savingsSoFar: 0,
  savingsGoal: 0,
  extraSavings: 0,
};

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

    const meta = metaSnap.exists
      ? { ...defaultMeta, ...(metaSnap.data() ?? {}) }
      : defaultMeta;

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
