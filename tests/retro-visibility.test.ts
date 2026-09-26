import { toPublicCard, StoredCard } from "@/lib/retro-visibility";

const ALICE = "a".repeat(32);
const BOB = "b".repeat(32);

function card(over: Partial<StoredCard> = {}): StoredCard {
  return {
    id: "c1",
    column: "WENT_WELL",
    content: "O deploy travou por 3 dias",
    authorKey: ALICE,
    votes: 0,
    completed: false,
    migratedTo: null,
    ...over,
  };
}

describe("toPublicCard — anonimato do card", () => {
  it("nunca devolve authorKey, revelado ou não", () => {
    const virado = toPublicCard(card(), [], BOB);
    const aberto = toPublicCard(card(), ["WENT_WELL"], BOB);

    expect(virado).not.toHaveProperty("authorKey");
    expect(aberto).not.toHaveProperty("authorKey");
    expect(JSON.stringify(aberto)).not.toContain(ALICE);
  });

  it("não vaza o texto de card virado para outra pessoa", () => {
    const out = toPublicCard(card(), [], BOB);

    expect(out.content).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain("deploy travou");
    expect(out.isMine).toBe(false);
  });

  it("deixa o autor ler o próprio card antes do reveal", () => {
    const out = toPublicCard(card(), [], ALICE);

    expect(out.content).toBe("O deploy travou por 3 dias");
    expect(out.isMine).toBe(true);
  });

  it("abre o texto para todos depois do reveal, ainda sem dizer de quem é", () => {
    const out = toPublicCard(card(), ["WENT_WELL"], BOB);

    expect(out.content).toBe("O deploy travou por 3 dias");
    expect(out.isMine).toBe(false);
  });

  it("trata ACTION_ITEMS como sempre visível", () => {
    const out = toPublicCard(card({ column: "ACTION_ITEMS" }), [], BOB);

    expect(out.content).toBe("O deploy travou por 3 dias");
  });

  it("não dá dono a card sem authorKey, nem para viewer anônimo", () => {
    // Card migrado / anterior à migration: authorKey vazio.
    expect(toPublicCard(card({ authorKey: "" }), [], "").isMine).toBe(false);
    expect(toPublicCard(card({ authorKey: "" }), [], null).isMine).toBe(false);
    // Viewer sem sessão não vira dono de nada.
    expect(toPublicCard(card(), [], null).isMine).toBe(false);
    expect(toPublicCard(card(), [], undefined).content).toBeUndefined();
  });

  it("mantém os campos que a UI precisa mesmo com o card virado", () => {
    const out = toPublicCard(card({ votes: 4, completed: true, migratedTo: "sprint-43" }), [], BOB);

    expect(out).toMatchObject({
      id: "c1",
      column: "WENT_WELL",
      votes: 4,
      completed: true,
      migratedTo: "sprint-43",
    });
  });
});

describe("authorKeyFor — a chave não entrega a pessoa", () => {
  it("é diferente por sala para o mesmo usuário", async () => {
    const { authorKeyFor } = await import("@/lib/author-key");

    expect(authorKeyFor("uid-1", "sessao-A")).not.toBe(authorKeyFor("uid-1", "sessao-B"));
  });

  it("é estável para o mesmo usuário na mesma sala", async () => {
    const { authorKeyFor } = await import("@/lib/author-key");

    expect(authorKeyFor("uid-1", "sessao-A")).toBe(authorKeyFor("uid-1", "sessao-A"));
  });

  it("não contém o nickname nem o uid em claro", async () => {
    const { authorKeyFor } = await import("@/lib/author-key");
    const key = authorKeyFor("uid-da-alice", "sessao-A");

    expect(key).not.toContain("alice");
    expect(key).not.toContain("uid-da-alice");
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });
});
