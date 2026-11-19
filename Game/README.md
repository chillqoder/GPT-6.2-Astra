# DEEPWAKE

Guide ILO through a buried research station, restore three resonance relays, and ride the ascent lift to daylight. Each region contains a memory archive and a portable power or traversal puzzle.

## Play locally

Start the included local server from this directory.

```sh
npm start
```

Open [DEEPWAKE on localhost](http://localhost:8841/). A generic static HTTP server can also serve this directory as-is. The playable entry point is `index.html`. Three.js 0.160.1, the artwork, and the synthesizer ship with the project. A Canvas 2D compatibility view uses the same simulation when WebGL is unavailable.

## Controls

| Action | Input |
| --- | --- |
| Move | A / D or Left / Right |
| Jump or wall jump | Space or Z. Hold for height. Hold toward a wall to slide, then press jump again. |
| Dash | Shift or X. A dash breaks amber seams and disables stunned machines. |
| Echo pulse | Q. Costs 35 resonance. Reveals nearby connections, stuns vulnerable machines, and activates powered relays. |
| Use, carry, insert, or place a cell | E |
| Pause or resume | P or Escape |
| Retry the committed checkpoint | R |
| Confirm a menu action | Enter |

Touch controls support movement and a second action together. Sound and fullscreen controls sit in the header. The field manual includes reduced motion. While carrying a cell, ILO can run and jump. Place it to regain dash, wall movement, and pulse.

## Recovery and records

Activate a reboot station to repair integrity, refill resonance, and save the current machinery and discoveries. Each relay automatically commits a checkpoint at its nearby station. A retry restores that snapshot and increments recoveries. Active expedition time carries forward.

**Restart Expedition** in the pause menu starts a fresh run. Completed runs contribute to best time, best full-archive time, and fewest recoveries. Records and settings persist in browser storage when available. Checkpoints last for the current page session.

## Validation

Run the deterministic checks with Node.js 22 or newer.

```sh
npm test
```

For the Chromium integration checks, start the local server and run the following with Playwright CLI installed. Use a fresh named browser session for these checks because they exercise record creation and reload.

```sh
playwright-cli -s=deepwake-test open http://127.0.0.1:8841/
playwright-cli -s=deepwake-test --raw run-code --filename=tests/browser.cjs
playwright-cli -s=deepwake-test close
```

The browser tests exercise actual keyboard and multitouch input, then replay ordinary player inputs through the loaded game's fixed-step simulation for two complete expeditions. The `?verify` query enables the inspection adapter for those checks. See [the feature audit](FEATURE_AUDIT.md) for results and verification limits.
