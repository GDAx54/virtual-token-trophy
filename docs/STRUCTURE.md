# 90x — Estructura del proyecto

> Nota: este scaffold corre sobre **TanStack Start (web)** porque es el stack del
> entorno Lovable. La lógica (esquema, mercados, cálculo de retornos, mock data) es
> 100% portable a **React Native / Expo** — solo cambian los componentes de UI.

```
src/
├─ routes/
│  ├─ __root.tsx                  Shell + providers
│  ├─ index.tsx                   Tab "Inicio" → feed de partidos
│  ├─ leagues.tsx                 Tab "Mis Ligas" + leaderboard realtime
│  ├─ bets.tsx                    Tab "Mis Apuestas" (activas / historial)
│  ├─ profile.tsx                 Tab "Perfil" + bankroll + rescates
│  ├─ _authenticated/             Rutas protegidas
│  └─ api/
│     ├─ public/webhooks/sports.ts   Webhook de la API deportiva (live + final)
│     └─ public/cron/resolve.ts      Cron de resolución de apuestas
├─ components/
│  ├─ MatchCard.tsx               ★ Tarjeta de partido (1X2 + extras)
│  ├─ BetSlip.tsx                 Boleto / combinada
│  ├─ Leaderboard.tsx             Ranking realtime
│  ├─ ShareTicket.tsx             Genera "Story" compartible
│  └─ ui/…                        shadcn
├─ lib/
│  ├─ betting.ts                  ★ Math puro (combinedOdds, potentialPayout, resolveBet)
│  ├─ markets.ts                  Catálogo de market_type → label/parser
│  ├─ sports-api.server.ts        Cliente API-Football / Sportmonks (server-only)
│  ├─ bets.functions.ts           createServerFn: placeBet, listMyBets
│  ├─ leagues.functions.ts        createServerFn: createLeague, joinByCode
│  └─ resolver.server.ts          Lógica de resolución + crédito a bankroll
├─ integrations/supabase/         client / client.server / auth-middleware
└─ styles.css                     Design tokens neón (verde + magenta)

docs/
└─ SCHEMA.sql                     Esquema PostgreSQL completo + RLS
```

## Flujo de resolución de apuestas

1. La API deportiva envía webhook a `/api/public/webhooks/sports` con el final del partido.
2. Se verifica firma HMAC → se actualiza `matches.score` + `matches.stats`.
3. Para cada `market` abierto del partido se calcula `result` (`won`/`lost`/`void`).
4. Para cada `bet` con legs en ese match se llama `resolveBet()` (en `lib/betting.ts`).
5. Si `status = won` se incrementa `league_members.bankroll` con el `payout`.
6. Realtime de Supabase empuja el nuevo ranking a los clientes → animación de confeti.

## Viralidad

- **Rescate por bancarrota**: server fn `claimRescue({ source: 'ad' | 'invite' })` valida y suma 500 tokens.
- **Ticket compartible**: `ShareTicket` renderiza un canvas 1080×1920 con la apuesta + invite code.
- **Push**: Edge cron compara rankings cada X minutos; si alguien supera a un amigo dispara una notif.
