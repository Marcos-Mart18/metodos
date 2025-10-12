import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type StepKind =
  | 'validate'      // validación n×(n+1)
  | 'pivot'         // selección de pivote
  | 'swap'          // intercambio de filas
  | 'u-row'         // cálculo de la fila k de U
  | 'l-mult'        // cálculo de L[i,k]
  | 'schur'         // actualización A[i,*] -= L[i,k]*U[k,*]
  | 'permute-b'     // aplicar P a b
  | 'forward'       // Ly = Pb (fila i)
  | 'backward'      // Ux = y (fila i)
  | 'singular'      // matriz singular
  | 'done';         // finalizado

interface LuStep {
  kind: StepKind;
  title: string;
  detail?: string;
  /** Snapshots para UI (siempre clonar antes de guardar) */
  L: number[][];
  U: number[][];
  A: number[][];
  /** Destacados visuales */
  highlightRow?: number;
  highlightCol?: number;
  /** Píldora de operación (ej. R3 ← R3 − 1.25·U2) */
  operation?: string;
  /** Datos extra (factor, div, i/k, Pb, y_i, x_i, etc.) */
  meta?: Record<string, any>;
}

@Component({
  selector: 'app-factorizacion-lu',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './factorizacion-lu.component.html',
})
export class FactorizacionLuComponent {
  // Estado principal
  matrix = signal<number[][]>([]);
  tempMatrix = signal<number[][]>([]);
  solutions = signal<number[]>([]);
  message = signal<string | null>(null);

  // L, U y vector de permutación
  L = signal<number[][]>([]);
  U = signal<number[][]>([]);
  piv = signal<number[]>([]);

  // Pasos para la UI
  steps = signal<LuStep[]>([]);

  private readonly EPS = 1e-10;

  constructor() {
    this.adjustMatrixSize(3);
  }

  // ----------------- Utilidades -----------------
  
  // Convierte un arreglo cualquiera a "a, b, c"
joinNums(vec: unknown): string {
  if (!Array.isArray(vec)) return '';
  return (vec as any[]).join(', ');
}

// Formatea números con this.format(...) y los une "a, b, c"
joinFormatted(vec: unknown, decimals = 4): string {
  if (!Array.isArray(vec)) return '';
  return (vec as any[]).map(v => this.format(Number(v), decimals)).join(', ');
}

  private clone(A: number[][]): number[][] {
    return A.map(r => [...r]);
  }
  private zeros(n: number, m: number): number[][] {
    return Array.from({ length: n }, () => Array(m).fill(0));
  }
  format(x: number, d = 4): string {
    const v = Math.abs(x) < 1e-12 ? 0 : x;
    return v.toFixed(d);
  }
  private snap(L: number[][], U: number[][], A: number[][]) {
    return { L: this.clone(L), U: this.clone(U), A: this.clone(A) };
  }
  private pushStep(step: Omit<LuStep, 'L'|'U'|'A'> & { L: number[][]; U: number[][]; A: number[][]; }) {
    const { L, U, A } = this.snap(step.L, step.U, step.A);
    this.steps.update(arr => [...arr, { ...step, L, U, A }]);
  }

  // ----------------- Inputs -----------------
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

  // ----------------- Redimensionar -----------------
  adjustMatrixSize(n: number): void {
    if (!Number.isFinite(n) || n < 2 || n > 10) return;
    const fresh = this.zeros(n, n + 1);
    this.matrix.set(fresh);
    this.tempMatrix.set(this.clone(fresh));
    this.solutions.set([]);
    this.message.set(null);
    this.L.set([]);
    this.U.set([]);
    this.piv.set([]);
    this.steps.set([]);
  }

  // ----------------- LU con pivoteo parcial (Doolittle) + LOG -----------------
  /** Devuelve { ok, L, U, piv, Atrail } y va 'pusheando' pasos visuales */
  private luDecomposeLogged(Ain: number[][]) {
    const n = Ain.length;
    const A = this.clone(Ain);     // trabajamos sobre copia de A (solo n×n)
    const L = this.zeros(n, n);
    const U = this.zeros(n, n);
    const piv = Array.from({ length: n }, (_, i) => i);

    for (let k = 0; k < n; k++) {
      // Buscar pivote en col k (filas k..n-1)
      let p = k;
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
      }
      this.pushStep({
        kind: 'pivot',
        title: `Selección de pivote en columna ${k + 1}`,
        detail: `Se elige la fila ${p + 1} con mayor |A[i,${k + 1}]|.`,
        L, U, A,
        highlightRow: p, highlightCol: k
      });

      if (Math.abs(A[p][k]) < this.EPS) {
        this.pushStep({
          kind: 'singular',
          title: 'Pivote ≈ 0 → matriz singular',
          detail: 'No es posible continuar la factorización.',
          L, U, A,
          highlightRow: p, highlightCol: k
        });
        return { ok: false as const, L: [] as number[][], U: [] as number[][], piv: [] as number[], Atrail: [] as number[][] };
      }

      // Intercambiar filas k ↔ p en A y piv; y en L (hasta col k-1)
      if (p !== k) {
        [A[k], A[p]] = [A[p], A[k]];
        [piv[k], piv[p]] = [piv[p], piv[k]];
        for (let j = 0; j < k; j++) {
          [L[k][j], L[p][j]] = [L[p][j], L[k][j]];
        }
        this.pushStep({
          kind: 'swap',
          title: `Intercambio de filas: R${k + 1} ↔ R${p + 1}`,
          detail: `Se posiciona el pivote en (${k + 1}, ${k + 1}).`,
          L, U, A,
          highlightRow: k, highlightCol: k,
          operation: `R${k + 1} ↔ R${p + 1}`
        });
      }

      // Diagonal unitaria de L
      L[k][k] = 1;

      // Fila k de U (desde k..n-1)
      for (let j = k; j < n; j++) U[k][j] = A[k][j];
      this.pushStep({
        kind: 'u-row',
        title: `Construcción de U: fila ${k + 1}`,
        detail: `U[${k + 1}, j] = A[${k + 1}, j] para j = ${k + 1}..${n}.`,
        L, U, A,
        highlightRow: k, highlightCol: k
      });

      // Multiplicadores L[i,k] y actualización de Schur debajo de k
      for (let i = k + 1; i < n; i++) {
        L[i][k] = A[i][k] / U[k][k];
        this.pushStep({
          kind: 'l-mult',
          title: `Multiplicador L[${i + 1}, ${k + 1}]`,
          detail: `L[${i + 1}, ${k + 1}] = A[${i + 1}, ${k + 1}] / U[${k + 1}, ${k + 1}]`,
          L, U, A,
          highlightRow: i, highlightCol: k,
          operation: `L[${i + 1},${k + 1}] = ${this.format(L[i][k], 6)}`,
          meta: { L_ik: L[i][k] }
        });

        for (let j = k; j < n; j++) {
          A[i][j] -= L[i][k] * U[k][j];
        }
        this.pushStep({
          kind: 'schur',
          title: `Actualización de Schur (fila ${i + 1})`,
          detail: `A[i,*] ← A[i,*] − L[i,${k + 1}]·U[${k + 1},*]`,
          L, U, A,
          highlightRow: i, highlightCol: k,
          operation: `R${i + 1} ← R${i + 1} − (${this.format(L[i][k], 4)})·U${k + 1}`
        });
      }
    }

    return { ok: true as const, L, U, piv, Atrail: A };
  }

  // Sustitución hacia adelante: L y = Pb (L diagonal unitaria)
  private forwardSubstLogged(L: number[][], Pb: number[]): number[] {
    const n = L.length;
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = Pb[i];
      for (let j = 0; j < i; j++) s -= L[i][j] * y[j];
      y[i] = s; // L[i,i]=1
      this.pushStep({
        kind: 'forward',
        title: `Sustitución hacia adelante (y${i + 1})`,
        detail: `y${i + 1} = b'${i + 1} − Σ L[${i + 1},j]·y_j, j=1..${i}`,
        L, U: this.U(), A: this.L().length ? this.clone(this.L()) : this.zeros(n, n), // A no aplica aquí; mostramos snapshot neutral
        highlightRow: i,
        operation: `y${i + 1} = ${this.format(y[i], 6)}`,
        meta: { yi: y[i] }
      });
    }
    return y;
  }

  // Sustitución hacia atrás: U x = y
  private backSubstLogged(U: number[][], y: number[]): number[] {
    const n = U.length;
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j < n; j++) s -= U[i][j] * x[j];
      x[i] = s / U[i][i];
      this.pushStep({
        kind: 'backward',
        title: `Sustitución hacia atrás (x${i + 1})`,
        detail: `x${i + 1} = (y${i + 1} − Σ U[${i + 1},j]·x_j)/U[${i + 1},${i + 1}]`,
        L: this.L(), U, A: this.U().length ? this.clone(this.U()) : this.zeros(n, n),
        highlightRow: i, highlightCol: i,
        operation: `x${i + 1} = ${this.format(x[i], 6)}`,
        meta: { xi: x[i] }
      });
    }
    return x;
  }

  // ----------------- Resolver -----------------
  solveSystem(): void {
    this.steps.set([]);
    this.solutions.set([]);
    this.message.set(null);

    const n = this.tempMatrix().length;
    if (n === 0 || this.tempMatrix()[0].length !== n + 1) {
      this.message.set('La matriz no tiene el formato correcto (n × (n+1)).');
      return;
    }

    // Separar A (n×n) y b (n)
    const Acoeff = this.zeros(n, n);
    const b = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) Acoeff[i][j] = this.tempMatrix()[i][j];
      b[i] = this.tempMatrix()[i][n];
    }

    // Paso 0: Validación
    this.pushStep({
      kind: 'validate',
      title: 'Validación de dimensiones',
      detail: 'Se confirma matriz aumentada n × (n+1).',
      L: this.zeros(n, n), U: this.zeros(n, n), A: this.clone(Acoeff)
    });

    // LU con pivoteo parcial (con logging)
    const { ok, L, U, piv } = this.luDecomposeLogged(Acoeff);
    if (!ok) {
      this.L.set([]); this.U.set([]); this.piv.set([]);
      this.message.set('La matriz es singular o no tiene solución única.');
      this.solutions.set([]);
      return;
    }

    // Guardar L,U,P
    this.L.set(L);
    this.U.set(U);
    this.piv.set(piv);

    // Aplicar P a b → Pb
    const Pb = piv.map(idx => b[idx]);
    this.pushStep({
      kind: 'permute-b',
      title: 'Aplicación de la permutación a b',
      detail: `Se reordena b según P (pivoteo parcial).`,
      L, U, A: this.clone(Acoeff),
      operation: `Pb = [ ${Pb.map(v => this.format(v, 4)).join(', ')} ]`,
      meta: { P: piv, Pb }
    });

    // Resolver Ly = Pb
    const y = this.forwardSubstLogged(L, Pb);

    // Resolver Ux = y
    const x = this.backSubstLogged(U, y);

    // Actualizar vistas finales
    this.solutions.set(x);
    this.message.set('Sistema resuelto con éxito.');
    this.pushStep({
      kind: 'done',
      title: 'Factorización y solución completas',
      detail: 'Se obtuvo PA = LU, y la solución por Ly = Pb y Ux = y.',
      L, U, A: this.clone(Acoeff)
    });
  }
}
