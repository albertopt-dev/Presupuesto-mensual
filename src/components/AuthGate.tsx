"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import AuthForm from "@/components/AuthForm";
import { AuthUserProvider } from "@/lib/auth-context";

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

  return <AuthUserProvider user={user}>{children}</AuthUserProvider>;
}
