import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Point = { x: number; y: number };

@Component({
  selector: 'app-dfdnewton',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dfdnewton.component.html',
  styleUrls: ['./dfdnewton.component.css']
})
export class DfdnewtonComponent {
  // UI
  mode: 'tabla' | 'texto' = 'tabla';
  decimals = 4;
  error: string | null = null;
  calculado = false;

  // Entrada por texto
  xText = '';
  yText = '';

  // Entrada por tabla
  points: Array<{ x: number | null; y: number | null }> = [
    { x: null, y: null },
    { x: null, y: null },
    { x: null, y: null }
  ];

  // Datos procesados
  xs: number[] = [];
  ddTable: number[][] = [];        // ddTable[i][j] = f[x_i, ..., x_{i+j}]
  newtonCoeffs: number[] = [];     // a_k = ddTable[0][k]

  // Polinomios
  newtonString = '';               // forma de Newton (string)
  coeffsStd: number[] = [];        // forma estándar: a0 + a1 x + ...
  polyStdString = '';
  degree = 0;

  // Evaluación
  tEval: number | null = null;
  pEval: number | null = null;

  // ==== Acciones UI ====
  addRow() { this.points.push({ x: null, y: null }); }
  removeRow(i: number) { this.points.splice(i, 1); }
  clear() {
    this.mode = 'tabla';
    this.decimals = 4;
    this.error = null;
    this.calculado = false;
    this.xText = '';
    this.yText = '';
    this.points = [{ x: null, y: null }, { x: null, y: null }, { x: null, y: null }];
    this.xs = [];
    this.ddTable = [];
    this.newtonCoeffs = [];
    this.newtonString = '';
    this.coeffsStd = [];
    this.polyStdString = '';
    this.degree = 0;
    this.tEval = null;
    this.pEval = null;
  }

  // ==== Calcular ====
  calculate() {
    this.error = null;

    let pts: Point[] = this.mode === 'texto'
      ? this.parseTextPoints()
      : this.collectTablePoints();

    if (pts.length < 2) {
      this.error = 'Necesitas al menos 2 puntos (x, y).';
      this.calculado = false;
      return;
    }

    // Validar x distintos
    const xs = pts.map(p => p.x);
    const hasDup = xs.some((x, i) => xs.indexOf(x) !== i);
    if (hasDup) {
      this.error = 'Hay valores de x repetidos; se requieren x distintos.';
      this.calculado = false;
      return;
    }

    // Ordenar por x
    pts = pts.slice().sort((a, b) => a.x - b.x);
    this.xs = pts.map(p => p.x);

    // Construir tabla de diferencias divididas
    this.ddTable = this.buildDividedDifferences(pts);

    // Coeficientes de Newton (a_k = ddTable[0][k])
    this.newtonCoeffs = this.ddTable.length
      ? this.ddTable[0].slice(0, pts.length)
      : [];

    // Forma de Newton (string)
    this.newtonString = this.formatNewton(this.newtonCoeffs, this.xs, 'x', this.decimals);

    // Convertir a forma estándar (expandido)
    this.coeffsStd = this.newtonToStandard(this.newtonCoeffs, this.xs);
    this.degree = this.trueDegree(this.coeffsStd);
    this.polyStdString = this.formatPolynomial(this.coeffsStd, 'x', this.decimals);

    this.calculado = true;
    this.evaluate();
  }

  evaluate() {
    if (!this.calculado || this.tEval === null || isNaN(Number(this.tEval))) {
      this.pEval = null;
      return;
    }
    this.pEval = this.newtonEval(this.newtonCoeffs, this.xs, Number(this.tEval));
  }

  // ==== Parseo de entradas ====
  parseTextPoints(): Point[] {
    const split = (s: string) =>
      s.trim()
       .split(/[,\s;]+/g)
       .filter(Boolean)
       .map(Number);

    const X = split(this.xText);
    const Y = split(this.yText);

    if (X.length !== Y.length) {
      this.error = 'Las listas X e Y deben tener la misma cantidad de valores.';
      return [];
    }
    const pts: Point[] = [];
    for (let i = 0; i < X.length; i++) {
      const xi = X[i], yi = Y[i];
      if (!isFinite(xi) || !isFinite(yi)) {
        this.error = 'Hay valores no numéricos en X o Y.';
        return [];
      }
      pts.push({ x: xi, y: yi });
    }
    return pts;
  }

  collectTablePoints(): Point[] {
    const pts: Point[] = [];
    for (const r of this.points) {
      if (r.x === null && r.y === null) continue;
      if (r.x === null || r.y === null || !isFinite(Number(r.x)) || !isFinite(Number(r.y))) {
        this.error = 'Completa los campos numéricos de la tabla o elimina filas vacías.';
        return [];
      }
      pts.push({ x: Number(r.x), y: Number(r.y) });
    }
    return pts;
  }

  // ==== Núcleo: Diferencias divididas ====
  buildDividedDifferences(points: Point[]): number[][] {
    const n = points.length;
    const table: number[][] = Array.from({ length: n }, () => Array(n).fill(NaN));

    // Orden 0: valores de y
    for (let i = 0; i < n; i++) {
      table[i][0] = points[i].y;
    }

    // Órdenes superiores
    for (let j = 1; j < n; j++) {
      for (let i = 0; i < n - j; i++) {
        const num = table[i + 1][j - 1] - table[i][j - 1];
        const den = points[i + j].x - points[i].x;
        table[i][j] = num / den;
      }
    }
    return table;
  }

  // Evaluación eficiente P(t) en forma de Newton
  newtonEval(a: number[], xs: number[], t: number): number {
    if (a.length === 0) return 0;
    let s = a[0];
    let prod = 1;
    for (let k = 1; k < a.length; k++) {
      prod *= (t - xs[k - 1]);
      s += a[k] * prod;
    }
    return s;
  }

  // Expandir forma Newton a estándar
  newtonToStandard(a: number[], xs: number[]): number[] {
    // P(x) = a0 + a1(x-x0) + a2(x-x0)(x-x1) + ...
    let res: number[] = [0];
    let basis: number[] = [1]; // empieza con 1

    for (let k = 0; k < a.length; k++) {
      // agregar término a_k * basis
      res = this.polyAdd(res, this.polyScale(basis, a[k]));
      // actualizar basis *= (x - x_{k})
      if (k < a.length - 1) {
        basis = this.polyMul(basis, [-xs[k], 1]); // (x - xk)
      }
    }
    return res;
  }

  // ==== Utilidades de polinomios ====
  polyAdd(a: number[], b: number[]): number[] {
    const n = Math.max(a.length, b.length);
    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) c[i] = (a[i] ?? 0) + (b[i] ?? 0);
    return c;
  }

  polyMul(a: number[], b: number[]): number[] {
    const c = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++)
      for (let j = 0; j < b.length; j++)
        c[i + j] += a[i] * b[j];
    return c;
  }

  polyScale(a: number[], k: number): number[] {
    return a.map(v => v * k);
  }

  trueDegree(coeffs: number[]): number {
    for (let i = coeffs.length - 1; i >= 0; i--) if (Math.abs(coeffs[i]) > 1e-12) return i;
    return 0;
  }

  formatPolynomial(coeffs: number[], variable: string, decimals: number): string {
    const eps = Math.pow(10, -decimals);
    const roundFix = (n: number) => (Math.abs(n) < eps ? 0 : Number(n.toFixed(decimals)));

    const parts: Array<{ sign: string; term: string }> = [];
    for (let k = 0; k < coeffs.length; k++) {
      let c = roundFix(coeffs[k]);
      if (c === 0) continue;

      const sign = c > 0 ? '+' : '-';
      const absC = Math.abs(c);

      let coefStr = '';
      if (k === 0) {
        coefStr = absC.toFixed(decimals);
      } else {
        coefStr = Math.abs(absC - 1) < eps ? '' : absC.toFixed(decimals) + '·';
      }

      let varPart = '';
      if (k === 1) varPart = variable;
      else if (k >= 2) varPart = `${variable}^${k}`;

      parts.push({ sign, term: `${coefStr}${varPart}` });
    }

    if (parts.length === 0) return '0';
    const first = parts[0];
    let s = (first.sign === '+' ? '' : '-') + first.term;
    for (let i = 1; i < parts.length; i++) s += ` ${parts[i].sign} ${parts[i].term}`;
    return s;
  }

  formatNewton(a: number[], xs: number[], variable: string, decimals: number): string {
    const eps = Math.pow(10, -decimals);
    const roundFix = (n: number) => (Math.abs(n) < eps ? 0 : Number(n.toFixed(decimals)));

    const parts: string[] = [];
    for (let k = 0; k < a.length; k++) {
      let ak = roundFix(a[k]);
      if (ak === 0) continue;

      if (k === 0) {
        parts.push(`${ak.toFixed(decimals)}`);
        continue;
      }

      const factors: string[] = [];
      for (let j = 0; j < k; j++) {
        const xj = roundFix(xs[j]).toFixed(decimals);
        factors.push(`(${variable} - ${xj})`);
      }

      const absAk = Math.abs(ak);
      const coefTok = Math.abs(absAk - 1) < eps ? '' : `${absAk.toFixed(decimals)}·`;
      const term = `${coefTok}${factors.join('·')}`;

      parts.push(ak > 0 ? `+ ${term}` : `- ${term}`);
    }

    let s = parts.join(' ');
    s = s.replace(/^\+ /, '');
    return s.length ? s : '0';
  }

  formatNum(n: number): string { return Number(n).toFixed(this.decimals); }
}
