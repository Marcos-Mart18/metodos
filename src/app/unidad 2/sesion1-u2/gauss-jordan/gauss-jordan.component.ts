import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type StepKind =
  | 'validate' | 'pivot' | 'swap' | 'scale' | 'eliminate'
  | 'inconsistent' | 'rank' | 'done';

interface JordanStep {
  kind: StepKind;
  title: string;
  detail?: string;
  /** Snapshot de la matriz aumentada en este paso */
  A: number[][];
  /** Para resaltar visualmente */
  highlightRow?: number;
  highlightCol?: number;
  /** Texto corto de la operación, p.ej.: R3 ← R3 − 1.25·R2 */
  operation?: string;
  /** Datos extra (factor, div, etc.) */
  meta?: Record<string, any>;
}

@Component({
  selector: 'app-gauss-jordan',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './gauss-jordan.component.html',
})
export class GaussJordanComponent {
  // Matriz aumentada (n × (n+1))
  matrix = signal<number[][]>([]);
  // Matriz temporal (inputs en UI)
  tempMatrix = signal<number[][]>([]);
  // Soluciones (si únicas)
  solutions = signal<number[]>([]);
  // Mensaje de estado
  message = signal<string | null>(null);
  // Pasos del método (para UI)
  steps = signal<JordanStep[]>([]);
  private readonly EPS = 1e-10;

  constructor() {
    this.adjustMatrixSize(3);
  }

  // ===== Utils =====
  private clone(A: number[][]): number[][] {
    return A.map(r => [...r]);
  }

  format(x: number, decimals = 4): string {
    const v = Math.abs(x) < 1e-12 ? 0 : x;
    return v.toFixed(decimals);
  }

  private pushStep(step: JordanStep) {
    const snap = this.clone(step.A);
    this.steps.update(arr => [...arr, { ...step, A: snap }]);
  }

  private opScale(row: number, div: number): string {
    const d = this.format(div, 4);
    return `R${row + 1} ← R${row + 1} / ${d}`;
  }

  private opElim(r: number, pivRow: number, factor: number): string {
    const sign = factor >= 0 ? '−' : '+';
    const absf = this.format(Math.abs(factor), 4);
    return `R${r + 1} ← R${r + 1} ${sign} ${absf}·R${pivRow + 1}`;
  }

  // ===== Redimensionar =====
  adjustMatrixSize(size: number): void {
    if (!Number.isFinite(size) || size < 2 || size > 10) return;
    const M: number[][] = Array.from({ length: size }, () =>
      Array(size + 1).fill(0)
    );
    this.matrix.set(M);
    this.tempMatrix.set(this.clone(M));
    this.solutions.set([]);
    this.steps.set([]);
    this.message.set(null);
  }

  // ===== Inputs (texto → número) =====
  onInputChange(value: string, row: number, col: number): void {
    const normalized = (value ?? '')
      .toString()
      .replace(/[^0-9.+-eE]/g, '')
      .replace(',', '.');
    const num = normalized === '' ? 0 : Number(normalized);
    if (!Number.isNaN(num)) {
      const updated = this.clone(this.tempMatrix());
      updated[row][col] = num;
      this.tempMatrix.set(updated);
      this.message.set(null);
    } else {
      this.message.set('⚠ Solo se permiten números (enteros/decimales).');
    }
  }

  // ===== Gauss–Jordan (RREF) con pasos visuales =====
  solveSystem(): void {
    // Reset
    this.steps.set([]);
    this.solutions.set([]);
    this.message.set(null);

    const A = this.clone(this.tempMatrix());
    const n = A.length;

    // Validación forma n × (n+1)
    if (n === 0 || A[0].length !== n + 1) {
      this.message.set('La matriz no tiene el formato n×(n+1).');
      return;
    }
    this.pushStep({
      kind: 'validate',
      title: 'Validación',
      detail: 'Se verifica que la matriz sea n × (n+1).',
      A,
    });

    // RREF
    let row = 0; // fila actual del pivote
    for (let col = 0; col < n && row < n; col++) {
      // 1) Selección de pivote en columna 'col'
      let pivot = row;
      for (let r = row + 1; r < n; r++) {
        if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
      }
      this.pushStep({
        kind: 'pivot',
        title: `Selección de pivote en columna ${col + 1}`,
        detail: `Se prefiere la fila ${pivot + 1} con mayor |A[r,${col + 1}]|.`,
        A,
        highlightRow: pivot,
        highlightCol: col,
      });

      // Si no hay pivote “usable”, saltar a la siguiente columna
      if (Math.abs(A[pivot][col]) < this.EPS) {
        this.pushStep({
          kind: 'rank',
          title: `Columna ${col + 1} sin pivote utilizable`,
          detail: 'No se encontró pivote (≈0). Se intenta con la siguiente columna.',
          A,
          highlightCol: col,
        });
        continue;
      }

      // 2) Intercambio de filas (subir pivote a 'row')
      if (pivot !== row) {
        const tmp = A[row]; A[row] = A[pivot]; A[pivot] = tmp;
        this.pushStep({
          kind: 'swap',
          title: `Intercambio de filas: R${row + 1} ↔ R${pivot + 1}`,
          detail: `Se coloca el pivote en la posición (${row + 1}, ${col + 1}).`,
          A,
          highlightRow: row,
          highlightCol: col,
        });
      }

      // 3) Escalar la fila del pivote para dejar pivote = 1
      const div = A[row][col];
      if (Math.abs(div) >= this.EPS) {
        for (let k = col; k <= n; k++) A[row][k] /= div;
        this.pushStep({
          kind: 'scale',
          title: `Normalización del pivote`,
          detail: `Se divide la fila R${row + 1} entre ${this.format(div, 6)} para fijar el pivote en 1.`,
          A,
          highlightRow: row,
          highlightCol: col,
          operation: this.opScale(row, div),
          meta: { div },
        });
      }

      // 4) Eliminar todos los elementos de la columna 'col' (arriba y abajo)
      for (let r = 0; r < n; r++) {
        if (r === row) continue;
        const factor = A[r][col];
        if (Math.abs(factor) < this.EPS) continue;
        for (let k = col; k <= n; k++) {
          A[r][k] -= factor * A[row][k];
        }
        this.pushStep({
          kind: 'eliminate',
          title: `Eliminación en fila ${r + 1}`,
          detail: `Se anula A[${r + 1}, ${col + 1}] usando la fila pivote.`,
          A,
          highlightRow: r,
          highlightCol: col,
          operation: this.opElim(r, row, factor),
          meta: { factor },
        });
      }

      row++; // siguiente fila pivote
    }

    // Detección de inconsistencia: [0 ... 0 | b] con b≠0
    for (let i = 0; i < n; i++) {
      let allZero = true;
      for (let j = 0; j < n; j++) {
        if (Math.abs(A[i][j]) > this.EPS) { allZero = false; break; }
      }
      if (allZero && Math.abs(A[i][n]) > this.EPS) {
        this.matrix.set(A);
        this.solutions.set([]);
        this.pushStep({
          kind: 'inconsistent',
          title: 'Inconsistencia detectada',
          detail: `Fila ${i + 1} del tipo [0 … 0 | b], con b ≠ 0.`,
          A,
          highlightRow: i,
        });
        this.message.set('El sistema es inconsistente: no tiene solución.');
        return;
      }
    }

    // Rango
    let rank = 0;
    for (let i = 0; i < n; i++) {
      let hasCoeff = false;
      for (let j = 0; j < n; j++) {
        if (Math.abs(A[i][j]) > this.EPS) { hasCoeff = true; break; }
      }
      if (hasCoeff) rank++;
    }

    if (rank < n) {
      this.matrix.set(A);
      this.solutions.set([]);
      this.pushStep({
        kind: 'rank',
        title: 'Rango menor que n',
        detail: 'Existen variables libres → infinitas soluciones.',
        A,
      });
      this.message.set('Infinitas soluciones (existen variables libres).');
      return;
    }

    // Solución única: x = última columna (ya en RREF)
    const sol = new Array(n).fill(0);
    for (let i = 0; i < n; i++) sol[i] = A[i][n];

    this.matrix.set(A);
    this.solutions.set(sol);
    this.pushStep({
      kind: 'done',
      title: 'RREF obtenida',
      detail: 'Se alcanzó la forma reducida por filas; solución única.',
      A,
    });
    this.message.set('Sistema resuelto con éxito.');
  }
}
