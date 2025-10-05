import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-gauss-jordan',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './gauss-jordan.component.html',
})
export class GaussJordanComponent {
  // Matriz aumentada (n x (n+1))
  matrix = signal<number[][]>([]);
  // Matriz temporal (para inputs)
  tempMatrix = signal<number[][]>([]);
  // Soluciones (si existen y son únicas)
  solutions = signal<number[]>([]);
  // Mensaje de estado
  message = signal<string | null>(null);
  private readonly EPS = 1e-10;

  constructor() {
    const matrix = JSON.parse(JSON.stringify(this.tempMatrix())); // Usamos tempMatrix
    const n = matrix.length;
    this.adjustMatrixSize(3);
  }

  adjustMatrixSize(size: number): void {
    if (size < 2 || size > 10) return;
    const newM: number[][] = [];
    for (let i = 0; i < size; i++) {
      const row = new Array(size + 1).fill(0);
      newM.push(row);
    }
    this.matrix.set(newM);
    this.tempMatrix.set(this.clone(newM)); // Inicializa la matriz temporal
    this.solutions.set([]);
    this.message.set(null);
  }

  // Método para clonar una matriz
  private clone(a: number[][]): number[][] {
    return a.map((r) => [...r]);
  }

  // Validación de inputs
  onInputChange(value: string, row: number, col: number): void {
    const normalized = value.replace(/[^0-9.-]/g, '');
    if (!isNaN(Number(normalized)) || normalized === '') {
      // Copiar la matriz temporal antes de modificarla
      const updated = [...this.tempMatrix()]; // Acceder a la señal con tempMatrix()
      updated[row][col] = normalized === '' ? 0 : Number(normalized); // Actualizamos el valor de la celda
      this.tempMatrix.set(updated); // Actualizamos la matriz temporal con el nuevo valor
      this.message.set(null); // Limpia cualquier mensaje de error
    } else {
      this.message.set('⚠ Solo se permiten números (enteros o decimales).');
    }
  }

  // Método Gauss–Jordan (RREF)
  solveSystem(): void {
    const A = this.clone(this.tempMatrix());
    const n = A.length;

    if (n === 0 || A[0].length !== n + 1) {
      this.message.set('La matriz no tiene el formato n×(n+1).');
      return;
    }

    let row = 0; // fila actual del pivote
    for (let col = 0; col < n && row < n; col++) {
      let pivot = row;
      for (let r = row + 1; r < n; r++) {
        if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
      }

      if (Math.abs(A[pivot][col]) < this.EPS) continue;

      if (pivot !== row) {
        const tmp = A[row];
        A[row] = A[pivot];
        A[pivot] = tmp;
      }

      const div = A[row][col];
      for (let k = col; k <= n; k++) A[row][k] /= div;

      for (let r = 0; r < n; r++) {
        if (r === row) continue;
        const factor = A[r][col];
        if (Math.abs(factor) < this.EPS) continue;
        for (let k = col; k <= n; k++) {
          A[r][k] -= factor * A[row][k];
        }
      }

      row++;
    }

    for (let i = 0; i < n; i++) {
      let allZero = true;
      for (let j = 0; j < n; j++) {
        if (Math.abs(A[i][j]) > this.EPS) {
          allZero = false;
          break;
        }
      }
      if (allZero && Math.abs(A[i][n]) > this.EPS) {
        this.solutions.set([]);
        this.message.set('El sistema es inconsistente: no tiene solución.');
        return;
      }
    }

    let rank = 0;
    for (let i = 0; i < n; i++) {
      let hasCoeff = false;
      for (let j = 0; j < n; j++) {
        if (Math.abs(A[i][j]) > this.EPS) {
          hasCoeff = true;
          break;
        }
      }
      if (hasCoeff) rank++;
    }

    if (rank < n) {
      this.matrix.set(A);
      this.solutions.set([]);
      this.message.set('Infinitas soluciones (existen variables libres).');
      return;
    }

    const sol = new Array(n).fill(0);
    for (let i = 0; i < n; i++) sol[i] = A[i][n];

    this.matrix.set(A);
    this.solutions.set(sol);
    this.message.set('Sistema resuelto con éxito.');
  }
}
