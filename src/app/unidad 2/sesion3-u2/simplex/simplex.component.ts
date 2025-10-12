import { CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type Constraint = { coefficients: number[]; rhs: number; type: '<=' | '=' | '>=' };
type Step = {
  iteration: number;
  tableau: number[][];
  headers: string[];
  enteringCol: number | null;
  leavingRow: number | null;
  enteringVar: string | null;
  leavingVar: string | null;
  pivot: number | null;
  ratios?: (number | null)[];
  z: number;
  note?: string;
};

@Component({
  selector: 'app-simplex',
  standalone: true,
  templateUrl: './simplex.component.html',
  imports: [CommonModule, FormsModule, NgFor, NgIf, RouterLink]
})
export class SimplexComponent implements OnInit {
  // Estado
  numVariables = 2;
  numConstraints = 2;
  objectiveFunction: number[] = [];
  constraints: Constraint[] = [];
  solutionSteps: Step[] = [];
  optimalSolution: any = null;

  // Formato/precisión
  precision = 9; // estilo calculadora científica (toPrecision)
  EPS = 1e-9;
  maxIterations = 100;

  get hasUnsupportedTypes(): boolean {
    return this.constraints.some(c => c.type !== '<=');
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  ngOnInit(): void {
    this.initializeConstraints();
  }

  reset() {
    this.initializeConstraints();
    this.solutionSteps = [];
    this.optimalSolution = null;
  }

  initializeConstraints() {
    this.constraints = Array.from({ length: this.numConstraints }, () => ({
      coefficients: Array(this.numVariables).fill(0),
      rhs: 0,
      type: '<=',
    }));
    this.objectiveFunction = Array(this.numVariables).fill(0);
  }

  updateDimensions() {
    // Normaliza dimensiones conservando lo ingresado cuando sea posible
    const oldConstraints = this.constraints;
    const oldObj = this.objectiveFunction;

    this.initializeConstraints();

    // Copia segura
    for (let i = 0; i < Math.min(oldConstraints.length, this.constraints.length); i++) {
      for (let j = 0; j < Math.min(oldConstraints[i].coefficients.length, this.numVariables); j++) {
        this.constraints[i].coefficients[j] = oldConstraints[i].coefficients[j] ?? 0;
      }
      this.constraints[i].rhs = oldConstraints[i].rhs ?? 0;
      this.constraints[i].type = (oldConstraints[i].type ?? '<=') as any;
    }
    for (let j = 0; j < Math.min(oldObj.length, this.numVariables); j++) {
      this.objectiveFunction[j] = oldObj[j] ?? 0;
    }

    this.solutionSteps = [];
    this.optimalSolution = null;
  }

  // Pretty printers
  prettyObjective(): string {
    const parts = this.objectiveFunction.map((c, i) => `${this.coefStr(c)}x${i + 1}`).filter(Boolean);
    return parts.join(' + ').replace(/\+\s-\s/g, '- ');
  }

  prettyConstraint(i: number): string {
    const c = this.constraints[i];
    const left = c.coefficients
      .map((v, j) => `${this.coefStr(v)}x${j + 1}`)
      .filter(Boolean)
      .join(' + ')
      .replace(/\+\s-\s/g, '- ');
    return `${left} ${c.type} ${this.fmt(c.rhs)}`;
  }

  coefStr(c: number): string {
    if (Math.abs(c) < this.EPS) return '0';
    const s = this.fmt(Math.abs(c));
    return c < 0 ? `- ${s} ` : `${s} `;
    // El + se agrega por el join, luego corregimos con replace
  }

  // Formato numérico
  fmt(v: number): string {
    if (!isFinite(v)) return v === Infinity ? '∞' : v === -Infinity ? '-∞' : 'NaN';
    // Evita "-0"
    if (Math.abs(v) < this.EPS) v = 0;
    try {
      // toPrecision similar a calculadora científica
      return Number(v).toPrecision(Math.min(Math.max(this.precision, 2), 9));
    } catch {
      return String(v);
    }
  }

  // Construcción del tableau (solo ≤)
  createInitialTableau(): { tableau: number[][]; headers: string[] } {
    const m = this.numConstraints;
    const n = this.numVariables;

    // Validación de tipos
    if (this.hasUnsupportedTypes) {
      throw new Error('Por ahora solo se soportan restricciones de tipo ≤.');
    }

    // Encabezados: x1..xn, s1..sm, RHS
    const headers: string[] = [
      ...Array.from({ length: n }, (_, i) => `x${i + 1}`),
      ...Array.from({ length: m }, (_, i) => `s${i + 1}`),
      'RHS',
    ];

    const rows: number[][] = [];

    // Filas de restricciones: [a_ij ... | I_m | b_i]
    for (let i = 0; i < m; i++) {
      const row = Array(n + m + 1).fill(0);
      for (let j = 0; j < n; j++) row[j] = this.constraints[i].coefficients[j] ?? 0;
      row[n + i] = 1;            // slack
      row[n + m] = this.constraints[i].rhs ?? 0; // RHS
      rows.push(row);
    }

    // Fila Z: [-c_j ... | 0 | 0]
    const zRow = Array(n + m + 1).fill(0);
    for (let j = 0; j < n; j++) zRow[j] = -(this.objectiveFunction[j] ?? 0);
    // slacks y RHS en 0
    rows.push(zRow);

    return { tableau: rows, headers };
  }

  findPivotColumn(tableau: number[][]): number {
    const z = tableau[tableau.length - 1];
    let minVal = 0;
    let pivotCol = -1;
    for (let j = 0; j < z.length - 1; j++) {
      if (z[j] < minVal - this.EPS) {
        minVal = z[j];
        pivotCol = j;
      }
    }
    return pivotCol;
  }

  findPivotRow(tableau: number[][], pivotCol: number): { row: number; ratios: (number | null)[] } {
    const ratios: (number | null)[] = [];
    let minRatio = Infinity;
    let pivotRow = -1;

    for (let i = 0; i < tableau.length - 1; i++) {
      const a = tableau[i][pivotCol];
      const rhs = tableau[i][tableau[i].length - 1];
      if (a > this.EPS) {
        const r = rhs / a;
        ratios.push(r);
        if (r < minRatio - this.EPS) {
          minRatio = r;
          pivotRow = i;
        }
      } else {
        ratios.push(null);
      }
    }

    return { row: pivotRow, ratios };
  }

  performPivot(tableau: number[][], pr: number, pc: number) {
    const pivot = tableau[pr][pc];
    // Normaliza fila pivote
    for (let j = 0; j < tableau[pr].length; j++) tableau[pr][j] /= pivot;

    // Anula demás filas
    for (let i = 0; i < tableau.length; i++) {
      if (i === pr) continue;
      const factor = tableau[i][pc];
      if (Math.abs(factor) < this.EPS) continue;
      for (let j = 0; j < tableau[i].length; j++) {
        tableau[i][j] -= factor * tableau[pr][j];
      }
    }
  }

  // Detección de variable básica en una fila (col con 1 y resto ~0)
  basicVarName(headers: string[], row: number[], upto: number): string | null {
    for (let j = 0; j < upto; j++) {
      if (Math.abs(row[j] - 1) < 1e-7) {
        // Verifica columna identidad aproximada
        let isUnit = true;
        for (let i = 0; i < this.numConstraints; i++) {
          if (i === headers.indexOf(headers[j])) continue;
        }
      }
    }
    return null;
  }

  extractSolution(tableau: number[][], headers: string[]) {
    const m = this.numConstraints;
    const n = this.numVariables;
    const sol: any = { variables: {}, optimalValue: 0 };

    // Inicializa en 0
    for (let i = 0; i < n; i++) sol.variables[`x${i + 1}`] = 0;

    // Para cada variable x_j busca una fila básica
    for (let j = 0; j < n; j++) {
      let rowIndex: number | null = null;
      let isBasic = true;
      for (let i = 0; i < m; i++) {
        const v = tableau[i][j];
        if (Math.abs(v - 1) < 1e-7) {
          if (rowIndex === null) rowIndex = i;
          else { isBasic = false; break; } // Más de un 1
        } else if (Math.abs(v) > 1e-7) {
          isBasic = false; break;
        }
      }
      if (isBasic && rowIndex !== null) {
        sol.variables[`x${j + 1}`] = tableau[rowIndex][tableau[0].length - 1];
      }
    }

    sol.optimalValue = tableau[tableau.length - 1][tableau[0].length - 1];
    return sol;
  }

  solveSimplex(): void {
    this.solutionSteps = [];
    this.optimalSolution = null;
  
    // Validaciones
    if (this.objectiveFunction.length !== this.numVariables) {
      this.optimalSolution = { error: 'La función objetivo no coincide con el número de variables.' };
      return;
    }
    if (this.constraints.length !== this.numConstraints) {
      this.optimalSolution = { error: 'El número de restricciones no coincide.' };
      return;
    }
    if (this.hasUnsupportedTypes) {
      this.optimalSolution = { error: 'Por ahora solo se soportan restricciones de tipo ≤.' };
      return;
    }
  
    let { tableau, headers } = this.createInitialTableau();
    let iteration = 0;
  
    while (iteration < this.maxIterations) {
      const z = tableau[tableau.length - 1][tableau[0].length - 1];
      const pivotCol = this.findPivotColumn(tableau);
  
      // Óptimo alcanzado
      if (pivotCol === -1) {
        this.solutionSteps.push({
          iteration,
          tableau: JSON.parse(JSON.stringify(tableau)),
          headers: [...headers],
          enteringCol: null,
          leavingRow: null,
          enteringVar: null,
          leavingVar: null,
          pivot: null,
          z,
          note: 'No hay coeficientes negativos en la fila Z.',
        });
        this.optimalSolution = this.extractSolution(tableau, headers);
        return;
      }
  
      // Busca fila pivote
      const { row: pivotRow, ratios } = this.findPivotRow(tableau, pivotCol);
      if (pivotRow === -1) {
        this.solutionSteps.push({
          iteration,
          tableau: JSON.parse(JSON.stringify(tableau)),
          headers: [...headers],
          enteringCol: pivotCol,
          leavingRow: null,
          enteringVar: headers[pivotCol],
          leavingVar: null,
          pivot: null,
          ratios,
          z,
          note: 'Solución no acotada (ninguna razón positiva).',
        });
        this.optimalSolution = { error: 'Solución no acotada.' };
        return;
      }
  
      // Registrar y pivoteo
      const enteringVar = headers[pivotCol];
      const leavingVar = `R${pivotRow + 1}`;
      const pivot = tableau[pivotRow][pivotCol];
  
      this.solutionSteps.push({
        iteration,
        tableau: JSON.parse(JSON.stringify(tableau)),
        headers: [...headers],
        enteringCol: pivotCol,
        leavingRow: pivotRow,
        enteringVar,
        leavingVar,
        pivot,
        ratios,
        z,
        note: 'Selecciona columna con coeficiente más negativo y aplica razón mínima.',
      });
  
      this.performPivot(tableau, pivotRow, pivotCol);
      iteration++;
    }
  
    // Si sale por límite de iteraciones
    this.optimalSolution = { error: `Se alcanzó el máximo de ${this.maxIterations} iteraciones sin converger.` };
    return;
  }
  

  // Utilidades de UI
  loadExample() {
    this.numVariables = 2;
    this.numConstraints = 3;
    this.updateDimensions();

    // Max Z = 3x1 + 5x2
    this.objectiveFunction = [3, 5];

    // Sujeto a:
    // 1) 2x1 + 3x2 ≤ 8
    // 2) 2x1 +   x2 ≤ 4
    // 3)   x1 + 2x2 ≤ 5
    this.constraints = [
      { coefficients: [2, 3], rhs: 8, type: '<=' },
      { coefficients: [2, 1], rhs: 4, type: '<=' },
      { coefficients: [1, 2], rhs: 5, type: '<=' },
    ];
    this.solutionSteps = [];
    this.optimalSolution = null;
  }
}
