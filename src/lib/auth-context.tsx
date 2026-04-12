"use client";

import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

const AuthUserContext = createContext<User | null | undefined>(undefined);

export function AuthUserProvider({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  return (
    <AuthUserContext.Provider value={user}>
      {children}
    </AuthUserContext.Provider>
  );
}

export function useAuthUser() {
  return useContext(AuthUserContext);
}
