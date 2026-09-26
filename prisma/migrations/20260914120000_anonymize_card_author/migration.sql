-- Anonimato do card: o banco deixa de guardar quem escreveu.
-- `authorKey` e um HMAC de (uid da sessao do browser + id da retro), entao
-- nao da para ligar card -> pessoa so com acesso ao banco, e a mesma pessoa
-- tem chaves diferentes em salas diferentes.
-- Cards antigos ficam com authorKey vazio (sem dono, ninguem ve como "seu card").

-- AlterTable
ALTER TABLE "RetroCard" DROP COLUMN "author",
ADD COLUMN     "authorKey" TEXT NOT NULL DEFAULT '';
