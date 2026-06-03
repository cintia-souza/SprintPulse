"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, "?", "☕"] as const;
type PointValue = (typeof FIBONACCI)[number];

interface Player { nickname: string; role: "host" | "dev"; vote: PointValue | null; }
interface RoomState { players: Player[]; revealed: boolean; }

// --- Audio ---
let audioCtx: AudioContext | null = null;
function playSound(type: "vote" | "reveal" | "reset" | "consensus") {
  try {
    if (!audioCtx || audioCtx.state === "closed") audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.1;
    if (type === "vote") { osc.frequency.value = 880; osc.type = "sine"; osc.start(); osc.stop(ctx.currentTime + 0.08); }
    else if (type === "reveal") { osc.frequency.value = 520; osc.type = "triangle"; gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3); osc.start(); osc.stop(ctx.currentTime + 0.3); }
    else if (type === "reset") { osc.frequency.value = 300; osc.type = "square"; gain.gain.value = 0.05; osc.start(); osc.stop(ctx.currentTime + 0.12); }
    else if (type === "consensus") { osc.frequency.value = 660; osc.type = "sine"; gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4); osc.start(); osc.stop(ctx.currentTime + 0.4); }
  } catch { /* silent */ }
}

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 40 }, (_, i) => (
        <div key={i} className="absolute w-2 h-2 rounded-full animate-confetti" style={{ left: `${Math.random() * 100}%`, backgroundColor: ["#22d3ee","#34d399","#fbbf24","#a78bfa","#f472b6"][i % 5], animationDelay: `${Math.random() * 0.5}s`, animationDuration: `${1.5 + Math.random() * 1.5}s` }} />
      ))}
    </div>
  );
}

export default function PokerRoom({ params }: { params: Promise<{ id: string }> }) {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState<"host" | "dev">("dev");
  const [room, setRoom] = useState<RoomState>({ players: [], revealed: false });
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [flipCards, setFlipCards] = useState(false);

  const prevRevealed = useRef(false);
  const revealSoundPlayed = useRef(false);
  const lastJson = useRef("");
  const pollTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const nicknameRef = useRef("");
  const roleRef = useRef<"host" | "dev">("dev");

  // Restore session
  useEffect(() => {
    params.then((p) => {
      setRoomId(p.id);
      const saved = sessionStorage.getItem(`sp_poker_${p.id}`);
      if (saved) {
        try {
          const { nickname: n, role: r } = JSON.parse(saved);
          if (n) { setNickname(n); setRole(r); nicknameRef.current = n; roleRef.current = r; setJoined(true); }
        } catch { /* ignore */ }
      }
    });
  }, [params]);

  // Poll - skip if tab hidden
  const poll = useCallback(async () => {
    if (!roomId || document.hidden) return;
    try {
      const res = await fetch(`/api/poker/${roomId}`);
      if (!res.ok) return;
      const text = await res.text();
      if (text === lastJson.current) return;
      lastJson.current = text;
      setRoom(JSON.parse(text));
    } catch { /* skip */ }
  }, [roomId]);

  // Reveal sound (once per transition)
  useEffect(() => {
    if (room.revealed && !prevRevealed.current) {
      if (!revealSoundPlayed.current) {
        revealSoundPlayed.current = true;
        playSound("reveal");
        setFlipCards(true);
        setTimeout(() => setFlipCards(false), 800);
        // Consensus check
        const devVotes = room.players.filter(p => p.role === "dev" && p.vote !== null).map(p => p.vote);
        if (new Set(devVotes).size === 1 && devVotes.length > 1) {
          setTimeout(() => { playSound("consensus"); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }, 600);
        }
      }
    }
    if (!room.revealed && prevRevealed.current) {
      revealSoundPlayed.current = false;
      playSound("reset");
    }
    prevRevealed.current = room.revealed;
  }, [room.revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start polling + re-join
  useEffect(() => {
    if (!joined || !roomId || !nicknameRef.current) return;
    // Re-join (idempotent — server ignores if already exists)
    fetch(`/api/poker/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", nickname: nicknameRef.current, role: roleRef.current }),
    }).then(() => poll());
    pollTimer.current = setInterval(poll, 2000);

    // Ao voltar ao foco, faz poll imediato
    const onVisibility = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(pollTimer.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [joined, roomId, poll]);

  // Send action
  const send = useCallback(async (body: Record<string, unknown>) => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/poker/${roomId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { const text = await res.text(); lastJson.current = text; setRoom(JSON.parse(text)); }
    } catch { /* skip */ }
  }, [roomId]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed || !roomId) return;
    nicknameRef.current = trimmed;
    roleRef.current = role;
    await send({ action: "join", nickname: trimmed, role });
    sessionStorage.setItem(`sp_poker_${roomId}`, JSON.stringify({ nickname: trimmed, role }));
    setNickname(trimmed);
    setJoined(true);
  };

  const selectCard = (val: PointValue) => {
    if (room.revealed || role === "host") return;
    playSound("vote");
    send({ action: "vote", nickname: nicknameRef.current, vote: val });
  };

  const currentPlayer = room.players.find(p => p.nickname === nicknameRef.current);
  const devs = room.players.filter(p => p.role === "dev");
  const numericVotes = devs.map(p => p.vote).filter(v => typeof v === "number") as number[];
  const average = numericVotes.length > 0 ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1) : null;
  const voteCounts = devs.reduce<Record<string, number>>((acc, p) => { if (p.vote !== null) acc[String(p.vote)] = (acc[String(p.vote)] || 0) + 1; return acc; }, {});
  const consensus = Object.keys(voteCounts).length === 1 && numericVotes.length > 1;
  const allVoted = devs.length > 0 && devs.every(p => p.vote !== null);

  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <form onSubmit={handleJoin} className="w-full max-w-sm border border-cyan-400/30 bg-slate-900/80 backdrop-blur-sm rounded-xl p-8 space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-cyan-400 font-mono tracking-tight animate-pulse-slow">🃏 BytePoker</h1>
            <p className="text-xs text-slate-500 font-mono">sala/{roomId?.slice(0, 8)}</p>
          </div>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Seu apelido..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono" minLength={2} required />
          <div className="flex gap-3">
            <button type="button" onClick={() => setRole("host")} className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${role === "host" ? "border-amber-500 bg-amber-500/10 text-amber-500 scale-105" : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"}`}>🎯 Host (PM/TL)</button>
            <button type="button" onClick={() => setRole("dev")} className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${role === "dev" ? "border-cyan-400 bg-cyan-400/10 text-cyan-400 scale-105" : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"}`}>💻 Dev</button>
          </div>
          <button type="submit" className="w-full bg-cyan-400/10 border border-cyan-400/50 text-cyan-400 font-semibold py-3 rounded-lg hover:bg-cyan-400/20 hover:scale-[1.02] transition-all active:scale-95">Entrar na Sala →</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative">
      <Confetti active={showConfetti} />
      <header className="mb-6 flex items-center justify-between">
        <div>
          <a href="/" className="text-xl font-bold text-cyan-400 font-mono hover:text-cyan-300 transition-colors">← SprintPulse</a>
          <p className="text-xs text-slate-500 font-mono mt-1">BytePoker · sala/{roomId?.slice(0, 8)} · <span className="text-emerald-400">{room.players.length} online</span></p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-mono border ${role === "host" ? "border-amber-500/50 text-amber-500 bg-amber-500/10" : "border-cyan-400/50 text-cyan-400 bg-cyan-400/10"}`}>{role === "host" ? "🎯 Host" : "💻 Dev"} · {nickname}</span>
      </header>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Mesa */}
        <section className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
          {allVoted && !room.revealed && <div className="absolute inset-0 bg-cyan-400/5 animate-pulse rounded-2xl" />}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Mesa de Votação</h3>
            {allVoted && !room.revealed && <span className="text-xs text-emerald-400 font-mono animate-bounce">✓ Todos votaram!</span>}
          </div>
          <div className="flex flex-wrap justify-center gap-5">
            {room.players.map((p) => (
              <div key={p.nickname} className="flex flex-col items-center gap-2">
                <div className={`w-16 h-24 transition-all duration-500 ${flipCards && p.role === "dev" ? "animate-flip" : ""}`}>
                  <div className={`w-full h-full rounded-xl border-2 flex items-center justify-center font-mono text-xl font-bold shadow-lg transition-all duration-300 ${p.role === "host" ? "border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-amber-500/5 text-amber-500/70" : room.revealed && p.vote !== null ? "border-emerald-400 bg-gradient-to-b from-emerald-400/20 to-emerald-400/5 text-emerald-400 shadow-emerald-400/20" : p.vote !== null ? "border-cyan-400 bg-gradient-to-b from-cyan-400/15 to-cyan-400/5 text-cyan-400 shadow-cyan-400/10" : "border-slate-700 bg-slate-800/80 text-slate-600"}`}>
                    {p.role === "host" ? "🎯" : room.revealed ? (p.vote ?? "—") : p.vote !== null ? "✓" : "?"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs text-slate-400 font-mono truncate max-w-[80px]">{p.nickname}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Host controls */}
        {role === "host" && (
          <section className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 max-w-md w-full">
                <span className="text-xs text-slate-500">🔗</span>
                <span className="flex-1 text-xs text-slate-300 font-mono truncate">{typeof window !== "undefined" ? window.location.href : ""}</span>
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${copied ? "bg-emerald-400/10 border border-emerald-400/50 text-emerald-400" : "bg-cyan-400/10 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/20"}`}>{copied ? "✓ Copiado!" : "Copiar link"}</button>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <button onClick={() => send({ action: "reveal" })} disabled={room.revealed} className={`px-6 py-3 border font-semibold rounded-lg transition-all text-sm ${room.revealed ? "border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-amber-500/10 border-amber-500/50 text-amber-500 hover:bg-amber-500/20 hover:scale-105 active:scale-95"}`}>👁 Revelar Cartas</button>
              <button onClick={() => send({ action: "reset" })} className="px-6 py-3 bg-slate-800 border border-slate-700 text-slate-300 font-semibold rounded-lg hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all text-sm">🔄 Nova Rodada</button>
            </div>
          </section>
        )}

        {/* Dev cards */}
        {role === "dev" && (
          <section>
            <p className="text-sm text-slate-400 mb-3 text-center">{room.revealed ? "Cartas reveladas — aguarde nova rodada" : "Selecione sua estimativa"}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {FIBONACCI.map((val) => (
                <button key={val} onClick={() => selectCard(val)} disabled={room.revealed} className={`w-14 h-20 md:w-16 md:h-24 rounded-xl border-2 font-mono text-lg font-bold flex items-center justify-center transition-all duration-200 ${currentPlayer?.vote === val ? "border-cyan-400 bg-cyan-400/15 text-cyan-400 scale-110 shadow-lg shadow-cyan-400/20" : room.revealed ? "border-slate-700 bg-slate-900 text-slate-600 cursor-not-allowed" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400/50 hover:scale-110 hover:shadow-lg hover:shadow-cyan-400/10 active:scale-95"}`}>{val}</button>
              ))}
            </div>
          </section>
        )}

        {/* Summary */}
        {room.revealed && (
          <section className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-5 animate-slide-up">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider font-mono">Resumo</h3>
              {consensus && <span className="text-xs bg-emerald-400/10 border border-emerald-400/50 text-emerald-400 px-2 py-0.5 rounded-full font-mono">🎉 Consenso!</span>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-800/80 rounded-lg p-4 text-center border border-slate-700/50"><p className="text-xs text-slate-500 font-mono mb-1">Média</p><p className="text-3xl font-bold text-cyan-400 font-mono">{average ?? "—"}</p></div>
              <div className="bg-slate-800/80 rounded-lg p-4 text-center border border-slate-700/50"><p className="text-xs text-slate-500 font-mono mb-1">Votos</p><p className="text-3xl font-bold text-slate-200 font-mono">{devs.filter(p => p.vote !== null).length}/{devs.length}</p></div>
              <div className="bg-slate-800/80 rounded-lg p-4 text-center border border-slate-700/50"><p className="text-xs text-slate-500 font-mono mb-1">Mín / Máx</p><p className="text-3xl font-bold text-slate-200 font-mono">{numericVotes.length > 0 ? `${Math.min(...numericVotes)}/${Math.max(...numericVotes)}` : "—"}</p></div>
              <div className="bg-slate-800/80 rounded-lg p-4 text-center border border-slate-700/50"><p className="text-xs text-slate-500 font-mono mb-1">Consenso</p><p className={`text-3xl font-bold font-mono ${consensus ? "text-emerald-400" : "text-amber-500"}`}>{consensus ? "✓" : "✗"}</p></div>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-mono mb-3">Distribuição</p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(voteCounts).sort(([a], [b]) => Number(a) - Number(b)).map(([val, count]) => (
                  <div key={val} className="flex flex-col items-center gap-1 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 min-w-[60px]">
                    <span className="text-lg font-bold text-cyan-400 font-mono">{val}</span>
                    <div className="flex gap-0.5">{Array.from({ length: count }).map((_, i) => <span key={i} className="w-2 h-2 rounded-full bg-cyan-400" />)}</div>
                    <span className="text-xs text-slate-500 font-mono">{count}×</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-mono mb-3">Votos Individuais</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {devs.map((p) => (
                  <div key={p.nickname} className="flex items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="text-sm text-slate-300 font-mono">{p.nickname}</span></div>
                    <span className="text-lg font-bold text-emerald-400 font-mono">{p.vote ?? "—"}</span>
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
