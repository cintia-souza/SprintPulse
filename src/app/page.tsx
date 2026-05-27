"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [mode, setMode] = useState<"poker" | "retro" | null>(null);

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mode || !sessionId.trim()) return;
    router.push(`/${mode}/${sessionId.trim()}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      {/* Logo / Brand */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-cyan-400 font-mono tracking-tight">
          SprintPulse
        </h1>
        <p className="mt-2 text-slate-400 text-sm">
          Votação e Retrospectiva — sem fricção, em tempo real.
        </p>
      </div>

      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mb-8">
        <button
          onClick={() => setMode("poker")}
          className={`group relative border rounded-xl p-6 text-left transition-all ${
            mode === "poker"
              ? "border-cyan-400 bg-cyan-400/10"
              : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
          }`}
        >
          <span className="text-2xl mb-2 block">🃏</span>
          <h2 className="text-lg font-semibold text-slate-100">BytePoker</h2>
          <p className="text-xs text-slate-400 mt-1">
            Estime histórias em tempo real com seu time
          </p>
          {mode === "poker" && (
            <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setMode("retro")}
          className={`group relative border rounded-xl p-6 text-left transition-all ${
            mode === "retro"
              ? "border-emerald-400 bg-emerald-400/10"
              : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
          }`}
        >
          <span className="text-2xl mb-2 block">📝</span>
          <h2 className="text-lg font-semibold text-slate-100">PingBack</h2>
          <p className="text-xs text-slate-400 mt-1">
            Reflita sobre a sprint com seu time
          </p>
          {mode === "retro" && (
            <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Session ID Input */}
      {mode && (
        <form
          onSubmit={handleGo}
          className="w-full max-w-lg flex gap-3 animate-in fade-in"
        >
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Digite o ID da sessão ou crie um novo..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono text-sm"
            required
          />
          <button
            type="submit"
            className="px-6 py-3 bg-cyan-400/10 border border-cyan-400/50 text-cyan-400 font-semibold rounded-lg hover:bg-cyan-400/20 transition-colors text-sm whitespace-nowrap"
          >
            Entrar →
          </button>
        </form>
      )}

      {/* Footer hint */}
      <p className="mt-12 text-xs text-slate-600 font-mono">
        Compartilhe o link da sessão com seu time para colaborar em tempo real
      </p>
    </div>
  );
}
