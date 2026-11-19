const paths = {
  sound: 'M3 9h4l4-4v14l-4-4H3z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14',
  mute: 'M3 9h4l4-4v14l-4-4H3z M16 9l6 6m0-6-6 6',
  full: 'M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6',
  pause: 'M8 5v14m8-14v14',
  play: 'm7 4 12 8-12 8z',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  depth: 'M5 4v11l4-4m-4 4-4-4m11-6h9m-9 6h6m-6 6h9',
  route: 'm3 7 9-4 9 4-9 4z M3 12l9 4 9-4M3 17l9 4 9-4',
  keyboard: 'M2 5h20v14H2z M5 9h1m2 0h1m2 0h1m2 0h1m2 0h1M5 12h1m2 0h1m2 0h1m2 0h1m2 0h1M7 15h10',
  book: 'M3 4c4-1 6 0 9 2 3-2 6-3 9-2v15c-3-1-6 0-9 2-3-2-6-3-9-2z M12 6v15',
};
export const icon = (name) =>
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round" stroke-linecap="round"><path d="' +
  paths[name] + '"/></svg>';
export function mark() {
  const letters = {
    D: 'M0 0H8.1L11 2.9V12.1L8.1 15H0ZM3.3 3.1v8.8h3.5l.9-.9V4l-.9-.9Z',
    E: 'M0 0h10v3.1H3.4v2.8H9v3H3.4v3H10V15H0Z',
    P: 'M0 0h8.6l2.3 2.3v5.8l-2.3 2.3H3.4V15H0Zm3.4 3v4.3h3.3l.8-.8V3.8L6.7 3Z',
    W: 'M0 0h3.3l.9 10.9L6.5 5h2.2l2.2 5.9L12 0h3.25l-2.1 15H9.8l-2.2-5.5L5.4 15H2Z',
    A: 'M3.5 0h5L12 15H8.45l-.62-3.2H4.15L3.5 15H0Zm1.2 8.7h2.55L5.98 2.9Z',
    K: 'M0 0h3.4v6.25L8.1 0h4L6.4 7.15 12.5 15H8.15L3.4 8.4V15H0Z',
  };
  let x = 0, out = '';
  for (const c of 'DEEPWAKE') {
    out += '<path transform="translate(' + x + ' 0)" d="' + letters[c] + '" fill-rule="evenodd"/>';
    x += ({ D: 11, E: 10, P: 11, W: 15.3, A: 12, K: 12.5 }[c]) + 1.45;
  }
  const svg = document.querySelector('#title-mark');
  svg.setAttribute('viewBox', '0 0 ' + (x - 1.45) + ' 15');
  svg.innerHTML = '<g fill="#f8f3e6">' + out + '</g>';
}
// Small orthographic scene illustrations, painted on a low-resolution pixel grid.
export function paintRegion(canvas, region) {
  canvas.width = 190;
  canvas.height = 90;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  let seed = 2103 + region * 27;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pal = [['#191e20', '#45423b', '#b38a57', '#f4b165'], ['#142026', '#294a51', '#65bcb8', '#b0f3da'], [
    '#211e20',
    '#4d413c',
    '#9d6f54',
    '#ed9f64',
  ]][region];
  g.fillStyle = pal[0];
  g.fillRect(0, 0, 190, 90);
  const poly = (p, c) => {
    g.fillStyle = c;
    g.beginPath();
    p.forEach(([x, y], i) => i ? g.lineTo(x | 0, y | 0) : g.moveTo(x | 0, y | 0));
    g.closePath();
    g.fill();
  };
  const cube = (x, y, w, h, d, a, b, c) => {
    poly([[x, y], [x + w, y - w * .31], [x + w + d, y - w * .31 + d * .43], [x + d, y + d * .43]], a);
    poly([[x, y], [x + d, y + d * .43], [x + d, y + d * .43 + h], [x, y + h]], b);
    poly([[x + d, y + d * .43], [x + w + d, y - w * .31 + d * .43], [x + w + d, y - w * .31 + d * .43 + h], [
      x + d,
      y + d * .43 + h,
    ]], c);
  };
  for (let n = 0; n < 22; n++) {
    const x = rnd() * 190, y = rnd() * 85;
    g.fillStyle = pal[1];
    g.globalAlpha = .27;
    g.fillRect(x | 0, y | 0, 1 + rnd() * 14, 1 + rnd() * 20);
  }
  g.globalAlpha = 1;
  for (let n = 0; n < 70; n++) {
    const x = 48 + rnd() * 145, y = 56 + rnd() * 35, s = 4 + rnd() * 15;
    cube(x, y, s, 4 + rnd() * 8, 4 + rnd() * 8, pal[1], '#232e31', '#1a2124');
  }
  if (region === 1) {
    for (
      const [x, y, h, w, d] of [
        [96, 69, 21, 9, -8],
        [106, 73, 34, 11, 3],
        [118, 66, 47, 13, -5],
        [128, 68, 62, 16, 10],
        [145, 64, 40, 13, 13],
        [153, 72, 24, 10, 11],
        [115, 76, 14, 7, -7],
        [130, 78, 28, 9, 8],
        [166, 73, 16, 7, 6],
      ]
    ) {
      poly([[x, y], [x - w / 2 + d * .7, y - h * .65], [x + d, y - h], [x + w / 2 + d * .8, y - h * .7], [
        x + w * .6,
        y - 2,
      ]], '#439c9d');
      poly([[x, y], [x + d, y - h], [x + w / 2 + d * .8, y - h * .7], [x + w * .6, y - 2]], '#6cc7bb');
      poly([[x - w / 2 + d * .7, y - h * .65], [x + d, y - h], [x + w / 2 + d * .8, y - h * .7], [
        x + d * .7,
        y - h * .59,
      ]], '#b6e7d5');
      poly(
        [[x + d * .7, y - h * .59], [x + d * .7 + 2, y - h * .62], [x + 3, y - 3], [x + 1, y - 2]],
        '#8ddacd',
      );
    }
  } else if (region === 0) {
    cube(92, 50, 61, 20, 17, '#625e50', '#3d3e3b', '#30383b');
    cube(96, 45, 56, 6, 14, '#797360', '#403f39', '#505451');
    for (const [x, y, h] of [[102, 27, 26], [115, 13, 38], [135, 21, 25]]) {
      cube(x, y, 8, h, 7, '#a38e6a', '#596362', '#4a5355');
      cube(x - 2, y - 2, 11, 4, 9, '#a4997c', '#757365', '#737165');
    }
    cube(119, 33, 22, 21, 10, '#93816b', '#655b4b', '#52504a');
    for (let n = 0; n < 4; n++) cube(123 + n * 4, 42 - n, 2, 15, 2, '#80745b', '#ad895b', '#5f5547');
    cube(143, 34, 12, 18, 11, '#687273', '#474e4e', '#3b474b');
    cube(141, 29, 17, 6, 11, '#929184', '#514e45', '#655d50');
    cube(146, 49, 6, 7, 5, '#ffce80', '#cb904f', '#e8b070');
    cube(86, 60, 10, 8, 8, '#8c7254', '#534b3e', '#64533f');
  } else {
    for (const [x, y, w, h] of [[103, 33, 21, 31], [127, 26, 24, 38], [152, 38, 17, 25]]) {
      cube(x, y, w, h, 11, '#7f7364', '#4d4e4b', '#40474a');
      cube(x - 2, y - 3, w + 4, 6, 13, '#95816a', '#5e5b52', '#726554');
      cube(x + 3, y + 12, w - 6, 14, 7, '#5a5247', '#a27049', '#df965b');
      for (let i = 0; i < 3; i++) cube(x + 8 + i * 4, y + 8 - i, 2, 17, 4, '#77756b', '#514d45', '#5c5144');
      cube(x + 4, y - 19, 8, 17, 6, '#7e8076', '#4e5958', '#536366');
      cube(x + 3, y - 20, 10, 3, 7, '#919084', '#605d54', '#5e6562');
    }
  }
  for (let i = 0; i < 27; i++) {
    const x = 65 + rnd() * 120, y = 9 + rnd() * 65;
    g.fillStyle = pal[3];
    g.globalAlpha = rnd() * .55;
    g.fillRect(x | 0, y | 0, 1, 1);
  }
  g.globalAlpha = 1;
}
