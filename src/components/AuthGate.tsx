"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Timeout de seguridad: si no carga en 3 segundos, continuar de todos modos
    const timeout = setTimeout(() => {
      console.log("AuthGate timeout - continuando sin autenticación");
      setReady(true);
    }, 3000);

    const unsub = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeout);
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Error en autenticación anónima:", error);
          // Continuar de todos modos
        }
      }
      setReady(true);
    });

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  if (!ready) return <div style={{ padding: 16 }}>Cargando…</div>;
  return <>{children}</>;
}


//@/*": ["./src/*"]
