import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-jacobi',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './jacobi.component.html',
})
export class JacobiComponent {
  // Estado principal (Signals)
  matrix = signal<number[][]>([]);
  tempMatrix = signal<number[][]>([]);
  x0 = signal<number[]>([]);
  tol = signal<number>(1e-6);
  maxIter = signal<number>(200);

  solution = signal<number[]>([]);
  iterations = signal<{ k: number; x: number[]; err: number }[]>([]);
  message = signal<string | null>(null);
  diagDominant = signal<boolean | null>(null);

  messageClass = computed(() => {
    const m = this.message();
    if (!m) return 'bg-gray-50 text-gray-700 border border-gray-200';
    if (m.startsWith('✔'))
      return 'bg-green-100 text-green-800 border border-green-300';
    if (m.startsWith('⚠'))
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    return 'bg-red-100 text-red-800 border border-red-300';
  });

  private readonly EPS = 1e-12;

  constructor() {
    this.adjustMatrixSize(3); // por defecto
  }

  // ---------- Utilidades ----------
  private clone<T>(A: T[][]): T[][] {
    return A.map((r) => [...r]);
  }
  private zeros(n: number, m: number): number[][] {
    return Array.from({ length: n }, () => Array(m).fill(0));
  }
  private normInf(v: number[]): number {
    let m = 0;
    for (const x of v) m = Math.max(m, Math.abs(x));
    return m;
  }
  private sub(a: number[], b: number[]): number[] {
    return a.map((ai, i) => ai - b[i]);
  }

  // Entradas
  onInputChange(value: string, i: number, j: number): void {
    const normalized = (value ?? '')
      .toString()
      .replace(/[^0-9.+\-eE]/g, '')
      .replace(',', '.');
    const num = normalized === '' ? 0 : Number(normalized);
    if (!Number.isNaN(num)) {
      const T = this.clone(this.tempMatrix());
      T[i][j] = num;
      this.tempMatrix.set(T);
      this.message.set(null);
    } else {
      this.message.set('⚠ Solo números válidos.');
    }
  }

  onX0Change(value: string, i: number): void {
    const normalized = (value ?? '')
      .toString()
      .replace(/[^0-9.+\-eE]/g, '')
      .replace(',', '.');
    const num = normalized === '' ? 0 : Number(normalized);
    if (!Number.isNaN(num)) {
      const v = [...this.x0()];
      v[i] = num;
      this.x0.set(v);
      this.message.set(null);
    } else {
      this.message.set('⚠ Solo números válidos en x₀.');
    }
  }

  onTolChange(value: string): void {
    const v = Number((value ?? '').toString().replace(',', '.'));
    if (Number.isFinite(v) && v > 0) this.tol.set(v);
  }

  onMaxIterChange(v: number): void {
    if (Number.isFinite(v) && v >= 1 && v <= 10000) this.maxIter.set(v);
  }

  // Redimensionar a n × (n+1)
  adjustMatrixSize(n: number): void {
    if (!Number.isFinite(n) || n < 2 || n > 10) return;
    const fresh = this.zeros(n, n + 1);
    this.matrix.set(fresh);
    this.tempMatrix.set(this.clone(fresh));
    this.x0.set(Array(n).fill(0));
    this.solution.set([]);
    this.iterations.set([]);
    this.message.set(null);
    this.diagDominant.set(null);
  }

  // Chequeos
  private hasZeroDiagonal(A: number[][]): boolean {
    const n = A.length;
    for (let i = 0; i < n; i++) if (Math.abs(A[i][i]) <= this.EPS) return true;
    return false;
  }

  private isDiagonallyDominant(A: number[][]): boolean {
    const n = A.length;
    let hasStrict = false;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) if (j !== i) sum += Math.abs(A[i][j]);
      const diag = Math.abs(A[i][i]);
      if (diag < sum - 1e-14) return false; // no dominante
      if (diag > sum + 1e-14) hasStrict = true; // estricta en alguna fila
    }
    return hasStrict; // dominante y estricta en al menos una fila
  }

  // Jacobi core
  private jacobi(
    A: number[][],
    b: number[],
    x0: number[],
    tol: number,
    maxIter: number
  ) {
    const n = A.length;
    let x = [...x0];
    const log: { k: number; x: number[]; err: number }[] = [];

    for (let k = 1; k <= maxIter; k++) {
      const xNew = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) if (j !== i) s += A[i][j] * x[j];
        xNew[i] = (b[i] - s) / A[i][i];
      }

      const dx = this.sub(xNew, x);
      const err = this.normInf(dx) / Math.max(this.normInf(xNew), this.EPS);

      log.push({ k, x: [...xNew], err });
      x = xNew;

      if (err <= tol) return { ok: true as const, x, log, k };
    }
    return { ok: false as const, x, log, k: maxIter };
  }

  // Resolver
  solveJacobi(): void {
    const n = this.tempMatrix().length;
    if (n === 0 || this.tempMatrix()[0].length !== n + 1) {
      this.message.set('✖ Formato inválido: se espera n × (n+1).');
      return;
    }

    // A y b
    const A = this.zeros(n, n);
    const b = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] = this.tempMatrix()[i][j];
      b[i] = this.tempMatrix()[i][n];
    }

    if (this.hasZeroDiagonal(A)) {
      this.solution.set([]);
      this.iterations.set([]);
      this.message.set(
        '✖ Hay ceros en la diagonal. Reordena filas/columnas o usa otro método.'
      );
      this.diagDominant.set(null);
      return;
    }

    const dominant = this.isDiagonallyDominant(A);
    this.diagDominant.set(dominant);
    if (!dominant) {
      // Advertimos pero seguimos
      this.message.set(
        '⚠ A no es diagonalmente dominante estricta. Jacobi podría no converger.'
      );
    } else {
      this.message.set(null);
    }

    const { ok, x, log, k } = this.jacobi(
      A,
      b,
      this.x0(),
      this.tol(),
      this.maxIter()
    );
    this.solution.set(x);
    this.iterations.set(log);
    if (ok) {
      this.message.set(`✔ Convergió en k = ${k} iteraciones.`);
    } else {
      this.message.set(
        `⚠ No convergió en ${k} iteraciones. Prueba reducir ε, aumentar iteraciones o reordenar A.`
      );
    }
  }

  // Ejemplo rápido (dominante)
  fillExample(): void {
    const A = [
      [10, -1, 2, 0, 6], // fila 1 (a11..a1n | b1)
      [-1, 11, -1, 3, 25],
      [2, -1, 10, -1, -11],
      [0, 3, -1, 8, 15],
    ];
    this.tempMatrix.set(A.map((r) => [...r]));
    this.matrix.set(this.zeros(4, 5));
    this.x0.set([0, 0, 0, 0]);
    this.tol.set(1e-6);
    this.maxIter.set(200);
    this.solution.set([]);
    this.iterations.set([]);
    this.message.set('⚙ Ejemplo cargado. Presiona “Resolver”.');
    this.diagDominant.set(null);
  }
}
