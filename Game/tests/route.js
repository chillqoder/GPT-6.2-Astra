// Both Node and browser verification run this controller against production input.
export function runRoute(
  g,
  { optional = false, step = (i) => g.step(i), dismiss = () => g.dismiss(), milestone = () => {} } = {},
) {
  let count = 0, stage = 'Workshop approach';
  const trace = [];
  const advance = (i = {}) => {
    step(i);
    count++;
    if (g.recoveries) throw Error(stage + ': recovery at ' + g.p.x.toFixed(2) + ', ' + g.p.y.toFixed(2));
  };
  function until(test, input = {}, limit = 2000) {
    let n = 0;
    while (!test()) {
      if (n++ >= limit) {
        throw Error(
          stage + ': timed out ' +
            JSON.stringify({
              x: g.p.x,
              y: g.p.y,
              vx: g.p.vx,
              vy: g.p.vy,
              wall: g.p.wall,
              ground: g.p.stand,
              phase: g.platforms.map((p) => p.phase),
              target: g.target()?.action,
            }),
        );
      }
      advance(typeof input === 'function' ? input() : input);
    }
  }
  function wait(n) {
    for (let i = 0; i < n; i++) advance();
  }
  function mark(name) {
    stage = name;
    trace.push({ name, frame: count, x: g.p.x, y: g.p.y });
    milestone(name);
  }
  function go(x, dir = 1) {
    until(() => dir * (g.p.x - x) >= 0, dir > 0 ? { right: true } : { left: true });
  }
  function rest() {
    until(() => g.p.grounded && Math.abs(g.p.vx) < .001, {}, 400);
  }
  function seek(x) {
    if (Math.abs(g.p.x - x) > .45) go(x - (x > g.p.x ? .32 : -.32), Math.sign(x - g.p.x));
    rest();
  }
  function jump(dir = 1) {
    advance({ jumpPress: true, jump: true, right: dir > 0, left: dir < 0 });
  }
  function use(action) {
    const t = g.target();
    if (t?.action !== action) {
      throw Error(
        stage + ': expected ' + action + ' got ' + JSON.stringify(t) + ' at ' + g.p.x + ',' + g.p.y,
      );
    }
    advance({ interact: true });
    if (g.mode === 'archive') dismiss();
  }
  function pulseRelay(id) {
    until(() => g.p.energy >= 35 && g.p.pulseCD === 0);
    advance({ pulsePress: true });
    until(() => g.world.relays.includes(id));
    until(() => g.mode === 'play');
    mark('Relay ' + id + ' online');
  }
  function climb(right, top) {
    const left = right - 3.25;
    go(right - .42);
    rest();
    let side = 1;
    jump(1);
    for (let i = 0; i < 12 && g.p.y < top; i++) {
      until(
        () => g.p.y >= top || (g.p.wall === side && g.p.vy < 3 && !g.p.grounded),
        () => ({ left: side < 0, right: side > 0 }),
      );
      if (g.p.y >= top) break;
      jump(side);
      side *= -1;
    }
    if (right > 180) {
      go(right + .1);
      advance({ right: true, pulsePress: true });
    }
    go(right + .55);
    rest();
    if (g.p.y < top - .1) throw Error('Shaft top missed at ' + left + ' standing at ' + g.p.x + ',' + g.p.y);
  }
  go(8.4);
  jump();
  go(11.9);
  until(() => g.p.grounded, { right: true });
  jump();
  go(15.3);
  until(() => g.p.grounded, { right: true });
  jump();
  go(19.4);
  rest();
  if (optional) {
    mark('Workshop archive');
    go(20.5);
    jump();
    go(23.7);
    rest();
    go(24.36);
    advance({ right: true, dashPress: true });
    go(27);
    rest();
    use('archive');
    seek(28.85);
    use('cache');
  }
  go(30);
  rest();
  mark('Training seam');
  go(30.6);
  advance({ right: true, dashPress: true });
  go(34.4);
  rest();
  mark('Skitter');
  advance({ pulsePress: true });
  wait(38);
  go(36);
  jump();
  go(42.7);
  rest();
  seek(45.6);
  use('pick');
  seek(51.7);
  use('insert');
  seek(55.7);
  pulseRelay('A');
  mark('Reservoir shaft');
  go(74.9);
  climb(76.25, 6.15);
  if (optional) {
    mark('Reservoir archive');
    seek(79);
    go(76.65, -1);
    jump(-1);
    until(() => g.p.y > 8.54, { left: true });
    advance({ left: true, dashPress: true });
    go(72.4, -1);
    rest();
    use('archive');
    jump();
    go(77.15);
    rest();
  }
  seek(80);
  use('switch');
  mark('Reservoir ferry');
  seek(86.3);
  until(() => g.platforms[0].phase < .07);
  go(89.05);
  rest();
  until(() => g.platforms[0].phase > .42 && g.platforms[0].phase < .55);
  jump();
  go(104.3);
  advance({ right: true, pulsePress: true });
  go(105.4);
  rest();
  if (optional) {
    seek(109.3);
    use('cache');
  }
  go(114.9);
  rest();
  seek(117);
  pulseRelay('B');
  mark('Foundry cover');
  go(125.9);
  jump();
  go(127.75);
  rest();
  until(() => g.machines[2].state === 'venting', {}, 1000);
  go(133.4);
  advance({ pulsePress: true });
  go(137.7);
  rest();
  mark('First vent');
  until(() => g.ventState(ventsForRoute[0]) === 'dormant' && (g.time + .3) % 4.5 < 1.3);
  go(143.9);
  rest();
  use('pick');
  seek(149.05);
  use('insert');
  mark('Counterweight lift');
  until(() => g.platforms[1].phase < .06);
  go(152.3);
  rest();
  until(() => g.platforms[1].phase >= .42 && g.platforms[1].phase < .56);
  go(156.1);
  rest();
  use('switch');
  if (optional) {
    mark('Foundry archive');
    go(162.1);
    jump();
    go(164.65);
    rest();
    use('archive');
  }
  mark('Transfer foundry cell');
  go(154.9, -1);
  rest();
  go(149.2, -1);
  rest();
  seek(149.2);
  use('remove');
  seek(167.5);
  use('insert');
  seek(171.15);
  pulseRelay('C');
  mark('Ascent shaft');
  until(() => (g.time + 2) % 4.5 < 1.65);
  go(188.2);
  climb(189.8, 5.6);
  mark('Ascent platform');
  jump(0);
  rest();
  if (optional) {
    mark('Ascent salvage');
    go(190.04, -1);
    jump(-1);
    until(() => g.p.y > 7.98, { left: true });
    advance({ left: true, dashPress: true });
    go(185.8, -1);
    rest();
    use('cache');
    jump();
    go(190.35);
    rest();
    until(() => g.p.energy >= 35);
    advance({ pulsePress: true });
  }
  until(() => g.ventState({ offset: 1.2 }) === 'dormant' && (g.time + 1.2) % 4.5 < 1.65);
  advance({ pulsePress: true });
  go(192.8);
  advance({ right: true, dashPress: true });
  go(195.35);
  rest();
  until(() => g.platforms[2].phase < .04);
  go(197.7);
  rest();
  until(() => g.platforms[2].phase >= .42 && g.platforms[2].phase < .57);
  jump();
  go(204.3);
  rest();
  seek(207.9);
  use('liftConsole');
  mark('Lift boarding');
  until(() => g.mode === 'complete', {}, 650);
  mark('Signal Restored');
  return { trace, frames: count, result: g.result };
}
const ventsForRoute = [{ offset: .3 }];
