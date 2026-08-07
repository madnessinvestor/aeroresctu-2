# AeroRescue

Catálogo digital de aeronaves para treinamento e consulta rápida de procedimentos de resgate por Bombeiros de Aeródromo (SESCINC).

## Run & Operate

- `pnpm --filter @workspace/aerorescue run dev` — run the frontend catalog (the Replit workflow `Start application` supplies `PORT=5000` and `BASE_PATH=/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/aerorescue/src/App.tsx` — shell, catálogo, ficha da aeronave e navegação.
- `artifacts/aerorescue/src/data/aircraft.ts` — dados tipados das aeronaves catalogadas.
- `artifacts/aerorescue/src/index.css` — tema visual e componentes de interface.
- `artifacts/aerorescue/public/aircraft/AMX-A1/` — conteúdo original do primeiro modelo anexado.

## Architecture decisions

- A primeira entrega usa dados locais e `localStorage` para manter a experiência funcional sem exigir uma conta ou conexão externa.
- O catálogo é organizado por pastas em `public/aircraft`, preservando a separação entre conteúdo operacional e código de interface.
- O modelo anexado foi preservado no formato nativo `.mdl`; a conversão para `.glb` ficou separada para não alterar o arquivo original.

## Product

- Catálogo com pesquisa, filtros, favoritos e histórico recente.
- Ficha do AMX A-1 com visualizador técnico, hotspots, controles de zoom, reset e tela cheia.
- Consulta operacional com alertas para bombeiros, procedimentos, galeria técnica e biblioteca de manuais.

## User preferences

- Interface em português, tema escuro na navegação e foco em consulta rápida para equipes SESCINC.

## Gotchas

- O pacote RAR contém modelos Microsoft Flight Simulator em `.mdl`, não arquivos web `.glb`/`.gltf`; a conversão deve ser feita como etapa própria antes de habilitar Three.js com o modelo real.
- O build manual do Vite precisa de `PORT` e `BASE_PATH`; o workflow já injeta essas variáveis automaticamente.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
