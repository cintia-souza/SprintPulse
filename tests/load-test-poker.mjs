/**
 * Teste de carga - BytePoker
 * Simula 15 pessoas entrando na sala, votando, revelando e fazendo nova rodada.
 *
 * Uso: node tests/load-test-poker.mjs
 * (Certifique-se de que o servidor está rodando em localhost:3000)
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ROOM_ID = `load-test-${Date.now()}`;
const NUM_PLAYERS = 15;
const API = `${BASE}/api/poker/${ROOM_ID}`;

const players = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
  nickname: `Player_${i + 1}`,
  role: i === 0 ? "host" : "dev",
}));

const VOTES = [1, 2, 3, 5, 8, 13, 21];

async function post(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status} - ${await res.text()}`);
  return res.json();
}

async function get() {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`GET failed: ${res.status}`);
  return res.json();
}

function randomVote() {
  return VOTES[Math.floor(Math.random() * VOTES.length)];
}

async function run() {
  console.log(`\n🃏 BytePoker Load Test`);
  console.log(`   Sala: ${ROOM_ID}`);
  console.log(`   Players: ${NUM_PLAYERS}`);
  console.log(`   URL: ${API}\n`);

  // --- FASE 1: Join ---
  console.log("📥 Fase 1: Entrando na sala...");
  const joinStart = Date.now();
  const joinPromises = players.map((p) => post({ action: "join", ...p }));
  await Promise.all(joinPromises);
  const joinTime = Date.now() - joinStart;
  console.log(`   ✓ ${NUM_PLAYERS} players entraram em ${joinTime}ms`);

  // Verificar estado
  let state = await get();
  console.log(`   → Sala tem ${state.players.length} players\n`);
  if (state.players.length !== NUM_PLAYERS) {
    console.error(`   ❌ ERRO: Esperado ${NUM_PLAYERS} players, encontrado ${state.players.length}`);
    process.exit(1);
  }

  // --- FASE 2: Votação simultânea ---
  console.log("🗳️  Fase 2: Todos votando simultaneamente...");
  const voteStart = Date.now();
  const devPlayers = players.filter((p) => p.role === "dev");
  const votePromises = devPlayers.map((p) =>
    post({ action: "vote", nickname: p.nickname, vote: randomVote() })
  );
  await Promise.all(votePromises);
  const voteTime = Date.now() - voteStart;
  console.log(`   ✓ ${devPlayers.length} votos enviados em ${voteTime}ms`);

  state = await get();
  const votedCount = state.players.filter((p) => p.role === "dev" && p.vote !== null).length;
  console.log(`   → ${votedCount}/${devPlayers.length} devs votaram\n`);
  if (votedCount !== devPlayers.length) {
    console.error(`   ❌ ERRO: Nem todos os votos foram registrados`);
    process.exit(1);
  }

  // --- FASE 3: Polling simultâneo (simula todos vendo a mesa) ---
  console.log("📡 Fase 3: Polling simultâneo (15 GETs paralelos)...");
  const pollStart = Date.now();
  const pollPromises = Array.from({ length: NUM_PLAYERS }, () => get());
  const pollResults = await Promise.all(pollPromises);
  const pollTime = Date.now() - pollStart;
  console.log(`   ✓ ${NUM_PLAYERS} polls respondidos em ${pollTime}ms`);
  const allSame = pollResults.every((r) => r.players.length === NUM_PLAYERS);
  console.log(`   → Todos receberam ${NUM_PLAYERS} players: ${allSame ? "✓" : "❌"}\n`);

  // --- FASE 4: Reveal ---
  console.log("👁  Fase 4: Host revela cartas...");
  const revealStart = Date.now();
  await post({ action: "reveal" });
  const revealTime = Date.now() - revealStart;
  console.log(`   ✓ Reveal em ${revealTime}ms`);

  state = await get();
  console.log(`   → revealed: ${state.revealed}\n`);

  // --- FASE 5: Reset ---
  console.log("🔄 Fase 5: Nova rodada...");
  const resetStart = Date.now();
  await post({ action: "reset" });
  const resetTime = Date.now() - resetStart;
  console.log(`   ✓ Reset em ${resetTime}ms`);

  state = await get();
  const resetVotes = state.players.filter((p) => p.vote !== null).length;
  console.log(`   → revealed: ${state.revealed}, votos pendentes: ${resetVotes}\n`);

  // --- FASE 6: Stress test (polling contínuo por 5s) ---
  console.log("⚡ Fase 6: Stress test - polling contínuo 5s...");
  const stressStart = Date.now();
  let totalRequests = 0;
  let errors = 0;

  while (Date.now() - stressStart < 5000) {
    const batch = Array.from({ length: NUM_PLAYERS }, () =>
      get().then(() => { totalRequests++; }).catch(() => { errors++; })
    );
    await Promise.all(batch);
  }
  const stressTime = Date.now() - stressStart;
  const rps = Math.round(totalRequests / (stressTime / 1000));
  console.log(`   ✓ ${totalRequests} requests em ${stressTime}ms (${rps} req/s)`);
  console.log(`   → Erros: ${errors}\n`);

  // --- RESULTADO ---
  console.log("═══════════════════════════════════════");
  console.log("📊 RESULTADO DO TESTE");
  console.log("═══════════════════════════════════════");
  console.log(`   Join ${NUM_PLAYERS} players:  ${joinTime}ms`);
  console.log(`   Votação simultânea:   ${voteTime}ms`);
  console.log(`   Polling paralelo:     ${pollTime}ms`);
  console.log(`   Reveal:               ${revealTime}ms`);
  console.log(`   Reset:                ${resetTime}ms`);
  console.log(`   Stress (5s):          ${rps} req/s | ${errors} erros`);
  console.log("═══════════════════════════════════════");

  if (errors === 0 && allSame && votedCount === devPlayers.length) {
    console.log("\n✅ TODOS OS TESTES PASSARAM!\n");
  } else {
    console.log("\n❌ ALGUNS TESTES FALHARAM\n");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("❌ Erro fatal:", err.message);
  process.exit(1);
});
