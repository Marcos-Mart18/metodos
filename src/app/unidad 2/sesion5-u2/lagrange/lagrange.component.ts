import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Point = { x: number; y: number };

@Component({
  selector: 'app-lagrange',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lagrange.component.html',
  styleUrls: ['./lagrange.component.css'],
})
export class LagrangeComponent {
  // UI
  mode: 'texto' | 'tabla' = 'tabla';
  decimals = 4;
  error: string | null = null;
  calculado = false;

  // Texto (listas X e Y)
  xText = '';
  yText = '';

  // Tabla
  points: Array<{ x: number | null; y: number | null }> = [
    { x: null, y: null },
    { x: null, y: null },
    { x: null, y: null }
  ];

  // Resultados
  coeffs: number[] = [];
  polyString = '';
  degree = 0;

  // Evaluación
  tEval: number | null = null;
  pEval: number | null = null;

  // ========= Acciones UI =========
  addRow() { this.points.push({ x: null, y: null }); }
  removeRow(i: number) { this.points.splice(i, 1); }

  clear() {
    this.xText = '';
    this.yText = '';
    this.points = [{ x: null, y: null }, { x: null, y: null }, { x: null, y: null }];
    this.coeffs = [];
    this.polyString = '';
    this.degree = 0;
    this.tEval = null;
    this.pEval = null;
    this.error = null;
    this.calculado = false;
  }

  // ========= Cálculo principal =========
  calculate() {
    this.error = null;

    let pts: Point[] = this.mode === 'texto' ? this.parseTextPoints() : this.collectTablePoints();

    if (pts.length < 2) {
      this.error = 'Necesitas al menos 2 puntos (x, y).';
      this.calculado = false;
      return;
    }

    // x deben ser distintos
    const xs = pts.map(p => p.x);
    const hasDup = xs.some((x, i) => xs.indexOf(x) !== i);
    if (hasDup) {
      this.error = 'Hay valores de x repetidos; Lagrange requiere x distintos.';
      this.calculado = false;
      return;
    }

    // ordenar por x (solo por prolijidad)
    pts = pts.slice().sort((a, b) => a.x - b.x);

    // Coeficientes del polinomio en forma estándar: P(x) = a0 + a1 x + ... + an x^n
    this.coeffs = this.lagrangeCoefficients(pts);
    this.degree = this.trueDegree(this.coeffs);
    this.polyString = this.formatPolynomial(this.coeffs, 'x', this.decimals);
    this.calculado = true;

    this.evaluate(); // si ya hay un t cargado, actualiza P(t)
  }

  evaluate() {
    if (this.tEval === null || isNaN(Number(this.tEval)) || !this.calculado) {
      this.pEval = null;
      return;
    }
    this.pEval = this.polyEval(this.coeffs, Number(this.tEval));
  }

  // ========= Entrada texto / tabla =========
  parseTextPoints(): Point[] {
    const split = (s: string) =>
      s.trim()
        .split(/[,\s;]+/g)
        .filter(Boolean)
        .map(v => Number(v));

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
      if (r.x === null && r.y === null) continue; // fila vacía
      if (r.x === null || r.y === null || !isFinite(Number(r.x)) || !isFinite(Number(r.y))) {
        this.error = 'Completa los campos numéricos de la tabla o elimina filas vacías.';
        return [];
      }
      pts.push({ x: Number(r.x), y: Number(r.y) });
    }
    return pts;
  }

  // ========= Núcleo numérico (Lagrange) =========
  lagrangeCoefficients(points: Point[]): number[] {
    // P(x) = sum_i yi * Li(x), Li(x) = prod_{j!=i} (x - xj)/(xi - xj)
    let res: number[] = [0];
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const xi = points[i].x;
      const yi = points[i].y;

      let numerator: number[] = [1]; // polinomio 1
      let denom = 1;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const xj = points[j].x;

        // (x - xj) => [-xj, 1]
        numerator = this.polyMul(numerator, [-xj, 1]);
        denom *= (xi - xj);
      }

      const term = this.polyScale(numerator, yi / denom);
      res = this.polyAdd(res, term);
    }
    return res;
  }

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

  polyEval(coeffs: number[], x: number): number {
    // Horner
    let r = 0;
    for (let i = coeffs.length - 1; i >= 0; i--) r = r * x + coeffs[i];
    return r;
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

      // Texto del coeficiente
      let coefStr = '';
      if (k === 0) {
        coefStr = absC.toFixed(decimals);
      } else {
        if (Math.abs(absC - 1) < eps) {
          coefStr = ''; // omitir 1 en términos con x
        } else {
          coefStr = absC.toFixed(decimals) + '·';
        }
      }

      // Parte en x
      let varPart = '';
      if (k === 1) varPart = variable;
      else if (k >= 2) varPart = `${variable}^${k}`;

      parts.push({ sign, term: `${coefStr}${varPart}` });
    }

    if (parts.length === 0) return '0';

    // Primera pieza sin '+' inicial
    const first = parts[0];
    let s = (first.sign === '+' ? '' : '-') + first.term;
    for (let i = 1; i < parts.length; i++) s += ` ${parts[i].sign} ${parts[i].term}`;
    return s;
  }

  formatNum(n: number): string {
    return Number(n).toFixed(this.decimals);
  }
}
