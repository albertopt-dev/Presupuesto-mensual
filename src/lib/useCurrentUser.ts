import { useEffect, useState } from "react";
import { onIdTokenChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function useCurrentUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | undefined;

    auth.authStateReady().then(() => {
      if (!active) return;
      unsub = onIdTokenChanged(auth, (u) => {
        if (active) setUser(u);
      });
    });

    return () => {
      active = false;
      unsub?.();
    };
  }, []);

  return user;
}
