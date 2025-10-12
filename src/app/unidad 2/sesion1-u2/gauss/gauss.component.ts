import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type StepKind = 'validate' | 'pivot' | 'swap' | 'eliminate' | 'backsub' | 'done';

interface GaussStep {
  kind: StepKind;
  title: string;
  detail?: string;
  /** Matriz aumentada en este paso (copia para la UI) */
  A: number[][];
  /** Para resaltar visualmente */
  highlightRow?: number;
  highlightCol?: number;
  /** Texto corto de operación (p.ej. R3 ← R3 − 1.25·R2) */
  operation?: string;
  /** Información adicional (factor, x_i, etc.) */
  meta?: Record<string, any>;
}

@Component({
  selector: 'app-gauss',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './gauss.component.html',
})
export class GaussComponent {
  /** Tolerancia numérica para decidir “casi cero” en pivotes/factores. */
  private readonly EPS = 1e-10;

  /** Matriz aumentada n × (n+1) (estado base). */
  matrix = signal<number[][]>([]);
  /** Buffer editable que se muestra en la UI y desde donde se resuelve. */
  tempMatrix = signal<number[][]>([]);
  /** Solución x. */
  solutions = signal<number[]>([]);
  /** Mensaje de estado. */
  message = signal<string | null>(null);
  /** Pasos del método (para la UI). */
  steps = signal<GaussStep[]>([]);
  /** Norma infinito del residuo ||Ax - b||∞ (opcional, para validar solución). */
  residualInf = signal<number | null>(null);

  constructor() {
    this.adjustMatrixSize(3);
  }

  // ===== Utilidades =====

  private clone(A: number[][]): number[][] {
    return A.map((r) => [...r]);
  }

  /** Formatea número para UI (evita -0, fuerza 4–6 decimales). */
  format(x: number, decimals = 4): string {
    const v = Math.abs(x) < 1e-12 ? 0 : x;
    return v.toFixed(decimals);
  }

  /** Push seguro de un paso (clona la matriz para evitar mutaciones posteriores). */
  private pushStep(step: GaussStep) {
    const snap = this.clone(step.A);
    this.steps.update((arr) => [...arr, { ...step, A: snap }]);
  }

  /** Dibuja texto tipo Rr ← Rr − factor·Ri (con factor redondeado). */
  private opText(r: number, i: number, factor: number): string {
    const f = this.format(factor, 4);
    const sign = factor >= 0 ? '−' : '+'; // porque restamos (factor * Ri)
    const absf = this.format(Math.abs(factor), 4);
    return `R${r + 1} ← R${r + 1} ${sign} ${absf}·R${i + 1}`;
  }

  // ===== Inputs (texto → número) =====

  onInputChange(value: string, i: number, j: number): void {
    const normalized = (value ?? '')
      .toString()
      .replace(/[^0-9.+-eE]/g, '')
      .replace(',', '.');
    const num = normalized === '' ? 0 : Number(normalized);

    if (!Number.isNaN(num)) {
      const M = this.clone(this.tempMatrix());
      M[i][j] = num;
      this.tempMatrix.set(M);
      this.message.set(null);
    } else {
      this.message.set('⚠ Solo números válidos (enteros/decimales).');
    }
  }

  // ===== Redimensionar =====

  adjustMatrixSize(n: number): void {
    if (!Number.isFinite(n) || n < 2 || n > 10) return;

    const make = (rows: number, cols: number) =>
      Array.from({ length: rows }, () => Array(cols).fill(0));

    const fresh = make(n, n + 1);
    this.matrix.set(fresh);
    this.tempMatrix.set(this.clone(fresh));
    this.solutions.set([]);
    this.steps.set([]);
    this.residualInf.set(null);
    this.message.set(null);
  }

  // ===== Resolver (Gauss + Back-Substitution) con pasos visuales =====

  solveSystem(): void {
    // Reset de pasos/estado
    this.steps.set([]);
    this.solutions.set([]);
    this.residualInf.set(null);
    this.message.set(null);

    const A = this.clone(this.tempMatrix());
    const n = A.length;

    // Paso 0) Validación de forma aumentada
    if (n === 0 || A[0].length !== n + 1) {
      this.message.set('La matriz no tiene el formato correcto (n × (n+1)).');
      return;
    }

    this.pushStep({
      kind: 'validate',
      title: 'Validación',
      detail: 'Se verifica que la matriz sea n × (n+1).',
      A,
    });

    // ========== GAUSS: Eliminación hacia adelante con pivoteo parcial ==========
    for (let i = 0; i < n; i++) {
      // Selección de pivote (máximo |A[r][i]| en filas i..n-1)
      let pivot = i;
      for (let r = i + 1; r < n; r++) {
        if (Math.abs(A[r][i]) > Math.abs(A[pivot][i])) pivot = r;
      }

      this.pushStep({
        kind: 'pivot',
        title: `Selección de pivote en columna ${i + 1}`,
        detail: `Se elige la fila ${pivot + 1} por tener el mayor |A[r][${i + 1}]|.`,
        A,
        highlightRow: pivot,
        highlightCol: i,
      });

      // Pivote ~ 0 → no hay solución única
      if (Math.abs(A[pivot][i]) < this.EPS) {
        this.message.set('La matriz es singular o no hay solución única.');
        this.solutions.set([]);
        return;
      }

      // Intercambio de filas si el pivote no está en la fila i
      if (pivot !== i) {
        const tmp = A[i];
        A[i] = A[pivot];
        A[pivot] = tmp;

        this.pushStep({
          kind: 'swap',
          title: `Intercambio de filas: R${i + 1} ↔ R${pivot + 1}`,
          detail: `Se mueve el pivote a la posición (${i + 1}, ${i + 1}).`,
          A,
          highlightRow: i, // nueva fila del pivote
          highlightCol: i,
        });
      }

      // Eliminación por debajo del pivote
      for (let r = i + 1; r < n; r++) {
        const factor = A[r][i] / A[i][i];
        if (Math.abs(factor) < this.EPS) continue;

        for (let c = i; c <= n; c++) {
          A[r][c] -= factor * A[i][c];
        }

        this.pushStep({
          kind: 'eliminate',
          title: `Eliminación en fila ${r + 1}`,
          detail: `Anulando la entrada de la columna ${i + 1} por debajo del pivote.`,
          A,
          highlightRow: r,
          highlightCol: i,
          operation: this.opText(r, i, factor),
          meta: { factor },
        });
      }
    }

    // ========== Sustitución hacia atrás ==========
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) sum += A[i][j] * x[j];
      x[i] = (A[i][n] - sum) / A[i][i];

      this.pushStep({
        kind: 'backsub',
        title: `Sustitución hacia atrás: x${i + 1}`,
        detail: `x${i + 1} = (b${i + 1} − Σ A[${i + 1},j]·x_j) / A[${i + 1},${i + 1}]`,
        A,
        highlightRow: i,
        highlightCol: i,
        meta: { xi: x[i], sum },
      });
    }

    // Publicar resultados
    this.solutions.set(x);

    // Cálculo opcional del residuo con la matriz ORIGINAL (no triangular)
    const Aorig = this.clone(this.tempMatrix());
    const res = this.residualInfinityNorm(Aorig, x);
    this.residualInf.set(res);

    this.pushStep({
      kind: 'done',
      title: 'Triangular superior + solución obtenida',
      detail: 'Se completa Gauss y la sustitución hacia atrás.',
      A,
    });

    this.message.set('Sistema resuelto con éxito.');
  }

  /** ||Ax - b||∞ usando la matriz aumentada original */
  private residualInfinityNorm(Aaug: number[][], x: number[]): number {
    let max = 0;
    for (let i = 0; i < Aaug.length; i++) {
      const n = Aaug[i].length - 1;
      let Ax = 0;
      for (let j = 0; j < n; j++) Ax += Aaug[i][j] * x[j];
      const bi = Aaug[i][n];
      const ri = Math.abs(Ax - bi);
      if (ri > max) max = ri;
    }
    return max;
  }
}
