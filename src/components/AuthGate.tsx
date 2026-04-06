"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
<<<<<<< HEAD
import { onAuthStateChanged, User } from "firebase/auth";
import AuthForm from "@/components/AuthForm";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  if (user === undefined) return <div style={{ padding: 16 }}>Cargando…</div>;
  if (!user) return <AuthForm onAuth={() => {}} />;
=======
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
>>>>>>> c7e7dee76227d691720065d54ce7d18d08b7693f
  return <>{children}</>;
}


//@/*": ["./src/*"]
