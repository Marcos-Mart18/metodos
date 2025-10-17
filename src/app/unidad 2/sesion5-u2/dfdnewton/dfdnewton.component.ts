import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type Point = { x: number; y: number };

@Component({
  selector: 'app-dfdnewton',
  standalone: true,
  imports: [CommonModule, FormsModule,RouterLink],
  templateUrl: './dfdnewton.component.html',
  styleUrls: ['./dfdnewton.component.css']
})
export class DfdnewtonComponent {
  // UI
  mode: 'tabla' | 'texto' = 'tabla';
  decimals = 4;
  error: string | null = null;
  calculado = false;
  sortAsc = false;       // respeta orden de entrada por defecto
  showSteps = true;      // mostrar/ocultar pasos

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
  newtonString = '';               // forma de Newton (texto)
  coeffsStd: number[] = [];        // forma estándar: a0 + a1 x + ...
  polyStdString = '';
  degree = 0;

  // Evaluación
  tEval: number | null = null;
  pEval: number | null = null;

  // Pasos LaTeX
  latexSteps: string[] = [];

  // ==== Acciones UI ====
  addRow() { this.points.push({ x: null, y: null }); }
  removeRow(i: number) { this.points.splice(i, 1); }
  clear() {
    this.mode = 'tabla';
    this.decimals = 4;
    this.error = null;
    this.calculado = false;
    this.sortAsc = false;
    this.showSteps = true;

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
    this.latexSteps = [];
    this.typeset();
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
    const xsCheck = pts.map(p => p.x);
    const hasDup = xsCheck.some((x, i) => xsCheck.indexOf(x) !== i);
    if (hasDup) {
      this.error = 'Hay valores de x repetidos; se requieren x distintos.';
      this.calculado = false;
      return;
    }

    // Respeta orden de entrada, a menos que el usuario decida ordenar
    if (this.sortAsc) {
      pts = pts.slice().sort((a, b) => a.x - b.x);
    }
    this.xs = pts.map(p => p.x);

    // Construir tabla de diferencias divididas
    this.ddTable = this.buildDividedDifferences(pts);

    // Coeficientes de Newton (a_k = ddTable[0][k])
    this.newtonCoeffs = this.ddTable.length
      ? this.ddTable[0].slice(0, pts.length)
      : [];

    // Forma de Newton (string visible)
    this.newtonString = this.formatNewton(this.newtonCoeffs, this.xs, 'x', this.decimals);

    // Convertir a forma estándar (expandido)
    this.coeffsStd = this.newtonToStandard(this.newtonCoeffs, this.xs);
    this.degree = this.trueDegree(this.coeffsStd);
    this.polyStdString = this.formatPolynomial(this.coeffsStd, 'x', this.decimals);

    this.calculado = true;

    // Pasos en LaTeX
    this.latexSteps = this.buildLatexSteps(pts, this.xs, this.ddTable, this.newtonCoeffs, this.coeffsStd);
    this.evaluate();   // si hay t cargado, recalcula P(t) y añade paso de evaluación
    this.typeset();
  }

  evaluate() {
    if (!this.calculado || this.tEval === null || isNaN(Number(this.tEval))) {
      this.pEval = null;
      this.typeset();
      return;
    }
    this.pEval = this.newtonEval(this.newtonCoeffs, this.xs, Number(this.tEval));

    // Paso de evaluación (último)
    const evalLatex =
      `$$\\displaystyle P(${this.num(this.tEval)})\\;=\\;${this.num(this.pEval)}.$$`;
    const idx = this.latexSteps.findIndex(s => s.includes('P(') && s.includes(')='));
    if (idx >= 0) this.latexSteps[idx] = evalLatex; else this.latexSteps.push(evalLatex);
    this.typeset();
  }

  // ==== Parseo de entradas ====
  parseTextPoints(): Point[] {
    const split = (s: string) =>
      s.trim().split(/[,\s;]+/g).filter(Boolean).map(Number);

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

    // Orden 0: y
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

  // Evaluar P(t) en forma de Newton
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
    let res: number[] = [0];
    let basis: number[] = [1]; // 1
    for (let k = 0; k < a.length; k++) {
      res = this.polyAdd(res, this.polyScale(basis, a[k]));
      if (k < a.length - 1) basis = this.polyMul(basis, [-xs[k], 1]); // (x - xk)
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
      if (k === 0) coefStr = absC.toFixed(decimals);
      else coefStr = Math.abs(absC - 1) < eps ? '' : absC.toFixed(decimals) + '·';
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
      if (k === 0) { parts.push(`${ak.toFixed(decimals)}`); continue; }
      const factors: string[] = [];
      for (let j = 0; j < k; j++) {
        const xj = roundFix(xs[j]).toFixed(decimals);
        factors.push(`( ${variable} - ${xj} )`);
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

  // ==== LaTeX ====
  private buildLatexSteps(points: Point[], xs: number[], dd: number[][], a: number[], coeffsStd: number[]): string[] {
    const n = points.length - 1;
    const num = (v: number) => this.num(v);

    const steps: string[] = [];

    // Paso 1: Datos
    const pairs = points.map((p, i) => `(x_{${i}},y_{${i}})=(${num(p.x)},\\,${num(p.y)})`).join(',\\; ');
    steps.push(`$$\\textbf{Paso 1. Datos:}\\; ${pairs}.$$`);

    // Paso 2: Definición de diferencias divididas
    steps.push(
      `$$\\textbf{Paso 2. Definición:}\\;
        f[x_i]=y_i,\\quad
        f[x_i,\\dots,x_{i+j}] = \\frac{f[x_{i+1},\\dots,x_{i+j}] - f[x_i,\\dots,x_{i+j-1}]}{x_{i+j}-x_i}.$$`
    );

    // Paso 3: Tabla de diferencias divididas (en LaTeX)
    steps.push(this.latexDDTable(xs, dd));

    // Paso 4: Coeficientes de Newton y forma
    const akList = a.map((v, k) => `a_{${k}} = f[x_0,\\dots,x_{${k}}] = ${num(v)}`).join(',\\; ');
    const newtonSymbolic =
      Array.from({ length: a.length }, (_, k) => {
        if (k === 0) return 'a_0';
        const facs = Array.from({ length: k }, (__ , j) => `(x-x_{${j}})`).join('');
        return `a_${k}${facs}`;
      }).join(' + ');

    const newtonNumeric =
      a.map((ak, k) => {
        if (k === 0) return `${num(ak)}`;
        const facs = Array.from({ length: k }, (_, j) => `(x-${num(xs[j])})`).join('');
        const coef = num(ak);
        const coefTok = Math.abs(Number(coef)) === 1 && k>0 ? (Number(coef) < 0 ? '-' : '') : `${coef}\\,`;
        return `${coefTok}${facs}`;
      }).join(' + ').replace(/\+\s-\s/g, '- ');

    steps.push(`$$\\textbf{Paso 4. Coeficientes:}\\; ${akList}.$$`);
    steps.push(`$$\\text{Forma de Newton:}\\; P(x)= ${newtonSymbolic} = ${newtonNumeric}.$$`);

    // Paso 5: Forma estándar
    const polyStdLatex = this.latexPolynomial(coeffsStd, 'x');
    steps.push(`$$\\textbf{Paso 5. Forma estándar:}\\; P(x)= ${polyStdLatex}.$$`);

    return steps;
  }

  private latexDDTable(xs: number[], dd: number[][]): string {
    const n = xs.length;
    const cols = 'c|c|' + 'c'.repeat(n); // i | x | f[...] | Orden 1..n-1
    let header = `i & x_i & f[x_i]`;
    for (let j = 1; j < n; j++) header += ` & \\text{Orden }${j}`;
    header += `\\\\\\hline`;

    let rows = '';
    for (let i = 0; i < n; i++) {
      let row = `${i} & ${this.num(xs[i])} & ${this.num(dd[i][0])}`;
      for (let j = 1; j < n; j++) {
        if (i <= n - 1 - j) row += ` & ${this.num(dd[i][j])}`;
        else row += ` & `;
      }
      rows += row + `\\\\`;
    }

    return `$$\\begin{array}{${cols}}\\hline ${header} ${rows} \\hline\\end{array}$$`;
  }

  private latexPolynomial(coeffs: number[], variable: string): string {
    const eps = Math.pow(10, -this.decimals);
    const parts: string[] = [];
    for (let k = coeffs.length - 1; k >= 0; k--) {
      let c = Number(coeffs[k].toFixed(this.decimals));
      if (Math.abs(c) < eps) continue;
      const sign = c >= 0 ? '+' : '-';
      c = Math.abs(c);
      let term = '';
      if (k === 0) term = `${this.num(c)}`;
      else if (k === 1) term = (Math.abs(c - 1) < eps) ? `${variable}` : `${this.num(c)}${variable}`;
      else term = (Math.abs(c - 1) < eps) ? `${variable}^{${k}}` : `${this.num(c)}${variable}^{${k}}`;
      parts.push(`${sign} ${term}`);
    }
    if (!parts.length) return '0';
    let s = parts.join(' ');
    s = s.replace(/^\+\s/, ''); // quitar signo inicial +
    s = s.replace(/\+\s-\s/g, '- ');
    return s;
  }

  private num(v: number | null): string {
    return Number(v ?? 0).toFixed(this.decimals).replace(/-0\.0+$/,'0');
  }

  // Re-tiposet (MathJax v3 si está disponible)
  private typeset() {
    setTimeout(() => {
      (window as any)?.MathJax?.typesetPromise?.();
    }, 0);
  }
}
