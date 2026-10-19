# Cripple Mr Onion

A playable, in-browser version of **Cripple Mr Onion**, the card game Terry Pratchett invented for the Discworld and that Andrew Millard and Terence Tao later turned into real rules.

You play against up to five computer opponents (Rincewind, Granny Weatherwax, Nobby Nobbs and friends). Build groupings that add up to 21, bet on them, and hope nobody cripples your Great Onion.

## Play locally

```sh
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm test` | Rules-engine tests (Vitest) |
| `npm run build` | Type-check and build a static site into `dist/` |
| `npm run preview` | Serve the built site |

The build is a plain static site with relative paths, so `dist/` can be dropped onto GitHub Pages or any static host.

## How the code is laid out

```
src/engine/   Pure TypeScript, no UI
  cards.ts    The eight-suit deck, shuffling, seeded RNG
  groups.ts   Recognising and ranking groupings (Onions, Flushes, Royals, cripplers)
  game.ts     The hand as a state machine: applyAction(state, action) -> state
  ai.ts       Computer opponents
src/ui/       React front end
```

The UI and the AI both drive the game through `applyAction`, so the rules live in one place and are covered by tests.

## Rules

See [RULES.md](RULES.md) for the rules as implemented, including the places where the sources disagree and which reading this version picked.
