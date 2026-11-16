// Motivy vrstevnic pro PDF dárkového poukazu. Souřadnice jsou v milimetrech uvnitř obrázku (šířka × výška).
// Pravidlo vzhledu: žádná linie nesmí přesáhnout výšku obrázku (obrázek se nikdy neořezává).

const SEA = "#2f4a4a";
const GOLD = "#d3a53c";

export interface MotifLine {
  pts: [number, number][];
  color: string;
  width: number; // mm
  opacity: number;
  maskBelow?: boolean; // před čarou vyplnit bílou plochu pod ní (skrytí linií za zvednutým tvarem)
}

export interface Motif {
  w: number;
  h: number;
  lines: MotifLine[];
}

// Jemné vlnité vrstevnice (reliéf, pruh vlnek na druhé straně).
export function waves(w = 194, h = 92, n = 30, amp0 = 1.8, ampk = 0.1): Motif {
  const ext = (amp0 + (n - 1) * ampk) * 1.5 + 0.5;
  const step = (h - 2 * ext) / (n - 1);
  const lines: MotifLine[] = [];
  for (let i = 0; i < n; i++) {
    const y0 = ext + i * step;
    const amp = amp0 + i * ampk;
    const ph = i * 0.35;
    const pts: [number, number][] = [];
    for (let k = 0; k <= 100; k++) {
      const x = (w * k) / 100;
      const y = y0 + amp * Math.sin((x / w) * 2 * Math.PI * 1.6 + ph) + amp * 0.5 * Math.sin((x / w) * 2 * Math.PI * 0.7 - ph);
      pts.push([x, y]);
    }
    const gold = i % 6 === 3;
    lines.push({ pts, color: gold ? GOLD : SEA, width: gold ? 0.7 : 0.45, opacity: Math.max(0.35, 1 - i * 0.02) });
  }
  return { w, h, lines };
}

// Šířka obrysu hlavy a krku v poměrné výšce t (0 = temeno).
function headW(t: number, W: number): number {
  if (t < 0) return 0;
  if (t <= 0.45) return W * Math.sqrt(Math.max(0, 1 - ((0.45 - t) / 0.45) ** 2));
  if (t <= 1.0) {
    const u = (t - 0.45) / 0.55;
    return W * (1 - 0.52 * u ** 1.5 - 0.1 * u ** 6);
  }
  const neck = 0.4 * W;
  if (t <= 1.28) return W * 0.38 + (neck - W * 0.38) * ((t - 1.0) / 0.28);
  return Math.min(neck + (t - 1.28) * W * 1.6, 1.7 * W);
}

const g = (x: number, mu: number, sig: number) => Math.exp(-((x - mu) ** 2) / (2 * sig * sig));

// Velmi jemné rysy obličeje: oči a ústa jako mělké prohlubně, nos jako zvednutý hřbet. Kladná hodnota = níž.
const EYE = 3.0;
const NOSE = 3.0;
const MOUTH = 2.2;
function faceDelta(x: number, y0: number, cx: number, ytop: number, Hh: number): number {
  const ye = ytop + 0.5 * Hh;
  const yn = ytop + 0.64 * Hh;
  const ym = ytop + 0.81 * Hh;
  let d = 0;
  for (const sx of [-1, 1]) d += EYE * g(x, cx + sx * 10.5, 3.8) * g(y0, ye, 2.4);
  d -= NOSE * g(x, cx, 2.3) * g(y0, yn, 3.4);
  d += MOUTH * g(x, cx, 7.0) * g(y0, ym, 2.2);
  return d;
}

// Modelování hlavy: stejné vlny, které se v místě hlavy vytvarují do schematické masky.
export function headRelief(w = 194, h = 92, n = 26, step = 3.3, top = 3, cx = 97, W = 64, Hh = 70, ytop = 9): Motif {
  const lines: MotifLine[] = [];
  for (let i = 0; i < n; i++) {
    const y0 = top + i * step;
    const amp = 0.9 + i * 0.05;
    const ph = i * 0.35;
    const t = (y0 - ytop) / Hh;
    const rx = t >= 0 ? headW(t, W) / 2 : 0;
    const dmax = Math.min(15, 0.5 * rx);
    const pts: [number, number][] = [];
    for (let k = 0; k <= 200; k++) {
      const x = (w * k) / 200;
      let y = y0 + amp * Math.sin((x / w) * 2 * Math.PI * 1.6 + ph) + amp * 0.5 * Math.sin((x / w) * 2 * Math.PI * 0.7 - ph);
      if (rx > 0.5) {
        const u = (x - cx) / rx;
        if (Math.abs(u) < 1) {
          const s = Math.sqrt(1 - u * u);
          y -= dmax * s;
          y += faceDelta(x, y0, cx, ytop, Hh) * s;
        }
      }
      pts.push([x, y]);
    }
    const gold = i % 5 === 2;
    lines.push({ pts, color: gold ? GOLD : SEA, width: gold ? 0.75 : 0.5, opacity: Math.max(0.55, 1 - i * 0.015), maskBelow: true });
  }
  return { w, h, lines };
}

// Motiv podle typu kurzu. Neznámý typ dostane vlny. Nový kurz = nový motiv přidaný sem.
export function motifForTopic(topic: string): Motif {
  if (topic === "hlava") return headRelief();
  return waves();
}
