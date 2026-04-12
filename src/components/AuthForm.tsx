"use client";

import { useState, useEffect, useRef } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { auth } from "@/lib/firebase";

const CHARS = "012345678920356485976584987546+-×÷=%$€#@!?∑∞√πΩΔ∂∫";
const FONT_SIZE = 32;
const SPEED = 0.2; // columnas bajan ~0.6 celdas por frame a 60fps

export default function AuthForm({ onAuth }: { onAuth: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let cols: number;
    let drops: number[];   // posición Y de cada columna (en celdas)
    let hues: number[];    // hue base por columna

    function init() {
      canvas!.width  = window.innerWidth;
      canvas!.height = window.innerHeight;
      cols  = Math.floor(canvas!.width / FONT_SIZE);
      drops = Array.from({ length: cols }, () => Math.random() * -50);
      hues  = Array.from({ length: cols }, (_, i) => (i / cols) * 360);
    }

    let frame = 0;
    function draw() {
      animId = requestAnimationFrame(draw);
      frame++;

      // Fondo semitransparente para el efecto de estela
      ctx!.fillStyle = "rgba(10, 10, 20, 0.05)";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

      ctx!.font = `${FONT_SIZE}px monospace`;

      for (let i = 0; i < cols; i++) {
        // Rotar hue suavemente: cada columna a distinta velocidad
        hues[i] = (hues[i] + 0.15 + i * 0.003) % 360;
        const h = hues[i];

        // Carácter aleatorio cada ciertos frames para no cambiar cada frame
        const char = frame % 4 === 0
          ? CHARS[Math.floor(Math.random() * CHARS.length)]
          : CHARS[Math.floor(drops[i] * 7) % CHARS.length];

        const x = i * FONT_SIZE;
        const y = drops[i] * FONT_SIZE;

        // Carácter cabeza: más brillante
        ctx!.fillStyle = `hsla(${h}, 85%, 90%, 0.95)`;
        ctx!.fillText(char, x, y);

        // Estela: múltiples caracteres desvanecidos
        for (let t = 1; t <= 8; t++) {
          const alpha = 0.45 * (1 - t / 8);
          ctx!.fillStyle = `hsla(${h}, 70%, 55%, ${alpha})`;
          const trailChar = CHARS[Math.floor(Math.random() * CHARS.length)];
          ctx!.fillText(trailChar, x, y - FONT_SIZE * t);
        }
        if (drops[i] * FONT_SIZE > canvas!.height && Math.random() > 0.990) {
          drops[i] = Math.random() * -20;
        }

        drops[i] += SPEED;

        // Reiniciar columna al salir de pantalla (con desfase aleatorio)
        if (drops[i] * FONT_SIZE > canvas!.height && Math.random() > 0.990) {
          drops[i] = Math.random() * -20;
        }
      }
    }

    init();
    draw();

    const onResize = () => init();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (isRegister) {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        onAuth();
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? "";
        const messages: Record<string, string> = {
          "auth/email-already-in-use": "Este email ya está registrado",
          "auth/weak-password": "La contraseña debe tener al menos 6 caracteres",
          "auth/invalid-email": "El formato del email no es válido",
        };
        setError(messages[code] ?? "Ha ocurrido un error. Inténtalo de nuevo");
      }
    } else {
      try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email, password);
        onAuth();
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? "";
        const messages: Record<string, string> = {
          "auth/invalid-credential": "Email o contraseña incorrectos",
        };
        setError(messages[code] ?? "Ha ocurrido un error. Inténtalo de nuevo");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">

      {/* Canvas Matrix RGB */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 0, opacity: 0.55 }}
      />

      {/* Blobs de fondo */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/30 rounded-full blur-3xl pointer-events-none" style={{ zIndex: 1 }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-80 h-80 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" style={{ zIndex: 1 }} />
      <div className="absolute top-[40%] right-[20%] w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" style={{ zIndex: 1 }} />

      {/* Caja */}
      <form
        onSubmit={handleSubmit}
        style={{ animation: "authEnter 0.5s ease-out both", zIndex: 2 }}
        className="relative w-full max-w-sm mx-4 px-8 py-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💰</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Presupuesto</h1>
          <p className="text-white/50 text-sm mt-2">Inicia sesión para continuar</p>
        </div>

        <div className="space-y-3 mb-6">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition"
            required
          />
        </div>

        {!isRegister && (
          <label className="flex items-center gap-2.5 cursor-pointer mb-5 w-fit">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
            />
            <span className="text-sm text-white/50">Recuérdame</span>
          </label>
        )}

        {error && (
          <div className="mb-4 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
        >
          {loading ? "Cargando..." : isRegister ? "Registrarse" : "Entrar"}
        </button>

        <p className="text-center text-sm text-white/40 mt-6">
          {isRegister ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
          <button
            type="button"
            onClick={() => setIsRegister(r => !r)}
            className="text-blue-400 hover:text-blue-300 transition font-medium"
          >
            {isRegister ? "Inicia sesión" : "Regístrate"}
          </button>
        </p>
      </form>

      <style>{`
        @keyframes authEnter {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
}
