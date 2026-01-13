"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        await signInAnonymously(auth);
      }
      setReady(true);
    });

    return () => unsub();
  }, []);

  if (!ready) return <div style={{ padding: 16 }}>Cargando…</div>;
  return <>{children}</>;
}


//@/*": ["./src/*"]
