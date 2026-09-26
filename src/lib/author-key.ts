import { createHmac } from "crypto";
import { APP_SECRET } from "@/lib/secret";

// Chave opaca que marca a autoria de um card sem guardar quem escreveu.
// Deriva do uid (aleatório, só existe dentro do cookie httpOnly) e do id da
// retro — nunca do nickname. Consequências:
//   - o banco sozinho não liga card → pessoa;
//   - a mesma pessoa tem chaves diferentes em salas diferentes, então nem dá
//     para correlacionar os cards dela entre retros.
export function authorKeyFor(uid: string, retroSessionId: string): string {
  return createHmac("sha256", APP_SECRET)
    .update(`${uid}:${retroSessionId}`)
    .digest("hex")
    .slice(0, 32);
}
