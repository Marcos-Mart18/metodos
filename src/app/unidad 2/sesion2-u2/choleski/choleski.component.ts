import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-choleski',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './choleski.component.html',
})
export class CholeskiComponent {
  // Estado principal (Signals)
  matrix = signal<number[][]>([]);
  tempMatrix = signal<number[][]>([]);
  solutions = signal<number[]>([]);
  message = signal<string | null>(null);

  // Para mostrar L y U = Lᵀ
  L = signal<number[][]>([]);
  U = signal<number[][]>([]);

  // Diagnóstico
  symOk = signal<boolean | null>(null);
  spdOk = signal<boolean | null>(null);

  // Estilos de mensajes (igual que en Jacobi/GS)
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
  private transpose(A: number[][]): number[][] {
    const n = A.length,
      m = A[0].length;
    const T = this.zeros(m, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T[j][i] = A[i][j];
    return T;
  }

  // Normaliza entrada de texto -> número
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
    this.L.set([]);
    this.U.set([]);
    this.symOk.set(null);
    this.spdOk.set(null);
    this.message.set(null);
  }

  // ---------- Chequeos ----------
  private isSymmetric(A: number[][], tol = 1e-10): boolean {
    const n = A.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j] - A[j][i]) > tol) return false;
      }
    }
    return true;
  }

  // ---------- Cholesky ----------
  /** Devuelve L tal que A = L·Lᵀ si A es SPD. */
  private cholesky(Ain: number[][]) {
    const n = Ain.length;
    const L = this.zeros(n, n);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let s = 0;
        for (let k = 0; k < j; k++) s += L[i][k] * L[j][k];

        if (i === j) {
          const diag = Ain[i][i] - s;
          if (diag <= this.EPS)
            return { ok: false as const, L: [] as number[][] };
          L[i][i] = Math.sqrt(diag);
        } else {
          // ✅ CORRECTO: dividir por L[j][j]
          L[i][j] = (Ain[i][j] - s) / L[j][j];
        }
      }
    }
    return { ok: true as const, L };
  }

  // ---------- Sustituciones ----------
  // Ly = b (L triangular inferior)
  private forwardSubst(L: number[][], b: number[]): number[] {
    const n = L.length;
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = b[i];
      for (let j = 0; j < i; j++) s -= L[i][j] * y[j];
      y[i] = s / L[i][i];
    }
    return y;
  }

  // (Lᵀ)x = y
  private backSubstLt(L: number[][], y: number[]): number[] {
    const n = L.length;
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j < n; j++) s -= L[j][i] * x[j]; // Lᵀ[i][j] = L[j][i]
      x[i] = s / L[i][i];
    }
    return x;
  }

  // ---------- Resolver ----------
  solveSystem(): void {
    const n = this.tempMatrix().length;
    if (n === 0 || this.tempMatrix()[0].length !== n + 1) {
      this.message.set('✖ Formato inválido: se espera n × (n+1).');
      return;
    }

    // Separar A y b
    const A = this.zeros(n, n);
    const b = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] = this.tempMatrix()[i][j];
      b[i] = this.tempMatrix()[i][n];
    }

    // 1) Simetría
    const symmetric = this.isSymmetric(A, 1e-9);
    this.symOk.set(symmetric);
    if (!symmetric) {
      this.solutions.set([]);
      this.L.set([]);
      this.U.set([]);
      this.spdOk.set(null);
      this.message.set(
        '✖ A no es simétrica (A ≠ Aᵀ). Ajusta tus coeficientes.'
      );
      return;
    }

    // 2) Cholesky (=> A definida positiva)
    const { ok, L } = this.cholesky(A);
    this.spdOk.set(ok);
    if (!ok) {
      this.solutions.set([]);
      this.L.set([]);
      this.U.set([]);
      this.message.set('✖ A no es definida positiva (Cholesky falló).');
      return;
    }

    // 3) Resolver: L y = b, (Lᵀ) x = y
    const y = this.forwardSubst(L, b);
    const x = this.backSubstLt(L, y);

    // 4) Mostrar
    this.solutions.set(x);
    this.L.set(L);
    this.U.set(this.transpose(L));
    this.message.set('✔ Sistema resuelto con éxito por Cholesky.');
  }

  // Ejemplo rápido (SPD)
  fillExample(): void {
    // SPD clásico
    const A = [
      [4, 1, 1, 0, 6],
      [1, 3, 0, 1, 5],
      [1, 0, 2, -1, 1],
      [0, 1, -1, 2, 1],
    ];
    this.tempMatrix.set(A.map((r) => [...r]));
    this.matrix.set(this.zeros(4, 5));
    this.solutions.set([]);
    this.L.set([]);
    this.U.set([]);
    this.symOk.set(null);
    this.spdOk.set(null);
    this.message.set('⚙ Ejemplo cargado. Presiona “Resolver Sistema”.');
  }
}
