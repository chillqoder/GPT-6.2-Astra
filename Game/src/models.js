// Small voxel assemblies use a single indexed mesh per pivot and lighting pass.
// Templates and geometry are shared by every visible instance of a model.
const palette = {
  ceramic: 0xd9d3b6,
  light: 0xfff0ce,
  shade: 0xa6a995,
  lip: 0xb8b69e,
  black: 0x151e25,
  visor: 0x24323a,
  glass: 0x31444a,
  iron: 0x394750,
  grey: 0x607079,
  silver: 0x92a3a3,
  red: 0xab482b,
  rust: 0x7b4938,
  orange: 0xe5813e,
  gold: 0xffb144,
  hot: 0xffe198,
  white: 0xfff9d7,
  darkTeal: 0x245257,
  teal: 0x399594,
  cyan: 0x69edda,
  ice: 0xc0fff2,
  copper: 0x9f7453,
  purple: 0x9587c1,
  lilac: 0xdfcbff,
  ember: 0xff6240,
};
const libraries = new WeakMap();
const corners = [
  [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
  [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
  [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
  [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
];
function library(T) {
  if (!libraries.has(T)) {
    libraries.set(T, {
      templates: new Map(),
      colors: new Map(),
      metal: new T.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: .08 }),
      glow: new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    });
  }
  return libraries.get(T);
}
function pivot(T, parent, name, x = 0, y = 0, z = 0) {
  const node = new T.Group();
  node.name = name;
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}
function boxes(T, node, design) {
  const lib = library(T);
  const batches = [[], []];
  const box = (x, y, z, w, h, d, c, emits = false) => batches[+emits].push([x, y, z, w, h, d, c]);
  design(box);
  batches.forEach((parts, pass) => {
    if (!parts.length) return;
    const pos = [], normal = [], color = [], indices = [];
    for (const [x, y, z, w, h, d, c] of parts) {
      if (!lib.colors.has(c)) lib.colors.set(c, new T.Color(palette[c] ?? c));
      const { r, g, b } = lib.colors.get(c);
      for (const [n, quad] of corners) {
        const i = pos.length / 3;
        for (const [a, e, f] of quad) {
          pos.push(x + a * w / 2, y + e * h / 2, z + f * d / 2);
          normal.push(...n);
          color.push(r, g, b);
        }
        indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(normal, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(color, 3));
    geo.setIndex(indices);
    const mesh = new T.Mesh(geo, pass ? lib.glow : lib.metal);
    mesh.castShadow = !pass;
    mesh.receiveShadow = !pass;
    node.add(mesh);
  });
}
function lens(b, x, y, z, size, base = 'gold', core = 'hot') {
  b(x, y, z, size, size * .55, .012, base, true);
  b(x, y, z + .001, size * .74, size * .82, .012, base, true);
  b(x, y, z + .002, size * .44, size, .012, base, true);
  b(x, y, z + .009, size * .57, size * .52, .011, core, true);
  b(x - size * .13, y + size * .12, z + .016, size * .17, size * .16, .01, 'white', true);
}
function foot(b, side) {
  b(0, -.007, .038, .25, .076, .31, 'black');
  b(0, .034, .025, .25, .07, .275, 'shade');
  b(0, .066, .067, .222, .064, .20, 'ceramic');
  b(0, .072, .143, .18, .027, .061, 'light');
  b(side * .119, .047, .029, .012, .033, .108, 'copper');
  for (const z of [-.05, .018, .09]) b(side * .126, -.018, z, .008, .025, .025, 'grey');
}
function robotModel(T) {
  const root = new T.Group();
  const body = pivot(T, root, 'body');
  boxes(T, body, (b) => {
    b(0, .65, 0, .42, .16, .31, 'iron');
    b(0, .73, 0, .47, .19, .33, 'shade');
    b(0, .848, 0, .52, .23, .37, 'ceramic');
    b(0, .928, -.012, .44, .11, .34, 'light');
    b(0, .675, .17, .41, .058, .055, 'black');
    b(.115, .675, .206, .075, .047, .023, 'copper');
    b(.026, .821, .195, .287, .176, .032, 'iron');
    b(.027, .821, .218, .236, .129, .025, 'darkTeal');
    const bars = [.028, .054, .09, .048, .021];
    bars.forEach((h, i) => b(-.042 + i * .035, .82, .234, .021, h, .012, 'cyan', true));
    for (let i = 0; i < 3; i++) b(-.181, .866 - i * .033, .19, .039, .014, .018, 'grey');
    b(0, .803, -.205, .36, .24, .115, 'rust');
    b(0, .848, -.274, .29, .055, .035, 'copper');
    b(0, .99, 0, .25, .12, .24, 'black');
    b(-.01, .969, .006, .503, .073, .349, 'red');
    b(-.068, .942, .028, .36, .05, .333, 'orange');
    b(-.206, .916, .11, .112, .113, .191, 'red');
    b(-.205, .94, .215, .06, .052, .016, 'copper');
  });
  const cape = pivot(T, body, 'cape', -.18, .955, -.142);
  boxes(T, cape, (b) => {
    b(-.011, -.09, -.065, .226, .18, .075, 'red');
    b(-.017, -.231, -.098, .20, .106, .062, 'red');
    b(-.04, -.309, -.117, .157, .064, .057, 'rust');
    b(-.063, -.359, -.132, .111, .041, .049, 'red');
    b(-.011, -.183, -.139, .19, .037, .024, 'orange');
  });
  const head = pivot(T, body, 'head', 0, 1.198, -.008);
  boxes(T, head, (b) => {
    // Stepped ceramic shell, dark gasket and recessed wraparound optics.
    b(0, -.012, -.031, .796, .418, .51, 'shade');
    b(0, -.017, -.023, .846, .335, .525, 'ceramic');
    b(0, .024, -.015, .873, .261, .522, 'ceramic');
    b(0, .14, -.014, .802, .141, .507, 'ceramic');
    b(-.006, .206, -.026, .721, .063, .448, 'light');
    b(-.008, .241, -.045, .561, .014, .326, 'lip');
    b(0, -.202, -.008, .703, .071, .431, 'ceramic');
    b(0, -.236, -.009, .535, .027, .344, 'lip');
    b(0, -.023, .238, .797, .282, .078, 'iron');
    b(0, -.025, .269, .74, .316, .052, 'iron');
    b(0, -.018, .297, .72, .252, .034, 'black');
    b(0, -.022, .291, .761, .185, .038, 'black');
    b(-.014, .075, .316, .63, .016, .008, 'glass');
    b(-.269, -.095, .315, .128, .014, .009, 'visor');
    b(.124, -.012, .315, .231, .229, .013, 'glass');
    b(.124, -.012, .323, .259, .156, .015, 'visor');
    lens(b, .125, -.012, .334, .192);
    b(-.228, .003, .32, .069, .019, .012, 'silver');
    b(-.162, .003, .32, .033, .019, .012, 'grey');
    b(-.24, -.042, .319, .031, .014, .009, 'darkTeal');
    b(-.197, -.042, .319, .028, .014, .009, 'teal');
    b(0, .148, .23, .802, .066, .117, 'light');
    b(0, .112, .282, .731, .023, .040, 'shade');
    b(-.288, .148, .291, .115, .016, .009, 'lip');
    b(-.216, .148, .291, .013, .016, .009, 'rust');
    b(.328, -.178, .245, .063, .009, .017, 'grey');
    for (const s of [-1, 1]) {
      b(s * .427, -.004, -.037, .083, .229, .258, 'iron');
      b(s * .47, .002, -.035, .048, .176, .198, s < 0 ? 'orange' : 'shade');
      b(s * .496, .004, -.036, .012, .107, .125, s < 0 ? 'rust' : 'lip');
      b(s * .505, .005, -.036, .016, .048, .062, 'grey');
      b(s * .375, .151, .123, .075, .048, .03, 'shade');
    }
    for (let i = 0; i < 3; i++) b(.18 + i * .064, .241, -.004, .035, .009, .116, 'grey');
  });
  const ant = pivot(T, head, 'antenna', -.267, .205, -.117);
  boxes(T, ant, (b) => {
    b(0, .021, 0, .094, .058, .093, 'iron');
    b(-.011, .085, 0, .031, .098, .027, 'grey');
    b(-.031, .153, 0, .032, .055, .028, 'copper');
    b(-.047, .181, 0, .052, .039, .048, 'gold', true);
  });
  for (const s of [-1, 1]) {
    const hip = pivot(T, body, 'hip' + s, .135 * s, .608, 0);
    boxes(T, hip, (b) => {
      b(0, -.057, 0, .138, .155, .152, 'black');
      b(0, -.159, .001, .135, .13, .123, 'grey');
      b(0, -.143, .044, .158, .142, .095, 'shade');
      b(0, -.139, .091, .117, .096, .026, 'ceramic');
    });
    const knee = pivot(T, hip, 'knee' + s, 0, -.233, .004);
    boxes(T, knee, (b) => {
      b(0, -.015, 0, .163, .102, .162, 'black');
      b(s * .083, -.014, 0, .023, .067, .07, 'copper');
      b(0, -.134, 0, .093, .19, .102, 'grey');
      b(0, -.121, .034, .131, .128, .088, 'iron');
      b(0, -.135, .084, .093, .058, .02, 'ceramic');
      b(0, -.224, 0, .12, .052, .12, 'black');
    });
    const ankle = pivot(T, knee, 'ankle' + s, 0, -.318, 0);
    boxes(T, ankle, (b) => foot(b, s));
    const arm = pivot(T, body, 'arm' + s, .299 * s, .899, -.012);
    boxes(T, arm, (b) => {
      b(0, -.012, 0, .15, .147, .155, 'black');
      b(s * .012, .008, 0, .174, .127, .193, s < 0 ? 'orange' : 'ceramic');
      b(s * .024, .058, 0, .131, .055, .145, s < 0 ? 'red' : 'light');
      b(0, -.132, 0, .098, .14, .106, 'grey');
    });
    const elbow = pivot(T, arm, 'elbow' + s, 0, -.191, 0);
    boxes(T, elbow, (b) => {
      b(0, -.009, 0, .123, .099, .134, 'black');
      b(0, -.077, .008, .134, .095, .133, 'shade');
      b(0, -.124, .012, .139, .067, .14, 'ceramic');
      b(s * .006, -.188, .018, .127, .068, .111, 'iron');
      b(s * .032, -.234, .024, .06, .07, .088, 'black');
      b(-s * .042, -.22, .058, .04, .071, .065, 'grey');
    });
  }
  return root;
}
function copyModel(T, kind, create) {
  const { templates } = library(T);
  if (!templates.has(kind)) templates.set(kind, create());
  const root = templates.get(kind).clone(true), parts = {};
  root.traverse((obj) => {
    if (obj.name) parts[obj.name] = obj;
  });
  root.userData.parts = parts;
  return root;
}
export function makeRobot(T) {
  const group = copyModel(T, 'ILO', () => robotModel(T));
  const p = group.userData.parts;
  let yaw = .38, stride = 0;
  function animate(s = {}, t = 0, dt = 1 / 60) {
    const vx = s.vx || 0, vy = s.vy || 0, f = s.facing < 0 ? -1 : 1, title = s.mode === 'title';
    const run = Math.min(1, Math.abs(vx) / 6.5), airborne = s.grounded === false && !title;
    const dash = !!s.dash, wall = !!s.wall && airborne, carry = !!s.carry;
    const signal = s.pulse || s.action === 'relay' || s.action === 'socket' || s.action === 'lift';
    const down = s.mode === 'shutdown', arrive = s.mode === 'liftSequence';
    stride += Math.max(0, Math.min(.1, dt)) * (2 + run * 12);
    const gait = airborne || dash || down ? 0 : Math.sin(stride) * run;
    const lean = dash ? .28 : down ? .4 : wall ? -.09 : s.action === 'hurt' ? -.19 : run * .10;
    const look = title ? -.25 + Math.sin(t * .31) * .09 : f * (carry ? .47 : .68);
    yaw += (look - yaw) * (1 - Math.exp(-Math.max(0, dt) * 15));
    p.body.rotation.set(lean, yaw, down ? -.12 : 0);
    p.body.position.y = (1 - Math.cos(stride * 2)) * .019 * run + (title ? Math.sin(t * 1.8) * .009 : 0) -
      (s.action === 'land' ? .05 : 0) - (down ? .09 : 0) -
      (s.mode === 'reboot' ? Math.max(0, s.transition || 0) * .21 : 0);
    p.head.rotation.set(
      down ? .48 : airborne ? Math.max(-.12, Math.min(.15, -vy * .011)) : Math.sin(t * 1.46) * .022,
      title ? Math.sin(t * .39) * .17 : f * .08,
      title ? -.052 + Math.sin(t * .9) * .016 : 0,
    );
    p.antenna.rotation.z = Math.sin(t * (run ? 12 : 2.5)) * (run ? .095 : .041);
    p.cape.rotation.x = -(.10 + run * .28 + Math.sin(t * 3.1) * .041 + (dash ? .42 : 0));
    for (const side of [-1, 1]) {
      const hip = p['hip' + side], knee = p['knee' + side], ankle = p['ankle' + side];
      const arm = p['arm' + side], elbow = p['elbow' + side];
      hip.rotation.x = gait * side * .71 + (airborne ? (side * f > 0 ? -.40 : .23) : 0) + (down ? -.36 : 0);
      knee.rotation.x = Math.max(0, -gait * side) * .8 + (airborne ? .38 : 0) + (down ? .63 : 0);
      ankle.rotation.x = -(hip.rotation.x + knee.rotation.x) * .7;
      arm.rotation.x = carry ? -1.09 : wall ? -1.7 : signal ? -1.06 : -gait * side * .62 + (dash ? .75 : 0);
      arm.rotation.z = side * (carry ? -.11 : wall ? -.19 : airborne ? .26 : arrive ? .25 : .09);
      elbow.rotation.x = carry ? -.53 : signal ? -.52 : -.14 - Math.max(0, gait * side) * .3;
    }
  }
  animate({ mode: 'title' }, 0, 1);
  return { group, animate };
}
function pedestal(b, width, depth) {
  b(0, .05, 0, width, .10, depth, 'black');
  b(0, .131, 0, width * .91, .09, depth * .91, 'iron');
  for (const s of [-1, 1]) b(s * width * .39, .115, depth * .39, .065, .092, .062, 'copper');
}
function plate(T, parent, name, x, y, z, width, height, depth, c) {
  const joint = pivot(T, parent, name, x, y, z);
  boxes(T, joint, (b) => b(0, 0, 0, width, height, depth, c));
  return joint;
}
function indicator(T, parent, x, y, z, size = 1) {
  const lit = pivot(T, parent, 'powered', x, y, z);
  boxes(T, lit, (b) => {
    b(0, 0, 0, .16 * size, .044 * size, .018, 'cyan', true);
    b(-.061 * size, 0, .009, .037 * size, .044 * size, .009, 'ice', true);
  });
  lit.visible = false;
}
function propModel(T, kind) {
  const root = new T.Group();
  const base = pivot(T, root, 'frame');
  switch (kind) {
    case 'cell':
      boxes(T, base, (b) => {
        b(0, .045, 0, .40, .09, .31, 'iron');
        b(0, .135, 0, .356, .16, .293, 'copper');
        b(0, .24, 0, .36, .205, .295, 'gold', true);
        b(0, .227, .003, .393, .145, .242, 'orange');
        b(0, .245, .15, .194, .134, .012, 'hot', true);
        b(0, .373, 0, .394, .08, .30, 'iron');
        for (const s of [-1, 1]) {
          b(s * .16, .215, 0, .055, .30, .32, 'shade');
          b(s * .173, .352, .023, .075, .057, .264, 'copper');
          b(s * .112, .442, 0, .048, .104, .064, 'copper');
        }
        b(0, .504, 0, .273, .046, .065, 'grey');
        b(0, .505, .004, .147, .055, .07, 'black');
      });
      break;
    case 'socket':
      boxes(T, base, (b) => {
        pedestal(b, .95, .65);
        b(0, .229, 0, .75, .14, .51, 'copper');
        b(0, .304, 0, .582, .054, .392, 'black');
        for (const s of [-1, 1]) {
          b(s * .357, .364, -.018, .124, .247, .491, 'iron');
          b(s * .357, .497, -.02, .127, .044, .403, 'shade');
          b(s * .357, .39, .234, .072, .092, .018, 'orange');
        }
        b(0, .305, -.198, .39, .103, .055, 'darkTeal');
        b(0, .213, .267, .22, .079, .032, 'black');
      });
      indicator(T, base, 0, .213, .289);
      break;
    case 'switch':
    case 'liftConsole': {
      const console = kind === 'liftConsole', panel = pivot(T, base, 'panel', 0, .78, 0);
      boxes(T, base, (b) => {
        pedestal(b, .66, .48);
        b(0, .48, 0, .245, .67, .23, 'iron');
        b(-.117, .47, .012, .059, .53, .11, 'copper');
        b(.051, .45, .124, .03, .43, .015, 'teal');
      });
      boxes(T, panel, (b) => {
        b(0, .04, 0, .53, .39, .215, 'shade');
        b(0, .04, .11, .452, .309, .05, 'black');
        b(0, .226, 0, .528, .077, .24, 'ceramic');
        b(0, -.154, .059, .528, .073, .23, 'copper');
        if (console) {
          b(0, .073, .142, .344, .198, .012, 'darkTeal');
          b(0, .078, .15, .03, .125, .011, 'cyan', true);
          b(-.031, .106, .15, .035, .032, .011, 'cyan', true);
          b(.031, .106, .15, .035, .032, .011, 'cyan', true);
          b(0, .139, .15, .034, .032, .011, 'ice', true);
        } else {
          b(0, .065, .14, .218, .15, .052, 'iron');
          b(0, .035, .192, .077, .14, .063, 'copper');
          b(0, .109, .205, .155, .068, .087, 'orange');
        }
      });
      indicator(T, panel, 0, -.076, .143, .8);
      break;
    }
    case 'archive': {
      boxes(T, base, (b) => {
        pedestal(b, .53, .42);
        b(0, .185, 0, .281, .091, .26, 'iron');
        for (const s of [-1, 1]) b(s * .17, .227, 0, .05, .112, .203, 'teal');
      });
      const core = pivot(T, base, 'float', 0, .50, 0);
      boxes(T, core, (b) => {
        b(0, 0, 0, .281, .348, .113, 'purple');
        b(0, .005, .061, .213, .276, .037, 'black');
        b(-.035, .045, .084, .099, .104, .015, 'lilac', true);
        b(.052, .046, .084, .027, .108, .015, 'purple');
        b(0, -.071, .084, .147, .03, .015, 'lilac', true);
        b(-.012, .143, 0, .188, .039, .149, 'silver');
        for (const s of [-1, 1]) b(s * .133, -.035, .006, .027, .20, .145, 'ceramic');
      });
      break;
    }
    case 'cache':
      boxes(T, base, (b) => {
        b(0, .057, 0, .66, .105, .436, 'black');
        b(0, .211, 0, .609, .235, .406, 'copper');
        b(0, .352, -.005, .635, .092, .435, 'shade');
        b(0, .402, -.015, .528, .04, .356, 'grey');
        for (const s of [-1, 1]) b(s * .218, .236, 0, .076, .321, .435, 'iron');
        b(0, .235, .219, .141, .128, .045, 'black');
        b(0, .248, .246, .075, .062, .012, 'cyan', true);
      });
      break;
    case 'relay': {
      boxes(T, base, (b) => {
        pedestal(b, 1.24, .79);
        b(0, .232, 0, 1.05, .168, .63, 'grey');
        b(0, .352, 0, .83, .103, .47, 'iron');
        b(0, .272, .335, .363, .095, .024, 'black');
        for (const s of [-1, 1]) {
          b(s * .408, .554, -.02, .211, .43, .39, 'black');
          b(s * .466, .768, -.032, .148, .48, .31, 'copper');
          b(s * .404, 1.085, -.05, .146, .22, .293, 'iron');
          b(s * .357, 1.223, -.05, .128, .105, .236, 'shade');
          for (let i = 0; i < 3; i++) b(s * .464, .578 + .106 * i, .132, .156, .044, .071, 'rust');
        }
      });
      const core = pivot(T, base, 'float', 0, .91, 0);
      core.rotation.z = Math.PI / 4;
      boxes(T, core, (b) => {
        b(0, 0, 0, .385, .385, .25, 'copper');
        b(0, 0, .13, .324, .324, .091, 'darkTeal');
        b(0, 0, .181, .208, .208, .031, 'teal', true);
        b(0, 0, .199, .101, .101, .016, 'ice', true);
        for (const s of [-1, 1]) b(s * .161, 0, -.06, .104, .32, .26, 'shade');
      });
      indicator(T, base, 0, .272, .355, 1.5);
      break;
    }
    case 'station':
      boxes(T, base, (b) => {
        pedestal(b, .93, .64);
        b(0, .33, 0, .60, .381, .38, 'iron');
        b(0, .664, -.012, .52, .498, .319, 'ceramic');
        b(0, .917, 0, .626, .122, .423, 'shade');
        b(0, .985, -.025, .50, .048, .307, 'light');
        b(0, .693, .158, .385, .279, .036, 'black');
        b(0, .694, .182, .299, .21, .018, 'darkTeal');
        b(0, .694, .199, .053, .152, .019, 'cyan', true);
        b(0, .694, .2, .155, .052, .019, 'cyan', true);
        b(0, .431, .192, .625, .093, .082, 'grey');
        b(-.143, .439, .237, .115, .037, .018, 'gold', true);
        for (let i = 0; i < 3; i++) b(-.16 + i * .1, .274, .194, .06, .038, .013, 'black');
        b(-.33, .351, 0, .059, .252, .17, 'copper');
        b(.325, .402, -.015, .059, .296, .193, 'teal');
      });
      indicator(T, base, .12, .439, .24, .64);
      break;
    case 'skitter': {
      boxes(T, base, (b) => {
        b(0, .285, 0, .706, .193, .294, 'black');
        b(-.05, .397, -.012, .601, .125, .337, 'grey');
        b(-.057, .472, -.025, .40, .048, .267, 'copper');
        b(.256, .365, 0, .205, .146, .263, 'rust');
        b(.031, .294, .158, .419, .095, .071, 'visor');
        b(-.406, .219, -.069, .194, .047, .066, 'black');
        b(-.537, .154, -.067, .112, .104, .057, 'iron');
        b(-.641, .114, -.076, .154, .045, .064, 'black');
      });
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const leg = pivot(T, base, `leg${s}/${i}`, (i - 1) * .232, .265, s * .118);
          boxes(T, leg, (b) => {
            b(0, -.025, s * .062, .072, .087, .146, 'copper');
            b((i - 1) * .036, -.091, s * .127, .075, .12, .052, 'grey');
            b((i - 1) * .058, -.164, s * .142, .039, .085, .05, 'black');
            b((i - 1) * .06, -.221, s * .163, .055, .046, .095, 'shade');
          });
        }
      }
      break;
    }
    case 'drone': {
      const orb = pivot(T, base, 'orb', 0, .257, 0);
      orb.rotation.z = Math.PI / 4;
      boxes(T, orb, (b) => {
        b(0, 0, 0, .39, .39, .35, 'shade');
        b(0, 0, .17, .302, .302, .096, 'iron');
        b(0, 0, .226, .193, .193, .043, 'black');
        b(-.165, 0, 0, .12, .273, .30, 'ceramic');
        b(.165, 0, 0, .12, .273, .30, 'copper');
      });
      for (let i = 0; i < 3; i++) {
        const wing = pivot(T, base, 'plate' + i);
        boxes(T, wing, (b) => {
          b(0, 0, 0, .136, .258, .111, 'iron');
          b(0, .012, .045, .096, .192, .059, 'shade');
          b(0, .064, .079, .067, .037, .016, 'teal', true);
        });
      }
      break;
    }
    case 'sentinel': {
      boxes(T, base, (b) => {
        b(.156, .43, -.122, .912, .781, .244, 'iron');
        b(.036, .446, 0, .803, .618, .352, 'black');
        b(-.425, .441, 0, .226, .287, .398, 'rust');
        b(-.534, .443, 0, .066, .193, .309, 'ember', true);
        b(.02, .42, .193, .521, .317, .041, 'rust');
        b(.02, .42, .221, .372, .174, .043, 'ember', true);
        b(-.04, .045, 0, .708, .085, .369, 'copper');
      });
      for (const s of [-1, 1]) {
        const panel = plate(T, base, 'armor' + s, s * .193, .429, .271, .389, .483, .113, 'grey');
        boxes(T, panel, (b) => {
          b(0, .164, .066, .343, .051, .033, 'ceramic');
          for (let i = 0; i < 3; i++) b(-.095 + .093 * i, -.137, .067, .034, .089, .028, 'iron');
        });
      }
      break;
    }
    default:
      throw new RangeError(`Unknown voxel prop ${kind}`);
  }
  if (['skitter', 'drone', 'sentinel'].includes(kind)) {
    const isSkitter = kind === 'skitter', isDrone = kind === 'drone';
    const x = isSkitter ? .031 : 0,
      y = isSkitter ? .294 : isDrone ? .257 : .606,
      z = isSkitter ? .201 : isDrone ? .255 : .345;
    for (
      const [id, c, core] of [['sensor', 'gold', 'hot'], ['stun', 'cyan', 'ice'], ['danger', 'ember', 'hot']]
    ) {
      const eye = pivot(T, base, id, x, y, z);
      boxes(T, eye, (b) => {
        if (isDrone) lens(b, 0, 0, 0, .129, c, core);
        else {
          b(0, 0, 0, isSkitter ? .336 : .205, .041, .018, c, true);
          b(-.063, 0, .012, .074, .036, .012, core, true);
        }
      });
      eye.visible = id === 'sensor';
    }
  }
  return root;
}
export function makeProp(T, kind) {
  const group = copyModel(T, kind, () => propModel(T, kind));
  updateProp(T, group, kind, {});
  return group;
}
export function updateProp(T, group, kind, { powered = false, active = false, state = '', time = 0 } = {}) {
  const p = group.userData.parts;
  if (p.powered) p.powered.visible = !!powered;
  if (p.float) {
    const relay = kind === 'relay';
    p.float.position.y = (relay ? .91 : .50) + Math.sin(time * (powered ? 3 : 1.8)) * (relay ? .045 : .071);
    p.float.rotation.y = Math.sin(time * (powered ? 1.4 : .75)) * (relay ? .65 : .4);
  }
  if (!p.sensor) return;
  const dead = state === 'disabled', stun = state === 'stunned';
  const danger = ['alert', 'lunge', 'aim', 'fire', 'warning', 'firing'].includes(state);
  p.sensor.visible = !stun && !dead && !danger;
  p.stun.visible = stun;
  p.danger.visible = danger;
  if (kind === 'sentinel') {
    for (const s of [-1, 1]) p['armor' + s].position.x = s * (state === 'venting' || dead ? .365 : .193);
    p.frame.rotation.z = dead ? .06 : 0;
    return;
  }
  if (kind === 'skitter') {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const leg = p[`leg${s}/${i}`];
        leg.rotation.z = dead
          ? .19 * s
          : stun || state === 'dormant'
          ? 0
          : Math.sin(time * (state === 'lunge' ? 24 : 10) + i * 2 + s) * .22;
      }
    }
    p.frame.scale.y = dead ? .62 : state === 'alert' ? .82 : 1;
  } else {
    for (let i = 0; i < 3; i++) {
      const a = (stun || dead ? 0 : time * .98) + i * 2 * Math.PI / 3;
      p['plate' + i].position.set(Math.cos(a) * .369, .284 + Math.sin(a) * .267, Math.sin(a) * .112);
      p['plate' + i].rotation.z = a - .14;
    }
    p.frame.rotation.z = stun ? .22 : dead ? .5 : Math.sin(time * .78) * .044;
  }
}
