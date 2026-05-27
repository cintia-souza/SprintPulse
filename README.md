# 🚀 SprintPulse

**Ferramenta colaborativa em tempo real para times ágeis** — Planning Poker e Retrospectivas sem fricção.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwindcss)

---

## 📋 Sobre

SprintPulse é uma aplicação web PWA composta por dois módulos:

| Módulo | Descrição |
|--------|-----------|
| 🃏 **BytePoker** | Planning Poker com votação Fibonacci em tempo real |
| 📝 **PingBack** | Retrospectiva com 3 pilares, votação e plano de ação |

---

## ✨ Funcionalidades

### BytePoker (Planning Poker)
- Votação com sequência Fibonacci (1, 2, 3, 5, 8, 13, 21, ?, ☕)
- Cartas ocultas até o host revelar
- Detecção de consenso com confetti 🎉
- Resumo com média, min/max e distribuição
- Efeitos sonoros via Web Audio API
- Roles: Host (PM/TL) e Dev

### PingBack (Retrospectiva)
- 3 pilares: "O que foi bem", "O que pode melhorar", "Ações"
- Cards anônimos até revelação (exceto Ações, sempre visível)
- Sistema de votação (5 votos por participante)
- Revelação por pilar ou tudo de uma vez
- Plano de Ação com checklist de conclusão
- Migração de ações pendentes para próxima sprint (modal com listagem)
- Sessões organizadas por squad
- Histórico de retros anteriores na home
- Persistência no banco (Neon PostgreSQL)

### Geral
- PWA instalável (funciona offline para assets estáticos)
- Sem cadastro — entrada por nickname
- Compartilhamento por link
- Efeitos sonoros em transições
- Responsivo (mobile-first)
- Dark mode nativo

---

## 🏗️ Arquitetura

```
src/
├── app/
│   ├── api/
│   │   ├── auth/guest/        # Autenticação JWT (guest session)
│   │   ├── poker/[id]/        # API do Planning Poker
│   │   ├── retro/
│   │   │   ├── room/[id]/     # API principal da Retro
│   │   │   ├── cards/         # CRUD de cards (persistido)
│   │   │   └── sessions/      # Listagem de sessões por squad
│   ├── poker/[id]/            # UI do Planning Poker
│   ├── retro/[id]/            # UI da Retrospectiva
│   ├── page.tsx               # Home (listagem + criação)
│   ├── layout.tsx             # Layout com SEO + PWA
│   └── sitemap.ts             # Sitemap dinâmico
├── lib/
│   ├── auth.ts                # JWT sign/verify (jose)
│   ├── prisma.ts              # Prisma client singleton
│   ├── poker-store.ts         # Store in-memory do Poker
│   ├── retro-store.ts         # Store in-memory da Retro
│   ├── retro-sync.ts          # Sync memória ↔ banco (Neon)
│   ├── rate-limit.ts          # Rate limiter por IP
│   └── sanitize.ts            # Sanitização de inputs
├── middleware.ts              # Validação JWT em rotas protegidas
public/
├── manifest.json              # PWA manifest
├── sw.js                      # Service Worker
├── icon.svg                   # Favicon SVG
└── robots.txt                 # SEO crawling rules
```

### Fluxo de dados

```
Cliente (polling 1s) → API Route → In-Memory Store → Resposta JSON
                                         ↓ (em eventos importantes)
                                    Prisma → Neon PostgreSQL
```

- **Poker**: 100% in-memory (efêmero, sem persistência)
- **Retro**: In-memory durante a sessão, persistido no banco ao revelar/concluir

---

## 🛠️ Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript 5 |
| Estilização | Tailwind CSS 4 |
| Banco de dados | PostgreSQL (Neon) |
| ORM | Prisma 6 |
| Autenticação | JWT via jose (httpOnly cookies) |
| Deploy | Vercel |

---

## 🚀 Getting Started

### Pré-requisitos

- Node.js 18+
- Conta no [Neon](https://neon.tech) (PostgreSQL serverless)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/cintia-souza/SprintPulse.git
cd SprintPulse

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env
```

### Variáveis de ambiente

Crie um arquivo `.env` na raiz:

```env
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
JWT_SECRET="sua-chave-secreta-aqui-min-32-chars"
NEXT_PUBLIC_URL="http://localhost:3000"
```

> 💡 Gere um JWT_SECRET seguro: `openssl rand -hex 32`

### Banco de dados

```bash
# Gerar Prisma Client
npx prisma generate

# Aplicar migrations
npx prisma migrate dev

# (Opcional) Visualizar dados
npx prisma studio
```

### Executar

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build
npm start
```

Acesse [http://localhost:3000](http://localhost:3000)

---

## 📦 Deploy (Vercel)

1. Conecte o repositório no [Vercel](https://vercel.com)
2. Configure as variáveis de ambiente no dashboard
3. O deploy é automático a cada push na `main`

> O Neon já funciona nativamente com Vercel (mesma região recomendada: `us-east-1`)

---

## 🔒 Segurança

| Medida | Implementação |
|--------|--------------|
| Headers HTTP | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| Rate Limiting | 100 req/min por IP |
| Input Sanitization | Remoção de `<>`, limite de tamanho |
| Validação | Nickname, role, column validados server-side |
| Cookies | httpOnly, secure, sameSite: lax |
| JWT | Expiração 8h, HS256 |
| Banco | SSL obrigatório (sslmode=require) |
| Crawlers | `/api/` bloqueado no robots.txt |

---

## 🔍 SEO

- Open Graph e Twitter Cards configurados
- JSON-LD structured data (WebApplication)
- Sitemap dinâmico (`/sitemap.xml`)
- robots.txt com regras de crawling
- Meta tags completas (keywords, description, canonical)
- Viewport e theme-color para mobile

---

## 📱 PWA

- Manifest com ícone SVG
- Service Worker com cache network-first
- Instalável em mobile e desktop
- Modo standalone (sem barra do navegador)
- Funciona offline para assets estáticos

---

## 🗂️ Schema do Banco

```prisma
model RetroSession {
  id              String       @id @default(cuid())
  roomId          String       @unique
  squad           String       @default("default")
  phase           String       @default("writing")
  revealedColumns String[]     @default([])
  createdAt       DateTime     @default(now())
  closedAt        DateTime?
  cards           RetroCard[]
}

model RetroCard {
  id         String     @id @default(cuid())
  sessionId  String
  column     CardColumn
  content    String
  author     String
  votes      Int        @default(0)
  completed  Boolean    @default(false)
  migratedTo String?
  createdAt  DateTime   @default(now())
}

enum CardColumn {
  WENT_WELL
  IMPROVE
  ACTION_ITEMS
}
```

---

## 🎮 Como Usar

### Planning Poker

1. Na home, selecione **BytePoker** e crie um ID de sessão
2. Entre como **Host** e compartilhe o link com o time
3. Devs selecionam suas estimativas (cartas ficam ocultas)
4. Host clica em **Revelar Cartas** quando todos votarem
5. Analise o resumo e inicie uma **Nova Rodada**

### Retrospectiva

1. Na home, selecione **PingBack**, informe a squad e crie um ID
2. Entre como **Host** e compartilhe o link
3. Todos escrevem cards nos 3 pilares (cards ficam anônimos)
4. Host revela os pilares e abre a votação (5 votos por pessoa)
5. Host clica em **Concluir Retro** para salvar
6. No Plano de Ação, marque itens como concluídos ou migre para próxima sprint

---

## 🗺️ Roadmap

- [ ] Integração com Jira (importar issues, exportar ações)
- [ ] WebSocket para sync em tempo real (substituir polling)
- [ ] Temas customizáveis por squad
- [ ] Export PDF/CSV do resultado da retro
- [ ] Timer para timebox de escrita
- [ ] Notificações push via Service Worker

---

## 📄 Licença

Este projeto é privado e de uso interno.

---

Feito com 💙 por [Cintia Souza](https://github.com/cintia-souza)
