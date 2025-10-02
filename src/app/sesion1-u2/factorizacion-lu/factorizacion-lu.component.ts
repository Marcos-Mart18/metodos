import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-factorizacion-lu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './factorizacion-lu.component.html',
})
export class FactorizacionLuComponent {
  // Señales principales
  matrix = signal<number[][]>([]);
  tempMatrix = signal<number[][]>([]);
  solutions = signal<number[]>([]);
  message = signal<string | null>(null);

  // Para mostrar L y U
  L = signal<number[][]>([]);
  U = signal<number[][]>([]);
  // pivots como vector de permutación (índices de filas tras P)
  piv = signal<number[]>([]);

  private readonly EPS = 1e-10;

  constructor() {
    this.adjustMatrixSize(3); // tamaño por defecto cómodo
  }

  // ------------- Utilidades -------------
  private clone(A: number[][]): number[][] {
    return A.map(r => [...r]);
  }

  private zeros(n: number, m: number): number[][] {
    return Array.from({ length: n }, () => Array(m).fill(0));
  }

  // Normaliza entrada de texto -> número
  onInputChange(value: string, i: number, j: number): void {
    const normalized = (value ?? '').toString().replace(/[^0-9.+\-eE]/g, '').replace(',', '.');
    const num = normalized === '' ? 0 : Number(normalized);
    if (!Number.isNaN(num)) {
      const T = this.clone(this.tempMatrix());
      T[i][j] = num;
      this.tempMatrix.set(T);
      this.message.set(null);
    } else {
      this.message.set('⚠ Solo números válidos (enteros/decimales).');
    }
  }

  // Redimensionar a n × (n+1)
  adjustMatrixSize(n: number): void {
    if (!Number.isFinite(n) || n < 2 || n > 10) return;
    const fresh = this.zeros(n, n + 1);
    this.matrix.set(fresh);
    this.tempMatrix.set(this.clone(fresh));
    this.solutions.set([]);
    this.message.set(null);
    this.L.set([]); this.U.set([]); this.piv.set([]);
  }

  // ------------- LU con pivoteo parcial (Doolittle) -------------
  private luDecompose(Ain: number[][]) {
    const n = Ain.length;
    const A = this.clone(Ain);
    const L = this.zeros(n, n);
    const U = this.zeros(n, n);
    const piv = Array.from({ length: n }, (_, i) => i); // P implícita

    for (let k = 0; k < n; k++) {
      // Buscar pivote en col k
      let p = k;
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
      }
      if (Math.abs(A[p][k]) < this.EPS) {
        return { ok: false as const, L: [], U: [], piv: [] as number[] };
      }

      // Intercambiar filas en A y en L (hasta columna k-1)
      if (p !== k) {
        [A[k], A[p]] = [A[p], A[k]];
        [piv[k], piv[p]] = [piv[p], piv[k]];
        for (let j = 0; j < k; j++) {
          [L[k][j], L[p][j]] = [L[p][j], L[k][j]];
        }
      }

      // Diagonal unitaria de L
      L[k][k] = 1;

      // Rellenar U fila k desde k..n-1
      for (let j = k; j < n; j++) U[k][j] = A[k][j];

      // Rellenar L col k debajo de la diagonal y actualizar A (Schur)
      for (let i = k + 1; i < n; i++) {
        L[i][k] = A[i][k] / U[k][k];
        for (let j = k; j < n; j++) {
          A[i][j] -= L[i][k] * U[k][j];
        }
      }
    }

    return { ok: true as const, L, U, piv };
  }

  // Sustitución hacia adelante: L y = Pb
  private forwardSubst(L: number[][], Pb: number[]): number[] {
    const n = L.length;
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = Pb[i];
      for (let j = 0; j < i; j++) s -= L[i][j] * y[j];
      // L tiene diagonal unitaria
      y[i] = s; 
    }
    return y;
  }

  // Sustitución hacia atrás: U x = y
  private backSubst(U: number[][], y: number[]): number[] {
    const n = U.length;
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j < n; j++) s -= U[i][j] * x[j];
      x[i] = s / U[i][i];
    }
    return x;
  }

  // ------------- Resolver -------------
  solveSystem(): void {
    const n = this.tempMatrix().length;
    if (n === 0 || this.tempMatrix()[0].length !== n + 1) {
      this.message.set('La matriz no tiene el formato correcto (n × (n+1)).');
      return;
    }

    // Separar A y b
    const A = this.zeros(n, n);
    const b = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] = this.tempMatrix()[i][j];
      b[i] = this.tempMatrix()[i][n];
    }

    // LU con pivoteo parcial
    const { ok, L, U, piv } = this.luDecompose(A);
    if (!ok) {
      this.solutions.set([]);
      this.message.set('La matriz es singular o no tiene solución única.');
      this.L.set([]); this.U.set([]); this.piv.set([]);
      return;
    }

    // Pb: reordenar b según pivoteo
    const Pb = piv.map(idx => b[idx]);

    // Resolver Ly = Pb y luego Ux = y
    const y = this.forwardSubst(L, Pb);
    const x = this.backSubst(U, y);

    // Actualizar vistas
    this.solutions.set(x);
    this.L.set(L);
    this.U.set(U);
    this.piv.set(piv);
    this.message.set('Sistema resuelto con éxito.');
  }
}
