import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-gauss',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './gauss.component.html',
})
export class GaussComponent {
  // Matriz aumentada n x (n+1)
  private EPS = 1e-10;

  matrix = signal<number[][]>([]);
  // Buffer para inputs (evita que "Resolver" edite los campos)
  tempMatrix = signal<number[][]>([]);
  // Soluciones
  solutions = signal<number[]>([]);
  // Mensaje de estado
  message = signal<string | null>(null);

  constructor() {
    // tamaño por defecto opcional
    this.adjustMatrixSize(3);
  }

  // ===== Utils =====
  private clone(A: number[][]): number[][] {
    return A.map(r => [...r]);
  }

  // ===== Inputs (texto -> número) =====
  onInputChange(value: string, i: number, j: number): void {
    // permitir negativos y decimales; limpiar otros chars
    const normalized = (value ?? '').toString().replace(/[^0-9.+-eE]/g, '').replace(',', '.');
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
    this.tempMatrix.set(this.clone(fresh)); // buffer editable
    this.solutions.set([]);
    this.message.set(null);
  }

  // ===== Resolver (Gauss: forward elim + back substitution) =====
  solveSystem(): void {
    const A = this.clone(this.tempMatrix());
    const n = A.length;

    if (n === 0 || A[0].length !== n + 1) {
      this.message.set('La matriz no tiene el formato correcto (n × (n+1)).');
      return;
    }

    // Eliminación hacia adelante (triangular superior) con pivoteo parcial
    for (let i = 0; i < n; i++) {
      // buscar pivote
      let pivot = i;
      for (let r = i + 1; r < n; r++) {
        if (Math.abs(A[r][i]) > Math.abs(A[pivot][i])) pivot = r;
      }
      // si casi cero, no hay solución única
      if (Math.abs(A[pivot][i]) < this.EPS) {
        this.message.set('La matriz es singular o no hay solución única.');
        this.solutions.set([]);
        return;
      }
      // swap
      if (pivot !== i) {
        const tmp = A[i]; A[i] = A[pivot]; A[pivot] = tmp;
      }
      // eliminar abajo
      for (let r = i + 1; r < n; r++) {
        const factor = A[r][i] / A[i][i];
        if (Math.abs(factor) < this.EPS) continue;
        for (let c = i; c <= n; c++) A[r][c] -= factor * A[i][c];
      }
    }

    // Sustitución hacia atrás
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) sum += A[i][j] * x[j];
      x[i] = (A[i][n] - sum) / A[i][i];
    }

    // No tocamos los inputs (tempMatrix) para que no cambien en UI
    this.solutions.set(x);
    this.message.set('Sistema resuelto con éxito.');
  }
}
