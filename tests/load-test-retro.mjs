/**
 * Teste de carga - PingBack (Retro)
 * Simula 15 pessoas: 1 host + 14 membros, escrevendo cards, revelando e votando.
 *
 * Uso: node tests/load-test-retro.mjs
 * (Certifique-se de que o servidor está rodando em localhost:3000)
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ROOM_ID = `retro-load-${Date.now()}`;
const NUM_PLAYERS = 15;
const CARDS_PER_PLAYER = 3;
const API = `${BASE}/api/retro/room/${ROOM_ID}`;

const players = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
  nickname: `Member_${i + 1}`,
  role: i === 0 ? "host" : "member",
}));

const COLUMNS = ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"];

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

async function run() {
  console.log(`\n📝 PingBack Load Test`);
  console.log(`   Sala: ${ROOM_ID}`);
  console.log(`   Players: ${NUM_PLAYERS}`);
  console.log(`   Cards por player: ${CARDS_PER_PLAYER}`);
  console.log(`   URL: ${API}\n`);

  // --- FASE 1: Join ---
  console.log("📥 Fase 1: Entrando na sala...");
  const joinStart = Date.now();
  // Host entra primeiro (regra do sistema)
  await post({ action: "join", nickname: players[0].nickname, role: "host" });
  // Membros entram em paralelo
  const memberJoins = players.slice(1).map((p) => post({ action: "join", ...p }));
  await Promise.all(memberJoins);
  const joinTime = Date.now() - joinStart;

  let state = await get();
  console.log(`   ✓ ${state.players.length}/${NUM_PLAYERS} players em ${joinTime}ms`);
  if (state.players.length !== NUM_PLAYERS) {
    console.error(`   ❌ ERRO: Esperado ${NUM_PLAYERS}, encontrado ${state.players.length}`);
    process.exit(1);
  }
  console.log("");

  // --- FASE 2: Escrever cards ---
  console.log("✍️  Fase 2: Escrevendo cards...");
  const cardStart = Date.now();
  const cardPromises = [];
  for (const p of players) {
    for (let i = 0; i < CARDS_PER_PLAYER; i++) {
      const column = COLUMNS[i % 3];
      cardPromises.push(
        post({
          action: "add-card",
          nickname: p.nickname,
          column,
          content: `Card de ${p.nickname} #${i + 1} na coluna ${column}`,
        })
      );
    }
  }
  await Promise.all(cardPromises);
  const cardTime = Date.now() - cardStart;

  state = await get();
  const totalCards = NUM_PLAYERS * CARDS_PER_PLAYER;
  console.log(`   ✓ ${state.cards.length}/${totalCards} cards criados em ${cardTime}ms`);
  if (state.cards.length !== totalCards) {
    console.error(`   ❌ ERRO: Cards faltando!`);
    process.exit(1);
  }
  console.log("");

  // --- FASE 3: Reveal ---
  console.log("👁  Fase 3: Revelando pilares...");
  const revealStart = Date.now();
  await post({ action: "reveal-all" });
  const revealTime = Date.now() - revealStart;

  state = await get();
  console.log(`   ✓ Revelado em ${revealTime}ms | phase: ${state.phase} | votingOpen: ${state.votingOpen}`);
  console.log("");

  // --- FASE 4: Votação ---
  console.log("🗳️  Fase 4: Votação (5 votos por pessoa)...");
  const voteStart = Date.now();
  const revealedCards = state.cards.filter((c) => state.revealedColumns.includes(c.column));
  const votePromises = [];
  for (const p of players) {
    // Cada player vota em 5 cards aleatórios
    const shuffled = [...revealedCards].sort(() => Math.random() - 0.5);
    const toVote = shuffled.slice(0, 5);
    for (const card of toVote) {
      votePromises.push(post({ action: "vote", nickname: p.nickname, cardId: card.id }));
    }
  }
  await Promise.all(votePromises);
  const voteTime = Date.now() - voteStart;

  state = await get();
  const totalVotes = state.cards.reduce((sum, c) => sum + c.votes, 0);
  console.log(`   ✓ ${totalVotes} votos registrados em ${voteTime}ms`);
  console.log("");

  // --- FASE 5: Polling simultâneo ---
  console.log("📡 Fase 5: Polling simultâneo (15 GETs)...");
  const pollStart = Date.now();
  const pollResults = await Promise.all(Array.from({ length: NUM_PLAYERS }, () => get()));
  const pollTime = Date.now() - pollStart;
  const allConsistent = pollResults.every((r) => r.players.length === NUM_PLAYERS && r.cards.length === totalCards);
  console.log(`   ✓ ${NUM_PLAYERS} polls em ${pollTime}ms | Consistente: ${allConsistent ? "✓" : "❌"}`);
  console.log("");

  // --- FASE 6: Encerrar votação ---
  console.log("🔒 Fase 6: Encerrando retro...");
  const closeStart = Date.now();
  await post({ action: "close-voting" });
  const closeTime = Date.now() - closeStart;

  state = await get();
  console.log(`   ✓ Encerrado em ${closeTime}ms | phase: ${state.phase}`);
  console.log("");

  // --- FASE 7: Stress test ---
  console.log("⚡ Fase 7: Stress test - polling 5s...");
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
  console.log(`   ${totalCards} cards criados:   ${cardTime}ms`);
  console.log(`   Reveal all:           ${revealTime}ms`);
  console.log(`   ${votePromises.length} votos:           ${voteTime}ms`);
  console.log(`   Polling paralelo:     ${pollTime}ms`);
  console.log(`   Close voting:         ${closeTime}ms`);
  console.log(`   Stress (5s):          ${rps} req/s | ${errors} erros`);
  console.log("═══════════════════════════════════════");

  if (errors === 0 && allConsistent && state.players.length === NUM_PLAYERS) {
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
