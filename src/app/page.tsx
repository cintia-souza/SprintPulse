"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SprintPulse",
  description: "Ferramenta gratuita para retrospectivas ágeis e planning poker em tempo real.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
};

interface SessionItem {
  id: string;
  roomId: string;
  squad: string;
  phase: string;
  createdAt: string;
  closedAt: string | null;
  _count: { cards: number };
}

export default function Home() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [squad, setSquad] = useState("");
  const [squads, setSquads] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSquad, setSelectedSquad] = useState<string | null>(null);
  const [mode, setMode] = useState<"poker" | "retro" | null>(null);

  useEffect(() => {
    fetch("/api/retro/sessions")
      .then((r) => r.json())
      .then((data) => {
        setSquads(data.squads || []);
        setSessions(data.sessions || []);
      })
      .catch(() => {});
  }, []);

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mode || !sessionId.trim()) return;
    if (mode === "retro" && squad.trim()) {
      // Squad será enviado no join
      localStorage.setItem("sprintpulse_squad", squad.trim());
    }
    router.push(`/${mode}/${sessionId.trim()}`);
  };

  const filteredSessions = selectedSquad
    ? sessions.filter((s) => s.squad === selectedSquad)
    : sessions;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-4 py-12">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Logo */}
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-cyan-400 font-mono tracking-tight">
          SprintPulse
        </h1>
        <p className="mt-2 text-slate-400 text-sm">
          Votação e Retrospectiva — sem fricção, em tempo real.
        </p>
      </div>

      {/* === RETROS ANTERIORES === */}
      {sessions.length > 0 && (
        <section className="w-full max-w-2xl mb-10">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider font-mono mb-4">
            📋 Sprints Anteriores
          </h2>

          {/* Squad filter */}
          {squads.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setSelectedSquad(null)}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                  !selectedSquad
                    ? "border-cyan-400 bg-cyan-400/10 text-cyan-400"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
                }`}
              >
                Todas
              </button>
              {squads.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSquad(s)}
                  className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
                    selectedSquad === s
                      ? "border-emerald-400 bg-emerald-400/10 text-emerald-400"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Sessions list */}
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {filteredSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/retro/${s.roomId}`)}
                className="w-full flex items-center justify-between bg-slate-900/80 border border-slate-700/50 rounded-lg px-4 py-3 hover:border-slate-500 hover:bg-slate-800/80 transition-all text-left"
              >
                <div>
                  <span className="text-sm text-slate-200 font-mono">
                    {s.roomId.slice(0, 12)}...
                  </span>
                  <span className="ml-3 text-xs text-slate-500">
                    {s.squad !== "default" && (
                      <span className="bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 px-2 py-0.5 rounded-full mr-2">
                        {s.squad}
                      </span>
                    )}
                    {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono">
                    {s._count.cards} cards
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      s.phase === "done"
                        ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30"
                        : "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                    }`}
                  >
                    {s.phase === "done" ? "✅ concluída" : "⏳ em andamento"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* === CRIAR/ENTRAR SESSÃO === */}
      <div className="w-full max-w-lg">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider font-mono mb-4 text-center">
          Nova Sessão
        </h2>

        {/* Mode Selection */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setMode("poker")}
            className={`group relative border rounded-xl p-5 text-left transition-all ${
              mode === "poker"
                ? "border-cyan-400 bg-cyan-400/10"
                : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
            }`}
          >
            <span className="text-2xl mb-1 block">🃏</span>
            <h3 className="text-base font-semibold text-slate-100">BytePoker</h3>
            <p className="text-xs text-slate-400 mt-1">Estimativas em tempo real</p>
            {mode === "poker" && (
              <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setMode("retro")}
            className={`group relative border rounded-xl p-5 text-left transition-all ${
              mode === "retro"
                ? "border-emerald-400 bg-emerald-400/10"
                : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
            }`}
          >
            <span className="text-2xl mb-1 block">📝</span>
            <h3 className="text-base font-semibold text-slate-100">PingBack</h3>
            <p className="text-xs text-slate-400 mt-1">Retrospectiva da sprint</p>
            {mode === "retro" && (
              <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Session form */}
        {mode && (
          <form onSubmit={handleGo} className="space-y-3 animate-in fade-in">
            {mode === "retro" && (
              <input
                type="text"
                value={squad}
                onChange={(e) => setSquad(e.target.value)}
                placeholder="Nome da squad (ex: squad-payments)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 font-mono text-sm"
              />
            )}
            <div className="flex gap-3">
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="ID da sessão ou crie um novo..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono text-sm"
                required
              />
              <button
                type="submit"
                className="px-6 py-3 bg-cyan-400/10 border border-cyan-400/50 text-cyan-400 font-semibold rounded-lg hover:bg-cyan-400/20 transition-colors text-sm whitespace-nowrap"
              >
                Entrar →
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="mt-12 text-xs text-slate-600 font-mono">
        Compartilhe o link da sessão com seu time para colaborar em tempo real
      </p>
    </div>
  );
}
