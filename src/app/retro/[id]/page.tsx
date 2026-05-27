"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type CardColumn = "WENT_WELL" | "IMPROVE" | "ACTION_ITEMS";
type Phase = "writing" | "revealed" | "voting" | "done";

interface RetroCard {
  id: string;
  column: CardColumn;
  content: string;
  author: string;
  votes: number;
  completed: boolean;
  migratedTo?: string | null;
}

interface RetroPlayer {
  nickname: string;
  role: "host" | "member";
  votesRemaining: number;
  votedCardIds: string[];
}

interface RoomState {
  players: RetroPlayer[];
  cards: RetroCard[];
  revealedColumns: CardColumn[];
  votingOpen: boolean;
  phase: Phase;
}

const COLUMNS: { key: CardColumn; label: string; accent: string; icon: string }[] = [
  { key: "WENT_WELL", label: "O que foi bem", accent: "border-emerald-400", icon: "🟢" },
  { key: "IMPROVE", label: "O que pode melhorar", accent: "border-amber-500", icon: "🟡" },
  { key: "ACTION_ITEMS", label: "Ações", accent: "border-cyan-400", icon: "🔵" },
];

// --- Sound effects ---
function playSound(type: "card" | "reveal" | "vote" | "done") {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.value = 0.12;

  switch (type) {
    case "card":
      osc.frequency.value = 600;
      osc.type = "sine";
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
      break;
    case "reveal":
      osc.frequency.value = 440;
      osc.type = "triangle";
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      setTimeout(() => {
        const c = new AudioContext();
        const o = c.createOscillator();
        const g = c.createGain();
        o.connect(g);
        g.connect(c.destination);
        o.frequency.value = 660;
        o.type = "triangle";
        g.gain.value = 0.1;
        g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.25);
        o.start();
        o.stop(c.currentTime + 0.25);
      }, 120);
      break;
    case "vote":
      osc.frequency.value = 780;
      osc.type = "sine";
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
      break;
    case "done":
      osc.frequency.value = 523;
      osc.type = "sine";
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(() => {
        const c = new AudioContext();
        const o = c.createOscillator();
        const g = c.createGain();
        o.connect(g);
        g.connect(c.destination);
        o.frequency.value = 784;
        o.type = "sine";
        g.gain.value = 0.1;
        g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.4);
        o.start();
        o.stop(c.currentTime + 0.4);
      }, 180);
      break;
  }
}

export default function RetroBoard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState<"host" | "member">("member");
  const [room, setRoom] = useState<RoomState>({
    players: [],
    cards: [],
    revealedColumns: [],
    votingOpen: false,
    phase: "writing",
  });
  const [drafts, setDrafts] = useState<Record<CardColumn, string>>({
    WENT_WELL: "",
    IMPROVE: "",
    ACTION_ITEMS: "",
  });
  const [joinError, setJoinError] = useState("");
  const [copied, setCopied] = useState(false);
  const prevPhase = useRef<Phase>("writing");
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    params.then((p) => setRoomId(p.id));
  }, [params]);

  const pollRoom = useCallback(async () => {
    if (!roomId) return;
    const res = await fetch(`/api/retro/room/${roomId}`);
    if (res.ok) setRoom(await res.json());
  }, [roomId]);

  // Sound on phase transitions
  useEffect(() => {
    if (room.phase === "voting" && prevPhase.current === "writing") {
      playSound("reveal");
    }
    if (room.phase === "done" && prevPhase.current === "voting") {
      playSound("done");
    }
    prevPhase.current = room.phase;
  }, [room.phase]);

  useEffect(() => {
    if (!joined || !roomId) return;
    pollRoom();
    pollRef.current = setInterval(pollRoom, 1000);
    return () => clearInterval(pollRef.current);
  }, [joined, roomId, pollRoom]);

  const sendAction = async (body: Record<string, unknown>) => {
    await fetch(`/api/retro/room/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    pollRoom();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !roomId) return;
    setJoinError("");
    const res = await fetch(`/api/retro/room/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", nickname: nickname.trim(), role }),
    });
    if (!res.ok) {
      const data = await res.json();
      setJoinError(data.error || "Erro ao entrar na sala");
      return;
    }
    setJoined(true);
  };

  const addCard = (column: CardColumn) => {
    const content = drafts[column];
    if (!content.trim()) return;
    playSound("card");
    sendAction({ action: "add-card", nickname, column, content });
    setDrafts((d) => ({ ...d, [column]: "" }));
  };

  const vote = (cardId: string) => {
    const me = room.players.find((p) => p.nickname === nickname);
    if (!me || me.votesRemaining <= 0 || !room.votingOpen || me.votedCardIds.includes(cardId)) return;
    playSound("vote");
    sendAction({ action: "vote", nickname, cardId });
  };

  const currentPlayer = room.players.find((p) => p.nickname === nickname);
  const isHost = role === "host";

  // Phase label
  const phaseLabel: Record<Phase, string> = {
    writing: "📝 Escrevendo cards",
    revealed: "👁 Cards revelados",
    voting: "🗳️ Votação aberta",
    done: "✅ Votação encerrada",
  };

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
              📝 PingBack
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
              onClick={() => setRole("member")}
              className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${
                role === "member"
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-400 scale-105"
                  : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
              }`}
            >
              💻 Membro
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-cyan-400/10 border border-cyan-400/50 text-cyan-400 font-semibold py-3 rounded-lg hover:bg-cyan-400/20 hover:scale-[1.02] transition-all active:scale-95"
          >
            Entrar na Sala →
          </button>

          {joinError && (
            <p className="text-xs text-red-400 text-center bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
              {joinError}
            </p>
          )}
        </form>
      </div>
    );
  }

  // --- Board de Retrospectiva ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <a
            href="/"
            className="text-xl font-bold text-cyan-400 font-mono hover:text-cyan-300 transition-colors"
          >
            ← SprintPulse
          </a>
          <p className="text-xs text-slate-500 font-mono mt-1">
            PingBack · sala/{roomId?.slice(0, 8)} ·{" "}
            <span className="text-emerald-400">{room.players.length} online</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Phase badge */}
          <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300 font-mono">
            {phaseLabel[room.phase]}
          </span>
          {/* User badge */}
          <span
            className={`text-xs px-3 py-1 rounded-full font-mono border ${
              isHost
                ? "border-amber-500/50 text-amber-500 bg-amber-500/10"
                : "border-cyan-400/50 text-cyan-400 bg-cyan-400/10"
            }`}
          >
            {isHost ? "🎯 Host" : "💻"} · {nickname}
          </span>
          {/* Votes remaining */}
          {room.votingOpen && currentPlayer && (
            <span className="text-xs bg-amber-500/10 border border-amber-500/50 text-amber-500 px-3 py-1 rounded-full font-mono">
              🗳️ {currentPlayer.votesRemaining} votos
            </span>
          )}
        </div>
      </header>

      {/* === HOST CONTROLS === */}
      {isHost && (
        <section className="mb-6 space-y-3">
          {/* Share link */}
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
                    ? "bg-emerald-400/10 border border-emerald-400/50 text-emerald-400 scale-105"
                    : "bg-cyan-400/10 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/20"
                }`}
              >
                {copied ? "✓ Copiado!" : "Copiar link"}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap justify-center gap-3">
            {/* Reveal per column (ACTION_ITEMS é sempre aberto) */}
            {room.phase !== "done" && room.revealedColumns.length < 3 && (
              <>
                {COLUMNS.filter((col) => col.key !== "ACTION_ITEMS").map((col) => (
                  <button
                    key={col.key}
                    onClick={() => {
                      playSound("reveal");
                      sendAction({ action: "reveal-column", column: col.key });
                    }}
                    disabled={room.revealedColumns.includes(col.key)}
                    className={`px-4 py-2 border font-semibold rounded-lg transition-all text-xs ${
                      room.revealedColumns.includes(col.key)
                        ? "border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed"
                        : "bg-amber-500/10 border-amber-500/50 text-amber-500 hover:bg-amber-500/20 hover:scale-105 active:scale-95"
                    }`}
                  >
                    👁 Revelar &quot;{col.label}&quot;
                  </button>
                ))}
                <button
                  onClick={() => {
                    playSound("reveal");
                    sendAction({ action: "reveal-all" });
                  }}
                  className="px-4 py-2 bg-amber-500/10 border border-amber-500/50 text-amber-500 font-semibold rounded-lg hover:bg-amber-500/20 hover:scale-105 active:scale-95 transition-all text-xs"
                >
                  👁 Revelar Tudo
                </button>
              </>
            )}

            {/* Encerrar retro - só precisa ter revelado WENT_WELL e IMPROVE */}
            {room.phase === "voting" && room.revealedColumns.includes("WENT_WELL") && room.revealedColumns.includes("IMPROVE") && (
              <button
                onClick={() => sendAction({ action: "close-voting" })}
                className="px-6 py-3 bg-red-400/10 border border-red-400/50 text-red-400 font-semibold rounded-lg hover:bg-red-400/20 hover:scale-105 active:scale-95 transition-all text-sm"
              >
                🔒 Concluir Retro
              </button>
            )}

            {/* Indicador de pilares faltantes */}
            {room.phase === "voting" && (!room.revealedColumns.includes("WENT_WELL") || !room.revealedColumns.includes("IMPROVE")) && (
              <span className="text-xs text-slate-400 font-mono self-center">
                ⚠️ Revele os pilares para poder encerrar
              </span>
            )}

            {/* Reset */}
            {room.phase === "done" && (
              <button
                onClick={() => sendAction({ action: "reset" })}
                className="px-6 py-3 bg-slate-800 border border-slate-700 text-slate-300 font-semibold rounded-lg hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all text-sm"
              >
                🔄 Nova Retro
              </button>
            )}
          </div>
        </section>
      )}

      {/* === GRID DE 3 COLUNAS === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {COLUMNS.map((col) => {
          const isRevealed = room.revealedColumns.includes(col.key);
          const columnCards = room.cards
            .filter((c) => c.column === col.key)
            .sort((a, b) => (room.phase === "done" ? b.votes - a.votes : 0));

          return (
            <div
              key={col.key}
              className={`border-t-2 ${col.accent} bg-gradient-to-b from-slate-900/80 to-slate-900/40 rounded-xl p-4 space-y-4`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider font-mono">
                  {col.icon} {col.label}
                </h2>
                <span className="text-xs text-slate-600 font-mono">
                  {columnCards.length} cards
                </span>
              </div>

              {/* Input de Card (ACTION_ITEMS sempre aberto; demais só enquanto não revelados) */}
              {room.phase !== "done" && (col.key === "ACTION_ITEMS" || !isRevealed) && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={drafts[col.key]}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [col.key]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && addCard(col.key)}
                    placeholder="Adicionar card..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                  />
                  <button
                    onClick={() => addCard(col.key)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-cyan-400 hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all text-sm"
                  >
                    +
                  </button>
                </div>
              )}

              {/* Cards */}
              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {columnCards.map((card) => {
                  const isMine = card.author === nickname;
                  // ACTION_ITEMS é sempre visível; demais só após revelar ou se for do próprio autor
                  const canSee = col.key === "ACTION_ITEMS" || isRevealed || isMine;

                  // Card virado (não revelado e não é meu)
                  if (!canSee) {
                    return (
                      <div
                        key={card.id}
                        className="relative h-20 rounded-xl border-2 border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center overflow-hidden"
                      >
                        {/* Pattern decorativo */}
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute inset-2 border border-slate-500 rounded-lg" />
                          <div className="absolute inset-4 border border-slate-600 rounded-md" />
                        </div>
                        <span className="text-slate-600 text-lg">🔒</span>
                      </div>
                    );
                  }

                  // Card revelado ou próprio
                  return (
                    <div
                      key={card.id}
                      className={`relative bg-slate-800/80 border rounded-lg p-3 space-y-2 transition-all duration-300 ${
                        room.phase === "done" && card.votes > 0
                          ? "border-emerald-400/30 shadow-md shadow-emerald-400/10"
                          : isMine && !isRevealed
                            ? "border-cyan-400/30 border-dashed"
                            : "border-slate-700/50"
                      }`}
                    >
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">
                        {card.content}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-mono">
                          {isMine && !isRevealed && (
                            <span className="text-cyan-400/70 italic">seu card</span>
                          )}
                        </span>

                        {/* Vote button */}
                        {(room.votingOpen || room.phase === "done") && isRevealed && (
                          (() => {
                            const alreadyVoted = currentPlayer?.votedCardIds.includes(card.id);
                            const canVoteThis = room.votingOpen && currentPlayer && currentPlayer.votesRemaining > 0 && !alreadyVoted;
                            return (
                              <button
                                onClick={() => vote(card.id)}
                                disabled={!canVoteThis}
                                className={`flex items-center gap-1 text-xs font-mono transition-all ${
                                  room.phase === "done"
                                    ? "text-emerald-400 cursor-default"
                                    : alreadyVoted
                                      ? "text-emerald-400/60 cursor-not-allowed"
                                      : canVoteThis
                                        ? "text-amber-500 hover:text-amber-400 hover:scale-110 active:scale-95"
                                        : "text-slate-600 cursor-not-allowed"
                                }`}
                              >
                                {card.votes > 0 && (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                                    {card.votes}
                                  </span>
                                )}
                                {room.votingOpen && (alreadyVoted ? "✓" : "▲")}
                              </button>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* === PLANO DE AÇÃO (visível quando retro concluída) === */}
      {room.phase === "done" && room.cards.some((c) => c.column === "ACTION_ITEMS") && (
        <section className="mt-6 bg-slate-900/50 border border-cyan-400/20 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider font-mono">
            📝 Plano de Ação
          </h3>
          <div className="space-y-2">
            {room.cards
              .filter((c) => c.column === "ACTION_ITEMS")
              .map((card) => (
                <div
                  key={card.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    card.migratedTo
                      ? "border-purple-400/30 bg-purple-400/5 opacity-60"
                      : card.completed
                        ? "border-emerald-400/30 bg-emerald-400/5"
                        : "border-slate-700 bg-slate-800/80"
                  }`}
                >
                  {/* Checkbox */}
                  {isHost && !card.migratedTo && (
                    <button
                      onClick={() => sendAction({ action: "toggle-action-complete", cardId: card.id })}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        card.completed
                          ? "border-emerald-400 bg-emerald-400 text-slate-900"
                          : "border-slate-500 hover:border-cyan-400"
                      }`}
                    >
                      {card.completed && <span className="text-xs font-bold">✓</span>}
                    </button>
                  )}
                  {!isHost && (
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      card.completed ? "border-emerald-400 bg-emerald-400 text-slate-900" : "border-slate-600"
                    }`}>
                      {card.completed && <span className="text-xs font-bold">✓</span>}
                    </span>
                  )}

                  {/* Content */}
                  <span className={`flex-1 text-sm ${
                    card.completed ? "line-through text-slate-500" : card.migratedTo ? "text-slate-500" : "text-slate-200"
                  }`}>
                    {card.content}
                  </span>

                  {/* Status badges */}
                  {card.migratedTo && (
                    <span className="text-[10px] bg-purple-400/10 border border-purple-400/30 text-purple-400 px-2 py-0.5 rounded-full font-mono">
                      ↪ migrado
                    </span>
                  )}

                  {/* Migrate button */}
                  {isHost && !card.completed && !card.migratedTo && (
                    <button
                      onClick={() => {
                        const target = prompt("ID da próxima sala de retro (cole o ID da URL):");
                        if (target?.trim()) {
                          sendAction({ action: "migrate-action", cardId: card.id, targetRoomId: target.trim() });
                        }
                      }}
                      className="text-[10px] bg-purple-400/10 border border-purple-400/30 text-purple-400 px-2 py-1 rounded-md font-mono hover:bg-purple-400/20 transition-all"
                    >
                      ↪ Migrar
                    </button>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

      {/* === PLAYERS ONLINE === */}
      <section className="mt-6 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono mb-3">
          Participantes
        </h3>
        <div className="flex flex-wrap gap-2">
          {room.players.map((p) => (
            <div
              key={p.nickname}
              className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-300 font-mono">{p.nickname}</span>
              <span className="text-[10px] text-slate-500">
                {p.role === "host" ? "🎯" : "💻"}
              </span>
              {room.votingOpen && (
                <span className="text-[10px] text-amber-500 font-mono">
                  {p.votesRemaining}🗳️
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
