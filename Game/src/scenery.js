// The fabricated backgrounds use their own baked light so that distant details
// retain their value hierarchy as the gameplay lights change.
export function buildScenery(T, scene) {
  const root = new T.Group();
  root.name = 'Sanctuary scenery';
  scene.add(root);
  let seed = 0x4b248799;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const between = (a, b) => a + (b - a) * rand();
  const choose = (list) => list[Math.floor(rand() * list.length)];
  const color = (value) => new T.Color(value);
  const temp = new T.Object3D();
  const chunks = new Map();
  const chunkAt = (x) => {
    const n = Math.floor(x / 16);
    if (!chunks.has(n)) {
      const group = new T.Group();
      root.add(group);
      chunks.set(n, { group, n, batches: new Map() });
    }
    return chunks.get(n);
  };

  // Slight mineral grain and ledge striations stay aligned to each rock face.
  const texels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    let streak = 0;
    for (let x = 0; x < 32; x++) {
      if (rand() < 0.12) streak = between(-15, 6);
      const v = Math.max(200, Math.min(255, 245 + streak + between(-4, 4)));
      const i = 4 * (y * 32 + x);
      texels.set([v, v, v, 255], i);
    }
  }
  const texture = new T.DataTexture(texels, 32, 32, T.RGBAFormat);
  texture.magFilter = T.NearestFilter;
  texture.minFilter = T.NearestFilter;
  texture.needsUpdate = true;

  const cube = new T.BoxGeometry(1, 1, 1);
  const faces = cube.getAttribute('normal');
  const faceColors = [];
  for (let n = 0; n < faces.count; n++) {
    const y = faces.getY(n), x = faces.getX(n), z = faces.getZ(n);
    // Crisp upper rim, indigo unlit side, reflected teal on front planes.
    if (y > 0.5) faceColors.push(1.18, 1.28, 1.3);
    else if (y < -0.5) faceColors.push(.37, .4, .47);
    else if (x > .5) faceColors.push(.55, .61, .7);
    else if (z < -.5) faceColors.push(.54, .58, .65);
    else faceColors.push(.86, .95, 1.04);
  }
  cube.setAttribute('color', new T.Float32BufferAttribute(faceColors, 3));
  const stoneMat = new T.MeshBasicMaterial({ vertexColors: true, map: texture, fog: false });
  const solidMat = new T.MeshBasicMaterial({ vertexColors: true, fog: false });
  const specs = { rock: [cube, stoneMat], solid: [cube, solidMat], piston: [cube, solidMat] };

  // Irregular five-sided quartz shafts with chisel points, prism striations,
  // and a different tint on every face. No transparent sorting is needed.
  const points = [], tones = [];
  const edge = [[.08, .51], [-.41, .29], [-.45, -.29], [.11, -.51], [.48, -.16], [.45, .24]];
  const shade = [.85, .48, .45, .68, .78, 1.05];
  function tri(a, b, c, ka, kb, kc) {
    points.push(...a, ...b, ...c);
    for (const light of [ka, kb, kc]) tones.push(light, light, light);
  }
  for (let i = 0; i < edge.length; i++) {
    const j = (i + 1) % edge.length, k = shade[i];
    const vert = (index, y, r) => [edge[index][0] * r, y, edge[index][1] * r];
    const a = vert(i, 0, .72), b = vert(j, 0, .72), c = vert(j, .22, 1), d = vert(i, .22, 1);
    const e = vert(i, .78 + (i % 2) * .05, 1), f = vert(j, .78 + (j % 2) * .05, 1);
    const tip = [.10, 1, -.05];
    tri(a, b, c, k * .28, k * .28, k * .7);
    tri(a, c, d, k * .28, k * .7, k * .7);
    tri(d, c, f, k * .7, k * .7, k);
    tri(d, f, e, k * .7, k, k);
    tri(e, f, tip, k * 1.18, k * 1.18, k * 1.85);
  }
  const quartz = new T.BufferGeometry();
  quartz.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  quartz.setAttribute('color', new T.Float32BufferAttribute(tones, 3));
  const quartzMat = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, fog: false });
  specs.crystal = [quartz, quartzMat];

  function place(type, x, y, z, w, h, d, tint, rx = 0, ry = 0, rz = 0) {
    const chunk = chunkAt(x);
    const batch = type + (z < -13 ? ':far' : '');
    if (!chunk.batches.has(batch)) chunk.batches.set(batch, []);
    temp.position.set(x, y, z);
    temp.rotation.set(rx, ry, rz);
    temp.scale.set(w, h, d);
    temp.updateMatrix();
    chunk.batches.get(batch).push([temp.matrix.clone(), color(tint)]);
  }
  const box = (x, y, z, w, h, d, tint, rx = 0, ry = 0, rz = 0) =>
    place('solid', x, y, z, w, h, d, tint, rx, ry, rz);
  const rock = (x, y, z, w, h, d, tint) => place('rock', x, y, z, w, h, d, tint);
  function girder(x0, y0, z0, x1, y1, z1, width, depth, tint) {
    const a = new T.Vector3(x0, y0, z0), delta = new T.Vector3(x1, y1, z1).sub(a);
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize());
    const r = new T.Euler().setFromQuaternion(q);
    box(
      x0 + delta.x / 2,
      y0 + delta.y / 2,
      z0 + delta.z / 2,
      width,
      delta.length(),
      depth,
      tint,
      r.x,
      r.y,
      r.z,
    );
  }

  const sz = 64, haloData = new Uint8Array(sz * sz * 4);
  for (let y = 0; y < sz; y++) {
    for (let x = 0; x < sz; x++) {
      const rr = ((x + 0.5) / sz * 2 - 1) ** 2 + ((y + 0.5) / sz * 2 - 1) ** 2;
      const i = (y * sz + x) * 4;
      haloData.set([255, 255, 255, Math.round(255 * Math.exp(-5 * rr) * Math.max(0, 1 - rr) ** 2)], i);
    }
  }
  const haloTex = new T.DataTexture(haloData, sz, sz, T.RGBAFormat);
  haloTex.magFilter = T.LinearFilter;
  haloTex.minFilter = T.LinearFilter;
  haloTex.needsUpdate = true;
  const haloMaterials = new Map();
  function halo(x, y, z, w, h, tint, alpha) {
    const key = tint + '/' + alpha;
    if (!haloMaterials.has(key)) {
      haloMaterials.set(
        key,
        new T.SpriteMaterial({
          map: haloTex,
          color: tint,
          transparent: true,
          opacity: alpha,
          blending: T.AdditiveBlending,
          depthWrite: false,
          fog: false,
          toneMapped: false,
        }),
      );
    }
    const sprite = new T.Sprite(haloMaterials.get(key));
    sprite.position.set(x, y, z);
    sprite.scale.set(w, h, 1);
    chunkAt(x).group.add(sprite);
  }
  const beamGeometry = new T.BufferGeometry();
  beamGeometry.setAttribute(
    'position',
    new T.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, .12, 1, 0, -.12, 1, 0], 3),
  );
  beamGeometry.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  beamGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  const beams = new Map();
  function shaft(x, y, z, w, h, tilt, tint, alpha) {
    const key = tint + ':' + alpha;
    if (!beams.has(key)) {
      beams.set(
        key,
        new T.ShaderMaterial({
          uniforms: { tint: { value: color(tint) }, alpha: { value: alpha } },
          vertexShader:
            'varying vec2 coord; void main(){coord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
          fragmentShader: `varying vec2 coord; uniform vec3 tint; uniform float alpha;
        void main(){float rim=1.-pow(abs(coord.x*2.-1.),1.6);
        float striae=.77+.23*sin(coord.x*48.+1.1*sin(coord.x*36.));
        gl_FragColor=vec4(tint,alpha*rim*striae*pow(coord.y,.62));
        #include <colorspace_fragment>
        }`,
          side: T.DoubleSide,
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      );
    }
    const mesh = new T.Mesh(beamGeometry, beams.get(key));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, 1);
    mesh.rotation.z = tilt;
    chunkAt(x).group.add(mesh);
  }

  const backdropGeometry = new T.PlaneGeometry(290, 82);
  const backdropMat = new T.ShaderMaterial({
    uniforms: {},
    side: T.DoubleSide,
    vertexShader:
      'varying vec2 pos; void main(){vec4 w=modelMatrix*vec4(position,1.);pos=w.xy;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `varying vec2 pos;
      void main(){
        float reservoir=smoothstep(52.,73.,pos.x)*(1.-smoothstep(112.,130.,pos.x));
        float foundry=smoothstep(115.,143.,pos.x)*(1.-smoothstep(171.,196.,pos.x));
        float light=exp(-pow((pos.y-1.)*.075,2.))*(.77+.23*cos((pos.x+6.)*.14));
        vec3 a=mix(vec3(.028,.065,.115),vec3(.04,.15,.19),reservoir);
        vec3 b=mix(vec3(.16,.39,.455),vec3(.18,.48,.53),reservoir);
        b=mix(b,vec3(.31,.27,.29),foundry);
        gl_FragColor=vec4(mix(a,b,light),1.);
      }`,
  });
  const backdrop = new T.Mesh(backdropGeometry, backdropMat);
  backdrop.position.set(94, 6, -33);
  root.add(backdrop);

  const nearStone = ['#203543', '#273e4a', '#2d4450', '#354c55', '#29404e', '#334958', '#203747'];
  const upperStone = ['#132531', '#192f3c', '#233945', '#1b303c', '#2b4049', '#263a46'];
  const darkStone = ['#10212d', '#122630', '#152934', '#172a35', '#1b303a'];
  const midStone = ['#193947', '#20404e', '#233d50', '#254951', '#294851', '#214552'];
  const farStone = ['#2e5360', '#315864', '#355964', '#335761', '#2b505e', '#305666'];
  function shelf(x, y, z, w, h, d, palette) {
    rock(x, y - h * .50, z, w * .98, h, d * .92, choose(palette));
    rock(x + .07 * w, y - h * .83, z + .18 * d, w * .78, h * .43, d * .84, choose(palette));
    rock(x - .06 * w, y - .05 * h, z + .12 * d, w * .86, h * .12, d * 1.04, choose(palette));
    // Subordinate broken edges hanging from one continuous mass.
    let cursor = x - w * .48;
    while (cursor < x + w * .46) {
      const width = between(.35, 1.3);
      const height = between(.17, .7) * Math.min(1, h);
      rock(
        cursor + width / 2,
        y - height * .55 - between(.03, .2),
        z + d * .47,
        width,
        height,
        .27,
        choose(palette),
      );
      cursor += width * between(.85, 1.08);
    }
  }
  function crystalBed(x, y, z, s, rich = true) {
    const colors = rich
      ? ['#52c7c4', '#79dbd0', '#37a7b4', '#9ee8db', '#368eac']
      : ['#3a7a8e', '#387788', '#52939f', '#51899d'];
    const arrangement = [[-.56, .63, .55], [-.27, .87, .3], [.03, 1.29, -.06], [.37, .93, -.36], [
      .58,
      .5,
      -.62,
    ], [-.12, .47, .14]];
    rock(x, y + .01 * s, z, 1.6 * s, .23 * s, .8 * s, rich ? '#40595f' : '#2c4c53');
    for (const [offset, height, angle] of arrangement) {
      const scale = between(.89, 1.12) * s, tint = choose(colors);
      const dx = x + offset * s, dz = z + between(-.22, .22) * s;
      place(
        'crystal',
        dx,
        y + .06 * s,
        dz,
        .31 * scale,
        height * scale,
        .37 * scale,
        tint,
        between(-.17, .17),
        between(-.5, .5),
        angle,
      );
      if (rich && height > .7) {
        // Narrow highlight that follows the long axis of the crystal.
        const cy = y + .06 * s + (height * .48 * scale) * Math.cos(angle);
        box(
          dx - height * .48 * scale * Math.sin(angle),
          cy,
          dz + .134 * scale,
          .025 * scale,
          height * .55 * scale,
          .025 * scale,
          '#a4f4e5',
          0,
          0,
          angle,
        );
      }
    }
    for (let i = 0; i < 8; i++) {
      const r = between(.07, .23) * s;
      rock(
        x + between(-1.04, 1.03) * s,
        y + r * .27,
        z + between(-.48, .48) * s,
        r * 1.4,
        r,
        r,
        choose(midStone),
      );
    }
    if (rich) halo(x, y + .59 * s, z + .03, s * 3.8, s * 3.1, '#47d8dd', .21);
  }

  // Remote walls and remnants of the settlement in the crevasse.
  for (let x = -45; x < 247; x += between(1.5, 4)) {
    const h = between(5, 15), width = between(2, 5), z = between(-29, -24);
    const y = -8 + h / 2;
    rock(x, y, z, width, h, between(2, 4), choose(farStone));
    rock(x + width * .11, y + h * .47, z - .2, width * .71, between(1.0, 3), 2.6, choose(farStone));
    if (rand() < .4) rock(x + width * .22, y + h * .64, z, width * .28, 2.5, 1.5, choose(farStone));
  }
  for (let x = -32; x < 234; x += between(4.4, 8.3)) {
    const tall = between(5.4, 13), width = between(1.5, 3.1), z = between(-20, -17);
    rock(x, tall / 2 - 5, z, width, tall, 2.0, choose(midStone));
    for (let tier = 0; tier < 4; tier++) {
      const w = width * between(1.25, 2.5);
      rock(x + between(-.6, .6), -4 + tier * tall * .24, z + .2, w, between(.4, 1.1), 2.35, choose(midStone));
    }
    if (rand() < .5) {
      box(x, -1, z + 1.36, .18, 6.1, .2, '#41616b');
      for (let k = 0; k < 4; k++) box(x + .08, -3.4 + k * 1.6, z + 1.48, .37, .13, .12, '#263c4a');
    }
  }
  function bridge(left, right, y, z, background) {
    const col = background ? '#2b4955' : '#273e4a', edge = background ? '#41606a' : '#455865';
    box((left + right) / 2, y, z, right - left, .25, .7, col);
    box((left + right) / 2, y + .14, z + .37, right - left, .085, .1, edge);
    box((left + right) / 2, y + .8, z + .21, right - left, .08, .07, col);
    for (let x = left + .15; x < right; x += 1.5) {
      box(x, y + .47, z + .2, .075, .66, .08, col);
      if (x + 1.45 < right) girder(x, y - .85, z, x + 1.45, y - .17, z, .11, .18, col);
    }
    box((left + right) / 2, y - .85, z, right - left, .12, .2, col);
  }
  for (let x = -23; x < 227; x += 16) {
    bridge(x, x + 12, between(-1, 2.7), -13, true);
    const z = between(-16, -13), y = between(-3, .6);
    box(x + 7, y, z, 4.5, 3.2, 2, '#254454');
    box(x + 8, y + 1.75, z, 2.0, .3, 2.5, '#385361');
    for (let n = 0; n < 6; n++) {
      box(x + 5.2 + n * .63, y + .49, z + 1.015, .24, .38, .045, rand() < .3 ? '#c18a56' : '#41616b');
    }
    if (x > 115 && x < 177) halo(x + 7, y + .3, z + 1.1, 4, 2, '#d37b45', .15);
    shaft(x + 4, -4, -14, 3.6, 18, -.31, '#76d5d3', .12);
  }

  function wire(x0, y0, x1, y1, z, sag, width, tint) {
    let x = x0, y = y0;
    const count = Math.ceil(Math.abs(x1 - x0) / .72);
    for (let i = 1; i <= count; i++) {
      const u = i / count, nx = x0 + (x1 - x0) * u, ny = y0 + (y1 - y0) * u - 4 * sag * u * (1 - u);
      girder(x, y, z, nx, ny, z, width, width, tint);
      x = nx;
      y = ny;
    }
  }
  function lamp(x, y, z, stringHeight, scale = 1) {
    box(x, y + stringHeight / 2, z, .046, stringHeight, .046, '#263c48');
    box(x, y + .24 * scale, z, .17 * scale, .28 * scale, .19 * scale, '#4e5252');
    box(x, y + .07 * scale, z, .53 * scale, .13 * scale, .35 * scale, '#867359');
    box(x, y - .07 * scale, z, .34 * scale, .22 * scale, .25 * scale, '#ffd58d');
    box(x, y - .19 * scale, z, .43 * scale, .055 * scale, .31 * scale, '#5d584d');
    box(
      x - .165 * scale,
      y - .06 * scale,
      z + .13 * scale,
      .026 * scale,
      .23 * scale,
      .035 * scale,
      '#665b45',
    );
    halo(x, y - .08 * scale, z + .14, 2.15 * scale, 2.0 * scale, '#ffad51', .53);
    shaft(x - .10 * scale, y - 2.8 * scale, z, 1.55 * scale, 2.7 * scale, -.04, '#ffc78a', .16);
  }
  function pipe(x0, x1, y, z, r, tint) {
    box((x0 + x1) / 2, y, z, x1 - x0, r, r, tint);
    for (let x = x0 + .55; x < x1; x += 1.72) {
      box(x, y, z, .11, r * 1.18, r * 1.18, '#3c5057');
      box(x + .02, y + .02, z + r * .59, .046, .08, .025, '#627178');
    }
  }
  function column(x, z, height) {
    rock(x, height / 2 - .8, z, 1.06, height, 1.3, '#2b4049');
    box(x, height / 2 - .8, z + .69, .64, height - .1, .11, '#24333d');
    box(x - .4, height / 2 - .8, z + .7, .13, height, .13, '#45565b');
    for (let y = -.3; y < height - .5; y += 1.54) {
      box(x, y, z, 1.2, .18, 1.58, '#354851');
      box(x + .33, y + .01, z + .8, .075, .072, .03, '#687277');
    }
  }
  function fan(x, y, z, r) {
    // Wall-mounted octagonal extraction fan with bolted rim and shutter blades.
    box(x, y, z, r * 2.45, r * 2.36, .44, '#263c46');
    box(x, y, z + .24, r * 2.21, r * 2.2, .15, '#3c5158');
    box(x, y, z + .35, r * 1.93, r * 1.98, .1, '#10232f');
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      box(
        x + r * .87 * Math.cos(a),
        y + r * .87 * Math.sin(a),
        z + .51,
        r * .73,
        r * .13,
        .16,
        i > 3 ? '#46565b' : '#567078',
        0,
        0,
        a + Math.PI / 2,
      );
      box(
        x + r * .48 * Math.cos(a + .23),
        y + r * .48 * Math.sin(a + .23),
        z + .44,
        r * .72,
        r * .28,
        .11,
        '#314754',
        0,
        0,
        a - .21,
      );
    }
    box(x, y, z + .56, r * .32, r * .3, .19, '#695c49');
    for (const dx of [-1, 1]) {
      for (const dy of [-1, 1]) {
        box(x + dx * r, y + dy * r, z + .36, .09, .09, .04, '#7c817a');
      }
    }
  }
  function machinery(x, z) {
    column(x - 2.2, z, 6.4);
    box(x + .48, 1.4, z, 4.14, 3.3, 1.01, '#263a47');
    box(x + .48, 3.13, z, 4.34, .20, 1.26, '#42525a');
    fan(x + 1.15, 1.58, z + .51, 1.02);
    box(x - .83, 1.54, z + .6, .66, 2.37, .16, '#192a35');
    for (let i = 0; i < 11; i++) box(x - .83, .58 + i * .17, z + .7, .52, .065, .09, '#384d57');
    box(x - .8, 2.88, z + .65, .63, .12, .13, '#cc8850');
    pipe(x - 2.7, x + 2.85, .08, z + 1, .28, '#495359');
    pipe(x - 3, x + 3.05, 3.65, z - .3, .31, '#45515a');
  }

  // Near cave walls are made of overlapping ledges, with fissures that open
  // onto the distant architecture. Keep the center of the title composition clear.
  for (let x = -24; x < 231; x += between(1.5, 3.1)) {
    const z = between(-10, -7.1), w = between(2.2, 4.5), y = between(-1.8, -.6);
    shelf(x, y, z, w, between(1.1, 3.1), between(1.4, 3), midStone);
    const roofHeight = x < 62 ? between(5.4, 8) : between(9, 13);
    const d = between(1.8, 3);
    shelf(x, roofHeight + 2, z, w, between(1.2, 3.7), d, midStone);
    if (rand() < .32) rock(x - .45, roofHeight - .75, z + .39, .28, between(1, 2.6), .68, choose(midStone));
  }
  // Starting module: a tunnel mouth frames the distant bridge and mineral basin.
  for (
    const [x, y, z, w, h, d] of [
      [-7.0, 6.7, -3.0, 7.6, 3.1, 3.0],
      [-5.3, 4.48, -3.75, 4.7, .95, 2.6],
      [-6.6, 3.8, -3.75, 4.6, 1.14, 2.65],
      [-7.7, 2.68, -4, 3.32, 2.4, 2.1],
      [1.3, 6.8, -2.8, 6.9, 1.2, 2.5],
      [5.25, 6.23, -2.4, 3.7, 1.0, 2.3],
      [7.55, 5.7, -2.95, 2.65, 1.33, 2.28],
      [10.02, 5.54, -3.9, 3.47, 2.08, 2.94],
      [10.95, 3.89, -4.4, 3.0, 1.23, 2.75],
      [11.68, 2.96, -4.05, 3.5, 1.43, 2.48],
      [-3.4, -.5, -3.2, 6, 1.2, 2.3],
      [7.50, -.18, -2.50, 4.15, 2.2, 2.0],
      [9.65, .62, -3.8, 3.22, 2.6, 2.7],
      [11.55, 1.1, -4.65, 3.05, 2.45, 2.1],
    ]
  ) shelf(x, y, z, w, h, d, y > 2 ? upperStone : nearStone);
  for (
    const [x, y, z, h] of [[-3.8, 4.06, -3.3, 1.08], [4.74, 5.53, -2.4, .87], [6.89, 4.76, -2.6, 1.13], [
      8.2,
      4.36,
      -2.6,
      .64,
    ]]
  ) {
    rock(x, y, z, .27, h, .52, '#273e49');
    rock(x + .16, y + .2, z, .39, h * .8, .62, '#304450');
  }
  crystalBed(6.55, -.20, -2.48, 1.23);
  crystalBed(8.03, -.17, -2.27, .61);
  crystalBed(9.88, .64, -3.75, 1.67);
  crystalBed(-2.55, -.46, -3, .55);
  crystalBed(1.65, -1.02, -8.6, .86, false);
  crystalBed(-4.0, 1.15, -8.0, .72, false);
  // High track, grated catwalk and power lines lead the eye into the gallery.
  bridge(-9, .26, 2.19, -7.8, true);
  column(-2.15, -7.9, 7);
  machinery(-4.2, -6.7);
  pipe(-9.5, -1.3, 3.46, -6.6, .26, '#5c5d57');
  wire(-5.6, 5.67, 7.45, 4.62, -3.7, .96, .061, '#152634');
  wire(-5.6, 5.59, 7.45, 4.52, -3.66, 1.29, .047, '#1a2b37');
  wire(1.35, 5.78, 9.8, 3.75, -4.38, 1.23, .035, '#233745');
  lamp(3.62, 3.37, -3.74, .75, 1.18);
  lamp(-3.29, 2.81, -6.0, .75, .72);
  shaft(1.53, -1.8, -6.22, 3.8, 10.2, -.42, '#99edef', .26);
  shaft(3.47, -2.1, -6.48, 1.1, 10, -.42, '#9bf6f4', .21);
  halo(3.4, 1.9, -9, 7.5, 6.8, '#61b7d1', .16);

  for (let x = 16; x < 220; x += 11.3) {
    const reservoir = x > 62 && x < 125, foundry = x >= 125 && x < 182, ascent = x >= 182;
    const z = between(-6.9, -4.4);
    if (!reservoir) {
      if (foundry || !ascent) machinery(x + 2, z - 1);
      else column(x + 2, z, 13.5);
      const y = foundry ? 6.2 : 4.6;
      bridge(x - 4.6, x + .6, y - 1.25, z - .7, false);
      wire(x - 4.4, y + 1.6, x + 6.7, y + 1.3, z - .2, between(.6, 1.4), .055, '#1d303c');
      lamp(x + 1.65, y, z - .4, 1.05, 1);
      if (foundry) {
        for (let i = 0; i < 3; i++) {
          place('piston', x - 1 + i * .48, 4.65, z + .95, .25, 3.2, .34, '#8b7561');
          box(x - 1 + i * .48, 6.62, z + .95, .49, 1.05, .63, '#4d565b');
        }
        place('piston', x - .5, 3.15, z + 1, 2.10, .43, .7, '#6a625b');
        pipe(x - 4.5, x + 4.3, .38, z + .7, .2, '#a56a42');
        for (let n = 0; n < 4; n++) box(x - 1.4 + n * .68, .36, z + .82, .41, .075, .035, '#e5a265');
        halo(x + .1, .44, z + .92, 3.4, 1.6, '#de8e51', .2);
      }
    } else {
      const y = between(.1, 2.2);
      shelf(x, y, z, 4.2, between(1.8, 3.4), 2.3, nearStone);
      crystalBed(x - .3, y + .035, z, between(1.15, 2.12));
      crystalBed(x + 1.53, y + .035, z + .2, .59);
      for (let n = 0; n < 7; n++) {
        const dx = between(-.76, .78);
        box(
          x + 3.3 + dx,
          1.6,
          z - 5.7,
          between(.04, .16),
          between(8, 11),
          .04,
          choose(['#477385', '#3f7182', '#467c8c']),
        );
      }
      halo(x + 3.3, -1.4, z - 4.9, 4.8, 1.1, '#69d2d6', .2);
      shaft(x + .5, -3, z - 3, 3.1, 14, -.24, '#63dfd6', .15);
    }
    if (!reservoir && !foundry && !ascent) {
      shelf(x + 4.4, -.57, -3.58, 3.6, 1.72, 2.07, nearStone);
      crystalBed(x + 4.55, -.53, -3.48, .72);
    }
  }
  // The pale shaft opening stays cool until the lift actually reaches daylight.
  halo(201, 14, -9, 15, 12, '#c0d6d4', .4);
  for (let i = 0; i < 4; i++) shaft(196 + i * 2, 1, -8, 1.5 + i, 16, -.09, '#a9dfe4', .12);

  // A work bench forms a warm pool of light below the opening gantry.
  const bx = 1.1, bz = -2.9;
  shelf(bx, -.065, bz, 4.4, 1.04, 1.67, nearStone);
  box(bx, .65, bz, 2.24, .14, .63, '#705c4c');
  box(bx, .57, bz + .32, 2.28, .10, .05, '#887663');
  for (const dx of [-.91, .91]) {
    box(bx + dx, .22, bz, .13, .71, .45, '#364950');
    box(bx + dx, .48, bz + .26, .08, .08, .035, '#a28c69');
  }
  box(bx - .37, .95, bz - .12, .67, .46, .22, '#34444b');
  box(bx - .37, .97, bz + .005, .55, .34, .04, '#192f34');
  for (let i = 0; i < 5; i++) {
    box(bx - .56 + i * .09, .96 + Math.sin(i * 2) * .034, bz + .038, .055, .015, .018, '#9dbba6');
  }
  box(bx + .53, .82, bz + .03, .67, .19, .41, '#986043');
  box(bx + .53, .93, bz + .03, .7, .055, .43, '#b37f56');
  box(bx + .53, .85, bz + .244, .12, .061, .025, '#444948');
  for (const x of [2.74, 3.15]) {
    box(x, .28, -2.39, .41, .63, .47, '#605b4b');
    for (const y of [.05, .44, .58]) box(x, y, -2.39, .44, .047, .50, '#34454a');
  }
  // Hanging strata and a cable loop frame the right-hand mineral basin.
  for (
    const [x, y, w, h] of [[7.15, 4.89, 3.1, .68], [8.7, 4.45, 2.4, .77], [9.28, 3.84, 1.7, .74], [
      10.2,
      3.39,
      1.3,
      .84,
    ]]
  ) {
    shelf(x, y, -2.95, w, h, 1.45, upperStone);
    for (let i = 0; i < 6; i++) {
      rock(
        x + between(-w * .4, w * .4),
        y - between(.09, h * .86),
        -2.11,
        between(.15, .7),
        between(.04, .16),
        .12,
        choose(midStone),
      );
    }
  }
  wire(2.55, 4.04, 8.99, 3.67, -2.94, .46, .033, '#1b2c32');
  wire(2.55, 4.04, 8.99, 3.67, -2.97, .58, .025, '#3c4950');
  lamp(6.68, 2.86, -3.1, .83, .67);
  // Fracture faces and shallow rubble around the workshop mineral deposits.
  for (let i = 0; i < 68; i++) {
    const x = between(5.53, 10.1), z = between(-3.4, -1.85), y = -.22 + Math.max(0, x - 8) * .22;
    const r = between(.07, .28);
    rock(x, y + r * .32, z, r * 1.4, r * .65, r, choose(nearStone));
  }
  for (const [x, y, z, sc] of [[7.55, -.17, -2.05, .31], [6.02, -.20, -2.16, .37], [8.4, -.16, -2.16, .27]]) {
    crystalBed(x, y, z, sc, false);
  }
  // The visible workshop ceiling is a fractured diagonal rock arch.
  for (
    const [x, y, w, h] of [
      [-.65, 4.27, 2.2, .50],
      [.65, 4.04, 1.9, .68],
      [1.82, 3.96, 1.1, .35],
      [5.55, 4.12, 1.1, .34],
      [6.63, 3.97, 1.5, .46],
      [7.71, 3.60, 1.4, .58],
      [8.63, 3.35, 1.35, .87],
    ]
  ) {
    shelf(x, y, -2.65, w, h, 1.2, upperStone);
    for (let n = 0; n < 9; n++) {
      const f = between(.08, .27);
      rock(
        x + between(-w * .5, w * .5),
        y - between(.08, h + .16),
        -1.94,
        f * 2,
        f * .62,
        between(.12, .22),
        choose(nearStone),
      );
    }
  }
  for (const x of [5.55, 5.87, 6.32, 7.57, 7.82]) {
    const y = 3.39 - .31 * (x - 5.55), h = between(.25, .65);
    rock(x, y, -2.61, .17, h, .36, '#223942');
    rock(x - .02, y - h * .44, -2.61, .09, .22, .21, '#21343d');
  }
  // Bolted throat and cooling pipes on the lit face of the fan housing.
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    box(-3.05 + .87 * Math.cos(a), 1.58 + .87 * Math.sin(a), -5.54, .085, .085, .08, '#918778');
  }
  pipe(-2.2, 2.04, .13, -3.48, .14, '#80694d');
  halo(6.6, .43, -2.47, 2.25, 1.9, '#42e4cc', .37);
  halo(3.62, 3.24, -3.36, 2.13, 1.65, '#ffa544', .45);
  const ownedBatches = [];
  for (const chunk of chunks.values()) {
    for (const [kind, entries] of chunk.batches) {
      const [geometry, mat] = specs[kind.split(':')[0]];
      const mesh = new T.InstancedMesh(geometry, mat, entries.length);
      for (let i = 0; i < entries.length; i++) {
        mesh.setMatrixAt(i, entries[i][0]);
        mesh.setColorAt(i, entries[i][1]);
      }
      mesh.userData.piston = kind === 'piston';
      mesh.userData.distant = kind.endsWith(':far');
      mesh.computeBoundingSphere();
      chunk.group.add(mesh);
      ownedBatches.push(mesh);
    }
    chunk.batches.clear();
  }
  // Recycle one small cloud around the camera. Particles are kept in the
  // middle distance; the player and traversal edges remain clear.
  const dustGeometry = new T.BufferGeometry(), dustCount = 94;
  const dustPositions = new Float32Array(dustCount * 3), dustColors = new Float32Array(dustCount * 3);
  const dustSeeds = Array.from(
    { length: dustCount },
    () => [between(0, 36), between(-4, 12), between(-7, .3), rand() * 6.28],
  );
  dustSeeds.forEach((p, i) => {
    const c = color(i % 6 === 0 ? '#bd9a6b' : '#79b6c2');
    dustColors.set([c.r, c.g, c.b], i * 3);
  });
  dustGeometry.setAttribute('position', new T.BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('color', new T.BufferAttribute(dustColors, 3));
  const dustMat = new T.PointsMaterial({
    size: .026,
    vertexColors: true,
    transparent: true,
    opacity: .72,
    depthWrite: false,
    fog: false,
  });
  const dust = new T.Points(dustGeometry, dustMat);
  dust.frustumCulled = false;
  root.add(dust);
  function update(x, time, region, reduced = false) {
    for (const chunk of chunks.values()) chunk.group.visible = Math.abs(chunk.n * 16 + 8 - x) < 50;
    for (const mesh of ownedBatches) {
      if (mesh.userData.piston && region === 2) mesh.position.y = reduced ? 0 : Math.sin(time * .83) * .48;
      if (mesh.userData.distant) {
        mesh.position.x = reduced ? 0 : (x - 4) * .035;
      }
    }
    const t = reduced ? 0 : time;
    for (let i = 0; i < dustCount; i++) {
      const [px, py, pz, phase] = dustSeeds[i];
      dustPositions[i * 3] = x - 18 + (((px + .055 * t - x) % 36) + 36) % 36;
      dustPositions[i * 3 + 1] = py + .23 * Math.sin(.27 * t + phase);
      dustPositions[i * 3 + 2] = pz;
    }
    dustGeometry.attributes.position.needsUpdate = true;
  }
  update(4, 0, 0);
  function dispose() {
    scene.remove(root);
    for (const mesh of ownedBatches) mesh.dispose();
    for (
      const item of [
        cube,
        quartz,
        stoneMat,
        solidMat,
        quartzMat,
        texture,
        haloTex,
        beamGeometry,
        backdropGeometry,
        backdropMat,
        dustMat,
        dustGeometry,
        ...beams.values(),
        ...haloMaterials.values(),
      ]
    ) item.dispose();
  }
  return { update, dispose };
}
