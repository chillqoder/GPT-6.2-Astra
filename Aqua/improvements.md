# Prompt: Living Glass Aquarium — Improvement Pass

## Context

`index.html` in this folder already contains a finished, working aquarium: a single self-contained HTML file that renders a procedural 3D tank with Three.js (r164 via CDN import map). It was built from the specification in `aquarium.md`. Read both files before changing anything.

The current scene has a glass tank with refracting water and caustics, a black sponge filter with a bubble plume, a pebble bed, a castle, four plants, four fish (guppy, clownfish, angelfish, betta), one crab walking a route across the bottom, and two snails (one on the bottom, one on the inside of the front glass).

## Goal

Improve the existing aquarium in place. This is an upgrade of `index.html`, not a rewrite: keep everything that already works and looks good, and add or replace only what is listed below. The result must still be one HTML file, fully procedural, with no downloaded models or textures.

The fourteen changes below make the tank feel more alive and more interactive: a real light source above the water, a faster and denser school of small fish, a hideout the crab actually uses, new inhabitants, a glass that gets dirty and is cleaned, a way for the viewer to feed the fish, a day and night switch, fish that react to a tap on the glass, sound, and a control for the filter strength.

Where this document contradicts `aquarium.md` (the fish count, "do not add extra fish", the castle description, the species list), this document wins.

## Rules that still apply

- One HTML file with inline CSS, JavaScript, and shaders. Three.js and its addons stay pinned to the version already used.
- All new geometry, patterns, and effects are generated at runtime. This includes sound: no audio files.
- New interface controls (feed, day/night, sound, filter strength) go into the existing control bar and match the style of the pause and reset buttons. The bar must still fit on a narrow phone screen without covering the tank.
- Each new creature and decoration gets its own named group and construction function, like the existing ones.
- All animation is driven by simulation time and delta time, so the existing pause button freezes every new system too (school, seahorse, clam, food, dirt cleaning, sand puffs, lamp flicker if any).
- New objects must work with the existing render pipeline: they have to appear correctly through the glass and the water surface, receive the underwater tint and caustics, and not break refraction.
- Pool and instance anything that is created repeatedly (school fish, food pellets, mouth bubbles, sand particles). Do not allocate geometry or materials inside the animation loop.
- Keep the frame rate close to what it is now. If something has to give, reduce particle counts before removing features.
- The browser console must stay clean.

---

## 1. Aquarium lamp with a visible reflection and real light

There is currently no light fixture: the scene is lit by invisible directional lights. Add a physical lamp and make the lighting come from it.

- Model a slim aquarium light bar above the open top of the tank: a housing, a glowing diffuser strip on the underside, and thin brackets or legs that hold it on the tank rim. It should look like real equipment, not a glowing box.
- The lamp must be **reflected in the water surface**. When the camera looks at the surface from above or at a grazing angle, the bright strip should be visible as a reflection that breaks up and wobbles with the waves.
- Rework the lighting so the lamp is clearly the main source: the brightest area is under the lamp, light falls off toward the corners and toward the bottom, and shadows of the decorations and animals point away from it.
- Tie the existing caustics to the lamp so the light patterns on the bottom look like they are produced by this light passing through the moving surface.
- Add soft, subtle light shafts under the lamp inside the water. Keep them delicate: the water must stay clear and the fish colors must not be washed out.
- Add faint highlights from the lamp on the glass edges and on the upper rim.
- The lamp must not block the default camera view of the tank.

## 2. Remove the angelfish

Delete the freshwater angelfish (the tall silver fish with dark vertical bands) completely: its model, its swimmer entry, its collision data, and its entry in the "Species key" legend at the bottom of the interface. Nothing should reference it afterwards. The guppy, clownfish, and betta stay as they are.

## 3. Add a school of small fish in its place

Replace the angelfish with a school of small fish that live and move as a group.

- About 12–20 fish, each roughly 0.2–0.3 units long. Pick a small, bright schooling species that reads well at a distance (for example, neon-tetra-like: a slim body with a glowing blue-green stripe and a red rear half). Model them properly at small scale: body, tail, fins, eyes.
- They move as a **real school**: the fish stay together, keep a small distance from each other, align their heading with their neighbours, and follow a shared wandering direction. Use flocking-style steering (cohesion, separation, alignment) rather than moving copies along one path.
- The school must be **noticeably faster than the other fish**: brisk cruising, quick synchronized turns, and occasional sudden darts where the whole group changes direction at once and then settles.
- The group should stretch, compress, and reshape as it turns, and each fish should have slightly different speed, phase, and tail beat so they do not look cloned.
- The school avoids glass walls, the water surface, the bottom, decorations, and the larger fish. When a big fish swims into the group, the school splits around it and re-forms.
- The tail beat of each small fish follows its own speed.
- Add the school to the "Species key" legend in place of the angelfish.

## 4. Replace the castle with a hideout the crab walks through

The current castle must be completely redone. The new ornament has to have a **large gate**, and the crab must use it: walk in, disappear inside, and come out again.

- Design a new centerpiece with a big, clearly visible gateway and a real interior passage that goes all the way through, with an entrance on one side and an exit on another. The opening must be large enough for the whole crab, including its legs and claws, with visible room to spare.
- It may be a new castle with a grand gate, or a different ornament that works better for this (for example a ruined archway or gatehouse, a sunken shipwreck hull with a hole through it, or a rock cave tunnel). Choose whichever gives the best look and the clearest walk-through, and build it with the same level of detail as the rest of the scene: worn surfaces, chips, staining near the base, a foundation partly sunk into the pebbles.
- The interior should be dim but readable: when the camera looks into the gate, the viewer can see the crab inside rather than a black hole.
- Change the crab's route so that passing through the ornament is a regular part of its walk: it approaches the gate, goes inside, sometimes pauses in there for a few seconds, exits through the other opening, wanders across the bottom, and eventually comes back. It should enter from either side over time.
- Keep the crab's existing leg animation, ground contact, and obstacle avoidance working. Update the collision volumes: the walls are solid, the passage is open.
- Fish must not swim through the walls of the new ornament. The small school may pass through the gate only if the whole group fits safely.

## 5. Clam shell with a pearl

Add one clam (a ribbed, scallop-like shell with two halves) resting on the bottom in a visible spot in the foreground or midground, away from the crab's path.

- Two hinged halves with ribs, growth lines, and a soft mantle visible along the opening.
- A glossy pearl sits inside, with a soft iridescent sheen that catches the lamp light.
- Every so often the clam slowly opens, shows the pearl, **releases a small burst of bubbles**, and slowly closes again. Vary the timing so it does not look like a metronome.
- The bubbles are few and small. They rise like the filter bubbles and make small ripples when they reach the surface, reusing the existing bubble and ripple systems.

## 6. Dirty glass that the snail cleans

Make the aquarium slightly dirty so the glass snail has real work to do.

- Add a thin, uneven film of green-brown algae on the inside of the front glass: patchy, denser near the bottom and the corners, clearly visible but light enough that it does not hide the fish.
- As the glass snail crawls, it **wipes the glass clean behind itself**, leaving a clear trail the width of its foot through the film. The trail must follow the snail's real path and stay clean after the snail has moved on.
- The algae slowly grows back over a few minutes, so the snail always has something to clean and the glass never becomes fully clean or fully covered.
- Extend the snail's route so it wanders over a larger part of the front pane (still below the waterline) and its cleaning is easy to notice.
- Store the dirt as a mask (for example a small canvas or render-target texture that the snail paints into) instead of many separate objects.
- The film must sit on the inner surface of the glass and render correctly with the existing glass and water optics.

## 7. One seahorse

Add exactly one seahorse as a new, separately modeled inhabitant.

- Upright posture, curved neck, long snout, a small crest on the head, a ridged, segmented body, a curled prehensile tail, and a small, rapidly fluttering dorsal fin on its back. Warm yellow-orange or similar color that stands out from the plants.
- It swims **upright and slowly**: gentle drifting with a slight bobbing motion, small vertical changes, and slow turns. It should look nothing like the way the fish swim.
- From time to time it hovers near a plant and curls its tail around a stem to rest, then lets go and drifts on.
- It avoids walls, the surface, the bottom, decorations, and the other animals.
- Add it to the "Species key" legend.

## 8. Feeding the fish

Add a way for the viewer to feed the fish, with a full animation of the fish reacting.

- Add a "Feed" button to the existing control bar, in the same style as the pause and reset buttons, and a keyboard shortcut (for example `F`).
- When pressed, a pinch of food falls onto the water surface near the top of the tank: small flakes or pellets that land with tiny ripples, float for a moment, and then slowly sink, drifting with the current.
- The fish notice the food and **swim up to the surface** for it. Each fish heads for a nearby piece, makes a small quick lunge to eat it, and the piece disappears. Different species react in character: the school rushes up quickly as a group, the guppy darts, the clownfish goes steadily, the betta takes its time.
- While eating at the top, the fish **release a few tiny bubbles from their mouths**.
- Pieces that nobody catches keep sinking. Fish follow some of them down, and anything that reaches the bottom is picked up there or fades away after a while, so food never piles up.
- When the food is gone, the fish **swim back down** and return to their normal behavior smoothly, without snapping.
- The crab may react to food that lands near it. The seahorse may slowly pick at a piece that drifts past.
- Pressing the button several times in a row should work sensibly: more food appears up to a reasonable limit, and nothing breaks.

## 9. Mouth bubbles

Independently of feeding, the fish should occasionally release one or two very small bubbles from their mouths during normal swimming, a little more often right after eating at the surface. The bubbles start at the actual mouth position of the fish and rise like the other bubbles. Keep this rare and subtle.

## 10. Sand puffs near the bottom

The bottom is currently a pebble bed. Add fine sand to it so that fish can disturb it.

- Blend patches of fine, pale sand between and around the pebbles so the bottom reads as sand with stones on top, without losing the existing pebble look.
- When a fish swims close to the bottom, especially when it turns sharply, brakes, or picks up food there, a **small cloud of sand dust lifts up** behind it, drifts with the current, and slowly settles.
- The puff strength depends on how fast and how close to the bottom the fish is. A slow pass barely stirs anything, a quick dart leaves a visible trail.
- The crab kicks up very small puffs under its feet as it walks.
- The dust is soft and semi-transparent, lit by the lamp, and never turns the water cloudy.

## 11. Day and night

Add a button that switches the lamp off and on, turning the tank between day and night.

- The change is a smooth transition over a couple of seconds, not an instant cut.
- **Night:** the lamp strip goes dark and its reflection on the water disappears. The tank is lit by a dim, cool blue "moonlight", the caustics become very faint, the light shafts vanish, and the room background gets darker. Everything must stay readable: the viewer can still see every animal.
- **Fish at night:** the guppy, clownfish, and betta slow down, swim lower, and spend more time hovering near the plants and the ornament. The school tightens up and moves calmly instead of darting.
- The bright stripe on the small schooling fish **glows softly in the dark**, so the school is the most eye-catching thing in the night tank. The pearl in the clam also keeps a faint glow.
- The seahorse rests on a plant for most of the night. The crab and the snails stay active.
- **Day:** switching the lamp back on restores the normal lighting, and the fish gradually wake up and return to their usual speed and depth.
- Feeding still works at night; the fish just react more slowly.
- Add a keyboard shortcut (for example `N`) and make the button show which mode is active.

## 12. Reaction to a tap on the glass

Let the viewer interact with the fish by tapping or clicking on the aquarium.

- A short tap or click on the tank (without dragging) counts as a tap on the glass. Dragging must keep rotating the camera exactly as it does now, so tell the two apart by how far and how long the pointer moved.
- Find the point on the glass that was tapped. A small, short-lived ripple mark appears at that spot on the pane.
- Fish close to that point **get startled and dart away** from it. The closer they are, the stronger the reaction. The school scatters and then regroups. Fish far away barely react.
- A few seconds later the fish calm down, and one or two of them **come back out of curiosity** and hover near the tapped spot for a moment before going on with their usual behavior.
- The seahorse only flinches slightly. The crab stops and raises its claws for a moment if the tap was near it. The snails pull in their tentacles briefly.
- Repeated tapping should not break anything: fish stay inside the tank, do not get stuck against the far wall, and do not shake in place.
- Taps on the interface buttons must not count as taps on the glass.

## 13. Sound

Add quiet ambient sound, generated in the browser with the Web Audio API. Do not load any audio files.

- A sound on/off button in the control bar, with a keyboard shortcut (for example `M`). **Sound is off by default** and only starts after the viewer turns it on, because browsers block audio before a user action.
- A soft continuous base layer: the low hum of the filter and the gentle bubbling of the plume.
- Small one-off sounds on top of it: light pops as bubbles reach the surface, a soft patter when food lands on the water, a dull knock when the glass is tapped, and a short bubbling when the clam opens.
- The bubbling follows the filter strength control from section 14: stronger flow is louder and busier, and with the filter off the bubbling stops.
- At night the overall sound becomes slightly quieter and calmer.
- Pausing the aquarium silences the sound, and resuming brings it back. Changes in volume fade in and out; there must be no clicks or sudden jumps.
- Keep the whole mix quiet and pleasant, something that can play in the background for a long time without becoming annoying.

## 14. Filter strength control

Add a slider that controls how hard the filter is running.

- A compact slider in the control bar, from off to maximum, with the current setup as the default middle position.
- The slider changes the **bubble plume**: the number of bubbles per second, their rise speed, and how wide the plume spreads. At zero the bubbles stop within a second or two.
- It also changes the **water current** in the whole tank. With a stronger flow the plants bend and sway more, the suspended particles, food, and sand dust drift faster, and the water surface above the plume is more disturbed, with more ripples. With the filter off the plants hang almost still and the surface calms down.
- **Fish feel the current.** At high flow they are visibly pushed around, especially near the plume, and have to work harder: their tails beat faster when they swim against it, and the small school gets carried and has to fight its way back. At low flow they glide effortlessly.
- Changes are smooth: moving the slider quickly should make the tank respond over a second or two, not jump.
- Even at maximum the fish must still be able to swim anywhere in the tank and must never be pinned to the glass.

---

## Updated scene inventory

| Object | Quantity |
|---|---:|
| Aquarium lamp above the tank | 1 |
| Large fish | 3: guppy, clownfish, betta |
| School of small fish | 1 school of about 12–20 |
| Seahorse | 1 |
| Crab | 1, walking through the new ornament |
| Snails | 2: bottom snail, glass snail that cleans the algae |
| Clam with a pearl | 1 |
| Gate ornament (replaces the old castle) | 1 |
| Plants, filter, pebbles, water, glass | unchanged |

Controls in the bar: pause, reset view, feed, day/night, sound on/off, filter strength slider.

## Acceptance checklist

- [ ] A modeled lamp sits above the tank, its reflection is visible and moving on the water surface, and the scene is visibly lit from it.
- [ ] The angelfish is gone from the tank, the code, and the legend.
- [ ] A school of small fish moves as a group, splits and re-forms around obstacles, and is clearly faster than the guppy, clownfish, and betta.
- [ ] The old castle is replaced by a new ornament with a large gate, and the crab regularly walks in one side and out the other without clipping through walls.
- [ ] A clam opens from time to time, shows a pearl, and releases a few bubbles.
- [ ] The front glass has a visible algae film, the glass snail leaves a clean trail in it, and the film slowly grows back.
- [ ] One seahorse swims upright and occasionally holds on to a plant with its tail.
- [ ] The "Feed" button drops food, the fish rise to the surface to eat it, release small mouth bubbles, and then return down.
- [ ] Fish swimming near the bottom raise small sand puffs that drift and settle.
- [ ] The day/night button smoothly switches the lamp off and on; at night the tank is lit by dim blue light, the fish slow down, and the school's stripes glow.
- [ ] A tap on the glass startles nearby fish, and some of them return to the spot afterwards; dragging still rotates the camera.
- [ ] Sound is off by default, can be turned on and off, is generated without audio files, and goes silent on pause.
- [ ] The filter slider changes the bubble plume, the sway of the plants, the drift of particles, and how hard the fish have to swim; at zero the bubbles stop.
- [ ] All controls fit in the bar on both desktop and narrow screens.
- [ ] Pause freezes every new animation, reset view still works, and the legend matches the animals that are actually in the tank.
- [ ] Everything that worked before still works: refraction, caustics, the filter plume, plants, the three remaining fish, both snails, camera limits, and resizing.
- [ ] No console errors, and the frame rate is close to what it was before the changes.

## How to check the result

Open `index.html` in a browser and watch it for a few minutes instead of judging from the code. Look at the tank from the default view, from both sides, and from above the water. Wait for the crab to complete a full pass through the gate, for the clam to open at least once, and for the snail to leave a visible clean trail. Press "Feed" several times and watch the fish go up and come back down. Switch to night and back. Tap the glass near a fish and near the school. Turn the sound on and move the filter slider from zero to maximum while watching the plants, the bubbles, and the fish. Press pause and confirm that everything new stops moving and the sound goes silent.
