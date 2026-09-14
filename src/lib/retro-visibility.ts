// Regra única de "o que este viewer pode ver de um card".
//
// Antes isso vivia só no CSS do client, então a API devolvia `author` e o texto
// de todos os cards — um F12 mostrava quem escreveu o quê antes do reveal.
// Aqui o card sai da API já anônimo e já podado.

export interface StoredCard<C extends string = string> {
  id: string;
  column: C;
  content: string;
  authorKey: string;
  votes: number;
  completed: boolean;
  migratedTo: string | null;
}

export interface PublicCard<C extends string = string> {
  id: string;
  column: C;
  votes: number;
  completed: boolean;
  migratedTo: string | null;
  /** Única informação de autoria que sai daqui: se o card é do próprio viewer. */
  isMine: boolean;
  /** Ausente enquanto o card está virado para este viewer. */
  content?: string;
}

export function toPublicCard<C extends string>(
  card: StoredCard<C>,
  revealedColumns: readonly string[],
  viewerAuthorKey: string | null | undefined
): PublicCard<C> {
  // authorKey vazio = card sem dono (ação migrada, ou card anterior ao anonimato).
  const isMine =
    !!viewerAuthorKey && card.authorKey !== "" && card.authorKey === viewerAuthorKey;

  const visible =
    card.column === "ACTION_ITEMS" ||
    revealedColumns.includes(card.column) ||
    isMine;

  return {
    id: card.id,
    column: card.column,
    votes: card.votes,
    completed: card.completed,
    migratedTo: card.migratedTo,
    isMine,
    ...(visible ? { content: card.content } : {}),
  };
}
