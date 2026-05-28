"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, "?", "☕"] as const;
type PointValue = (typeof FIBONACCI)[number];

interface Player {
  nickname: string;
  role: "host" | "dev";
  vote: PointValue | null;
}

interface RoomState {
  players: Player[];
  revealed: boolean;
}

// --- Single AudioContext (reused) ---
let audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playSound(type: "vote" | "reveal" | "reset" | "consensus") {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.12;

    switch (type) {
      case "vote":
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
        break;
      case "reveal":
        osc.frequency.value = 440;
        osc.type = "triangle";
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
        setTimeout(() => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2);
          g2.connect(ctx.destination);
          o2.frequency.value = 660;
          o2.type = "triangle";
          g2.gain.value = 0.1;
          g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          o2.start();
          o2.stop(ctx.currentTime + 0.3);
        }, 150);
        break;
      case "reset":
        osc.frequency.value = 330;
        osc.type = "square";
        gain.gain.value = 0.06;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        break;
      case "consensus":
        osc.frequency.value = 523;
        osc.type = "sine";
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        setTimeout(() => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2);
          g2.connect(ctx.destination);
          o2.frequency.value = 784;
          o2.type = "sine";
          g2.gain.value = 0.1;
          g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          o2.start();
          o2.stop(ctx.currentTime + 0.5);
        }, 200);
        break;
    }
  } catch {
    // Silently fail if audio not available
  }
}

// --- Confetti ---
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 1.5,
    color: ["#22d3ee", "#34d399", "#fbbf24", "#a78bfa", "#f472b6"][i % 5],
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function PokerRoom({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState<"host" | "dev">("dev");
  const [room, setRoom] = useState<RoomState>({ players: [], revealed: false });
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [flipCards, setFlipCards] = useState(false);
  const prevRevealed = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const lastDataRef = useRef<string>("");
  const pausePollRef = useRef(false);

  useEffect(() => {
    params.then((p) => {
      setRoomId(p.id);
      // Restaurar sessão do sessionStorage ao carregar
      const saved = sessionStorage.getItem(`poker_session_${p.id}`);
      if (saved) {
        const { nickname: n, role: r } = JSON.parse(saved);
        setNickname(n);
        setRole(r);
        setJoined(true);
      }
    });
  }, [params]);

  // Polling estável — compara texto bruto para evitar re-renders
  const pollRoom = useCallback(async () => {
    if (!roomId || pausePollRef.current) return;
    try {
      const res = await fetch(`/api/poker/${roomId}`);
      if (res.ok) {
        const text = await res.text();
        if (text !== lastDataRef.current) {
          lastDataRef.current = text;
          setRoom(JSON.parse(text));
        }
      }
    } catch {
      // Network error, skip
    }
  }, [roomId]);

  // Detect reveal/reset transitions (only fires when room.revealed actually changes)
  useEffect(() => {
    if (room.revealed && !prevRevealed.current) {
      playSound("reveal");
      setFlipCards(true);
      setTimeout(() => setFlipCards(false), 800);

      // Check consensus
      const devVotes = room.players
        .filter((p) => p.role === "dev" && p.vote !== null)
        .map((p) => p.vote);
      const unique = new Set(devVotes);
      if (unique.size === 1 && devVotes.length > 1) {
        setTimeout(() => {
          playSound("consensus");
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        }, 500);
      }
    }
    if (!room.revealed && prevRevealed.current) {
      playSound("reset");
    }
    prevRevealed.current = room.revealed;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.revealed]);

  useEffect(() => {
    if (!joined || !roomId) return;
    // Re-join silencioso ao reconectar (garante que o servidor tem o player)
    fetch(`/api/poker/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", nickname, role }),
    }).then(() => pollRoom());
    pollRef.current = setInterval(pollRoom, 2000);
    return () => clearInterval(pollRef.current);
  }, [joined, roomId, pollRoom, nickname, role]);

  // Envia ação e usa a resposta diretamente (sem poll extra)
  const sendAction = useCallback(async (body: Record<string, unknown>) => {
    if (!roomId) return;
    pausePollRef.current = true;
    try {
      const res = await fetch(`/api/poker/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const text = await res.text();
        lastDataRef.current = text;
        setRoom(JSON.parse(text));
      }
    } finally {
      setTimeout(() => { pausePollRef.current = false; }, 500);
    }
  }, [roomId]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !roomId) return;
    await sendAction({ action: "join", nickname: nickname.trim(), role });
    // Salvar sessão no sessionStorage
    sessionStorage.setItem(`poker_session_${roomId}`, JSON.stringify({ nickname: nickname.trim(), role }));
    setJoined(true);
  };

  const selectCard = (val: PointValue) => {
    if (room.revealed || role === "host") return;
    playSound("vote");
    sendAction({ action: "vote", nickname, vote: val });
  };

  const currentPlayer = room.players.find((p) => p.nickname === nickname);
  const devs = room.players.filter((p) => p.role === "dev");
  const numericVotes = devs
    .map((p) => p.vote)
    .filter((v) => typeof v === "number") as number[];

  const average =
    numericVotes.length > 0
      ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1)
      : null;

  const voteCounts = devs.reduce<Record<string, number>>((acc, p) => {
    if (p.vote !== null) {
      acc[String(p.vote)] = (acc[String(p.vote)] || 0) + 1;
    }
    return acc;
  }, {});

  const consensus = Object.keys(voteCounts).length === 1 && numericVotes.length > 1;
  const allVoted = devs.length > 0 && devs.every((p) => p.vote !== null);

  // --- Tela de entrada ---
  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <form
          onSubmit={handleJoin}
          className="w-full max-w-sm border border-cyan-400/30 bg-slate-900/80 backdrop-blur-sm rounded-xl p-8 space-y-6 animate-fade-in"
        >
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-cyan-400 font-mono tracking-tight animate-pulse-slow">
              🃏 BytePoker
            </h1>
            <p className="text-xs text-slate-500 font-mono">
              sala/{roomId?.slice(0, 8)}
            </p>
          </div>

          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Seu apelido..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono"
            minLength={2}
            required
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRole("host")}
              className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${
                role === "host"
                  ? "border-amber-500 bg-amber-500/10 text-amber-500 scale-105"
                  : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
              }`}
            >
              🎯 Host (PM/TL)
            </button>
            <button
              type="button"
              onClick={() => setRole("dev")}
              className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${
                role === "dev"
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-400 scale-105"
                  : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
              }`}
            >
              💻 Dev
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-cyan-400/10 border border-cyan-400/50 text-cyan-400 font-semibold py-3 rounded-lg hover:bg-cyan-400/20 hover:scale-[1.02] transition-all active:scale-95"
          >
            Entrar na Sala →
          </button>
        </form>
      </div>
    );
  }

  // --- Mesa de votação ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative">
      <Confetti active={showConfetti} />

      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <a
            href="/"
            className="text-xl font-bold text-cyan-400 font-mono hover:text-cyan-300 transition-colors"
          >
            ← SprintPulse
          </a>
          <p className="text-xs text-slate-500 font-mono mt-1">
            BytePoker · sala/{roomId?.slice(0, 8)} ·{" "}
            <span className="text-emerald-400">{room.players.length} online</span>
          </p>
        </div>
        <span
          className={`text-xs px-3 py-1 rounded-full font-mono border ${
            role === "host"
              ? "border-amber-500/50 text-amber-500 bg-amber-500/10"
              : "border-cyan-400/50 text-cyan-400 bg-cyan-400/10"
          }`}
        >
          {role === "host" ? "🎯 Host" : "💻 Dev"} · {nickname}
        </span>
      </header>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* === MESA DE VOTAÇÃO === */}
        <section className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
          {allVoted && !room.revealed && (
            <div className="absolute inset-0 bg-cyan-400/5 animate-pulse rounded-2xl" />
          )}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Mesa de Votação
            </h3>
            {allVoted && !room.revealed && (
              <span className="text-xs text-emerald-400 font-mono animate-bounce">
                ✓ Todos votaram!
              </span>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-5">
            {room.players.map((p) => (
              <div
                key={p.nickname}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`relative w-16 h-24 transition-all duration-500 ${
                    flipCards && p.role === "dev" ? "animate-flip" : ""
                  }`}
                  style={{ perspective: "600px" }}
                >
                  <div
                    className={`w-full h-full rounded-xl border-2 flex items-center justify-center font-mono text-xl font-bold shadow-lg transition-all duration-300 ${
                      p.role === "host"
                        ? "border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-amber-500/5 text-amber-500/70"
                        : room.revealed && p.vote !== null
                          ? "border-emerald-400 bg-gradient-to-b from-emerald-400/20 to-emerald-400/5 text-emerald-400 shadow-emerald-400/20"
                          : p.vote !== null
                            ? "border-cyan-400 bg-gradient-to-b from-cyan-400/15 to-cyan-400/5 text-cyan-400 shadow-cyan-400/10"
                            : "border-slate-700 bg-slate-800/80 text-slate-600"
                    }`}
                  >
                    {p.role === "host"
                      ? "🎯"
                      : room.revealed
                        ? (p.vote ?? "—")
                        : p.vote !== null
                          ? "✓"
                          : "?"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-slate-400 font-mono truncate max-w-[80px]">
                    {p.nickname}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* === CONTROLES DO HOST === */}
        {role === "host" && (
          <section className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 max-w-md w-full">
                <span className="text-xs text-slate-500">🔗</span>
                <span className="flex-1 text-xs text-slate-300 font-mono truncate">
                  {typeof window !== "undefined" ? window.location.href : ""}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    copied
                      ? "bg-emerald-400/10 border border-emerald-400/50 text-emerald-400"
                      : "bg-cyan-400/10 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/20"
                  }`}
                >
                  {copied ? "✓ Copiado!" : "Copiar link"}
                </button>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => sendAction({ action: "reveal" })}
                disabled={room.revealed}
                className={`px-6 py-3 border font-semibold rounded-lg transition-all text-sm ${
                  room.revealed
                    ? "border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-amber-500/10 border-amber-500/50 text-amber-500 hover:bg-amber-500/20 hover:scale-105 active:scale-95"
                }`}
              >
                👁 Revelar Cartas
              </button>
              <button
                onClick={() => sendAction({ action: "reset" })}
                className="px-6 py-3 bg-slate-800 border border-slate-700 text-slate-300 font-semibold rounded-lg hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all text-sm"
              >
                🔄 Nova Rodada
              </button>
            </div>
          </section>
        )}

        {/* === SELEÇÃO DE CARTAS (DEV) === */}
        {role === "dev" && (
          <section>
            <p className="text-sm text-slate-400 mb-3 text-center">
              {room.revealed
                ? "Cartas reveladas — aguarde o host iniciar nova rodada"
                : "Selecione sua estimativa"}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {FIBONACCI.map((val) => (
                <button
                  key={val}
                  onClick={() => selectCard(val)}
                  disabled={room.revealed}
                  className={`w-14 h-20 md:w-16 md:h-24 rounded-xl border-2 font-mono text-lg font-bold flex items-center justify-center transition-all duration-200 ${
                    currentPlayer?.vote === val
                      ? "border-cyan-400 bg-cyan-400/15 text-cyan-400 scale-110 shadow-lg shadow-cyan-400/20"
                      : room.revealed
                        ? "border-slate-700 bg-slate-900 text-slate-600 cursor-not-allowed"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400/50 hover:scale-110 hover:shadow-lg hover:shadow-cyan-400/10 active:scale-95"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* === RESUMO === */}
        {room.revealed && (
          <section className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-5 animate-slide-up">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Resumo da Rodada
              </h3>
              {consensus && (
                <span className="text-xs bg-emerald-400/10 border border-emerald-400/50 text-emerald-400 px-2 py-0.5 rounded-full font-mono animate-pulse">
                  🎉 Consenso!
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-800/80 rounded-lg p-4 text-center border border-slate-700/50">
                <p className="text-xs text-slate-500 font-mono mb-1">Média</p>
                <p className="text-3xl font-bold text-cyan-400 font-mono">
                  {average ?? "—"}
                </p>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-4 text-center border border-slate-700/50">
                <p className="text-xs text-slate-500 font-mono mb-1">Votos</p>
                <p className="text-3xl font-bold text-slate-200 font-mono">
                  {devs.filter((p) => p.vote !== null).length}/{devs.length}
                </p>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-4 text-center border border-slate-700/50">
                <p className="text-xs text-slate-500 font-mono mb-1">Mín / Máx</p>
                <p className="text-3xl font-bold text-slate-200 font-mono">
                  {numericVotes.length > 0
                    ? `${Math.min(...numericVotes)}/${Math.max(...numericVotes)}`
                    : "—"}
                </p>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-4 text-center border border-slate-700/50">
                <p className="text-xs text-slate-500 font-mono mb-1">Consenso</p>
                <p
                  className={`text-3xl font-bold font-mono ${consensus ? "text-emerald-400" : "text-amber-500"}`}
                >
                  {consensus ? "✓" : "✗"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 font-mono mb-3">Distribuição</p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(voteCounts)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([val, count]) => (
                    <div
                      key={val}
                      className="flex flex-col items-center gap-1 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 min-w-[60px]"
                    >
                      <span className="text-lg font-bold text-cyan-400 font-mono">
                        {val}
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: count }).map((_, i) => (
                          <span
                            key={i}
                            className="w-2 h-2 rounded-full bg-cyan-400"
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        {count}×
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 font-mono mb-3">Votos Individuais</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {devs.map((p) => (
                  <div
                    key={p.nickname}
                    className="flex items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-sm text-slate-300 font-mono">
                        {p.nickname}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {p.vote ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
