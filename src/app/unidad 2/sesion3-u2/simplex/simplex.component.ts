import { CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type Constraint = {
  coefficients: number[];
  rhs: number;
  type: '<=' | '=' | '>=';
};
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
  imports: [CommonModule, FormsModule, NgFor, NgIf, RouterLink],
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
    // Soportamos '<=', '>=', '='
    return false;
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  trackByIndex(index: number): number {
    return index;
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
    for (
      let i = 0;
      i < Math.min(oldConstraints.length, this.constraints.length);
      i++
    ) {
      for (
        let j = 0;
        j < Math.min(oldConstraints[i].coefficients.length, this.numVariables);
        j++
      ) {
        this.constraints[i].coefficients[j] =
          oldConstraints[i].coefficients[j] ?? 0;
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
    const parts = this.objectiveFunction
      .map((c, i) => `${this.coefStr(c)}x${i + 1}`)
      .filter(Boolean);
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
    if (!isFinite(v))
      return v === Infinity ? '∞' : v === -Infinity ? '-∞' : 'NaN';
    // Evita "-0"
    if (Math.abs(v) < this.EPS) v = 0;
    try {
      // toPrecision similar a calculadora científica
      return Number(v).toPrecision(Math.min(Math.max(this.precision, 2), 9));
    } catch {
      return String(v);
    }
  }

  // Construcción del tableau y solver que soporta <= y >= (Fase I para artificiales)
  createInitialTableau(): { tableau: number[][]; headers: string[] } {
    const m = this.numConstraints;
    const n = this.numVariables;

    // Encabezados dinámicos: x, s (slack), s (excedente), a (artificial), RHS
    // Contamos cuántas de cada tipo necesitamos
    const slackMap: number[] = [];
    const surplusMap: number[] = [];
    const artificialMap: number[] = [];
    let slackCount = 0,
      surplusCount = 0,
      artificialCount = 0;
    const normalized = this.constraints.map((c) => ({
      ...c,
      coefficients: [...c.coefficients],
    }));

    // Si RHS negativo, multiplicar por -1 (y cambiar tipo)
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i].rhs < 0) {
        for (let j = 0; j < normalized[i].coefficients.length; j++)
          normalized[i].coefficients[j] *= -1;
        normalized[i].rhs *= -1;
        normalized[i].type =
          normalized[i].type === '<='
            ? '>='
            : normalized[i].type === '>='
            ? '<='
            : '=';
      }
    }

    for (let i = 0; i < m; i++) {
      if (normalized[i].type === '<=') {
        slackMap[i] = slackCount++;
        surplusMap[i] = -1;
        artificialMap[i] = -1;
      } else if (normalized[i].type === '>=') {
        surplusMap[i] = surplusCount++;
        slackMap[i] = -1;
        artificialMap[i] = artificialCount++;
      } else {
        // '=' no soportado en esta versión
        slackMap[i] = -1;
        surplusMap[i] = -1;
        artificialMap[i] = artificialCount++;
      }
    }

    // Nombres de columnas: usamos 's' tanto para slack (≤) como para excedente (≥)
    // Las columnas de excedente seguirán la numeración después de los slacks: s{slackCount+1} ...
    const headers: string[] = [
      ...Array.from({ length: n }, (_, i) => `x${i + 1}`),
      ...Array.from({ length: slackCount }, (_, i) => `s${i + 1}`),
      ...Array.from(
        { length: surplusCount },
        (_, i) => `s${slackCount + i + 1}`
      ),
      ...Array.from({ length: artificialCount }, (_, i) => `a${i + 1}`),
      'RHS',
    ];

    const totalCols = n + slackCount + surplusCount + artificialCount + 1;
    const rows: number[][] = [];
    const artColStart = n + slackCount + surplusCount;

    for (let i = 0; i < m; i++) {
      const row = Array(totalCols).fill(0);
      for (let j = 0; j < n; j++) row[j] = normalized[i].coefficients[j] ?? 0;
      if (slackMap[i] >= 0) row[n + slackMap[i]] = 1;
      if (surplusMap[i] >= 0) row[n + slackCount + surplusMap[i]] = -1; // excedente aparece con -1
      if (artificialMap[i] >= 0) row[artColStart + artificialMap[i]] = 1;
      row[totalCols - 1] = normalized[i].rhs ?? 0;
      rows.push(row);
    }

    // Fila Z (fase II placeholder): -c_j en variables originales, 0 en slacks/surplus/art y RHS 0
    const zRow = Array(totalCols).fill(0);
    for (let j = 0; j < n; j++) zRow[j] = -(this.objectiveFunction[j] ?? 0);
    rows.push(zRow);

    return { tableau: rows, headers };
  }

  findPivotColumn(tableau: number[][], limitJ?: number): number {
    const z = tableau[tableau.length - 1];
    let minVal = 0;
    let pivotCol = -1;
    const end = limitJ ?? z.length - 1;
    for (let j = 0; j < end; j++) {
      if (z[j] < minVal - this.EPS) {
        minVal = z[j];
        pivotCol = j;
      }
    }
    return pivotCol;
  }

  findPivotRow(
    tableau: number[][],
    pivotCol: number
  ): { row: number; ratios: (number | null)[] } {
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
          else {
            isBasic = false;
            break;
          } // Más de un 1
        } else if (Math.abs(v) > 1e-7) {
          isBasic = false;
          break;
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
    // Versión que soporta <= y >= usando Fase I para artificiales
    this.solutionSteps = [];
    this.optimalSolution = null;

    if (this.objectiveFunction.length !== this.numVariables) {
      this.optimalSolution = {
        error: 'La función objetivo no coincide con el número de variables.',
      };
      return;
    }
    if (this.constraints.length !== this.numConstraints) {
      this.optimalSolution = {
        error: 'El número de restricciones no coincide.',
      };
      return;
    }
    if (this.hasUnsupportedTypes) {
      this.optimalSolution = {
        error: 'Por ahora no se soportan restricciones de tipo =.',
      };
      return;
    }

    // Construcción similar a la versión previa (mapas de slack/surplus/artificial)
    const normalized = this.constraints.map((c) => ({
      ...c,
      coefficients: [...c.coefficients],
    }));
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i].rhs < 0) {
        for (let j = 0; j < normalized[i].coefficients.length; j++)
          normalized[i].coefficients[j] *= -1;
        normalized[i].rhs *= -1;
        normalized[i].type =
          normalized[i].type === '<='
            ? '>='
            : normalized[i].type === '>='
            ? '<='
            : '=';
      }
    }

    const m = this.numConstraints;
    const n = this.numVariables;

    const slackMap: number[] = [];
    const surplusMap: number[] = [];
    const artificialMap: number[] = [];
    let slackCount = 0,
      surplusCount = 0,
      artificialCount = 0;
    for (let i = 0; i < m; i++) {
      if (normalized[i].type === '<=') {
        slackMap[i] = slackCount++;
        surplusMap[i] = -1;
        artificialMap[i] = -1;
      } else if (normalized[i].type === '>=') {
        surplusMap[i] = surplusCount++;
        slackMap[i] = -1;
        artificialMap[i] = artificialCount++;
      } else {
        slackMap[i] = -1;
        surplusMap[i] = -1;
        artificialMap[i] = artificialCount++;
      }
    }

    // Nombres de columnas: usamos 's' para slacks y excedentes (excedentes numerados después de los slacks)
    const headers: string[] = [
      ...Array.from({ length: n }, (_, i) => `x${i + 1}`),
      ...Array.from({ length: slackCount }, (_, i) => `s${i + 1}`),
      ...Array.from(
        { length: surplusCount },
        (_, i) => `s${slackCount + i + 1}`
      ),
      ...Array.from({ length: artificialCount }, (_, i) => `a${i + 1}`),
      'RHS',
    ];

    const totalCols = n + slackCount + surplusCount + artificialCount + 1;
    const rows: number[][] = [];
    const artColStart = n + slackCount + surplusCount;
    const artBasicRow: boolean[] = Array(m).fill(false);

    for (let i = 0; i < m; i++) {
      const row = Array(totalCols).fill(0);
      for (let j = 0; j < n; j++) row[j] = normalized[i].coefficients[j] ?? 0;
      if (slackMap[i] >= 0) row[n + slackMap[i]] = 1;
      if (surplusMap[i] >= 0) row[n + slackCount + surplusMap[i]] = -1;
      if (artificialMap[i] >= 0) {
        row[artColStart + artificialMap[i]] = 1;
        artBasicRow[i] = true;
      }
      row[totalCols - 1] = normalized[i].rhs ?? 0;
      rows.push(row);
    }

    // Fase I: minimizar suma de artificiales
    // Construcción estándar: c = [0 ... 0, 1 en columnas artificiales, 0 en RHS]
    // y para cada fila con artificial básica, restamos esa fila de Z para anular la artificial.
    const zRowPhase1 = Array(totalCols).fill(0);
    for (let k = 0; k < artificialCount; k++) zRowPhase1[artColStart + k] = 1;
    for (let i = 0; i < m; i++) {
      if (artBasicRow[i]) {
        for (let j = 0; j < totalCols; j++) zRowPhase1[j] -= rows[i][j];
      }
    }
    rows.push(zRowPhase1);

    let tableau = rows;
    let iteration = 0;

    // DEBUG: imprimir estado inicial para depuración
    try {
      // Muestra constraints normalizadas, headers y zRowPhase1
      console.log(
        'Simplex: normalized constraints =',
        JSON.parse(JSON.stringify(normalized))
      );
      console.log('Simplex: headers =', JSON.parse(JSON.stringify(headers)));
      console.log(
        'Simplex: initial tableau (Fase I) =',
        JSON.parse(JSON.stringify(tableau))
      );
      console.log(
        'Simplex: zRowPhase1 RHS =',
        tableau[tableau.length - 1][tableau[0].length - 1]
      );
    } catch (e) {
      console.log('Simplex: debug log error', e);
    }

    // Registrar tableau inicial (Fase I) para verificar Z antes de iterar
    this.solutionSteps.push({
      iteration,
      tableau: JSON.parse(JSON.stringify(tableau)),
      headers: [...headers],
      enteringCol: null,
      leavingRow: null,
      enteringVar: null,
      leavingVar: null,
      pivot: null,
      z: tableau[tableau.length - 1][tableau[0].length - 1],
      note: 'Tabla inicial (Fase I)',
    });

    // Fase I
    while (iteration < this.maxIterations) {
      const z = tableau[tableau.length - 1][tableau[0].length - 1];
      const pivotCol = this.findPivotColumn(tableau);
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
          note: 'Fin Fase I',
        });
        break;
      }

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
          note: 'Solución no acotada en Fase I.',
        });
        this.optimalSolution = { error: 'Solución no acotada en Fase I.' };
        return;
      }

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
        note: 'Pivoteo Fase I',
      });

      this.performPivot(tableau, pivotRow, pivotCol);
      iteration++;
    }

    const zPhase1 = tableau[tableau.length - 1][tableau[0].length - 1];
    if (Math.abs(zPhase1) > 1e-7) {
      this.optimalSolution = {
        error: 'Modelo inviable (Fase I no logró Z=0).',
      };
      return;
    }

    // Fase I completada: Eliminar columnas artificiales y reparar bases que
    // quedaron con una artificial básica (si x/a básica artificial con valor 0)
    const artIndices: number[] = [];
    for (let k = 0; k < artificialCount; k++) artIndices.push(artColStart + k);

    const isArtificial = (col: number) => artIndices.includes(col);
    const isNonArtificial = (col: number) => col < artColStart; // x and s columns

    // Intenta pivotear fuera la artificial básica de cada fila
    for (let i = 0; i < m; i++) {
      // Detecta columna básica de la fila i
      let basicCol: number | null = null;
      for (let j = 0; j < tableau[0].length - 1; j++) {
        if (Math.abs(tableau[i][j] - 1) < 1e-7) {
          let unit = true;
          for (let r = 0; r < m; r++) {
            if (r === i) continue;
            if (Math.abs(tableau[r][j]) > 1e-7) {
              unit = false;
              break;
            }
          }
          if (unit) {
            basicCol = j;
            break;
          }
        }
      }

      if (basicCol !== null && isArtificial(basicCol)) {
        // Busca una columna no artificial con coeficiente distinto de 0 para pivotear
        let pivotCol: number | null = null;
        for (let j = 0; j < artColStart; j++) {
          if (Math.abs(tableau[i][j]) > this.EPS) {
            pivotCol = j;
            break;
          }
        }
        if (pivotCol !== null) {
          this.performPivot(tableau, i, pivotCol);
        }
      }
    }

    // Elimina las columnas artificiales del tableau y de los headers
    artIndices.sort((a, b) => b - a); // eliminar de derecha a izquierda
    for (const col of artIndices) {
      for (let i = 0; i < tableau.length; i++) tableau[i].splice(col, 1);
      headers.splice(col, 1);
    }

    // Recalcula contadores tras eliminar artificiales
    const totalColsPhase2 = tableau[0].length; // ya sin artificiales

    // Preparar Fase II: construir fila Z a partir de la función objetivo (solo x_j)
    const zRowPhase2 = Array(totalColsPhase2).fill(0);
    for (let j = 0; j < n; j++) zRowPhase2[j] = -(this.objectiveFunction[j] ?? 0);
    tableau[tableau.length - 1] = zRowPhase2;

    // Ajusta fila Z con variables básicas actuales (si alguna x_j es básica)
    for (let i = 0; i < m; i++) {
      let basicCol: number | null = null;
      for (let j = 0; j < totalColsPhase2 - 1; j++) {
        if (Math.abs(tableau[i][j] - 1) < 1e-7) {
          let unit = true;
          for (let r = 0; r < m; r++) {
            if (r === i) continue;
            if (Math.abs(tableau[r][j]) > 1e-7) {
              unit = false;
              break;
            }
          }
          if (unit) {
            basicCol = j;
            break;
          }
        }
      }
      if (basicCol !== null && basicCol < n) {
        const c = this.objectiveFunction[basicCol] ?? 0;
        if (Math.abs(c) > this.EPS) {
          for (let j = 0; j < totalColsPhase2; j++)
            tableau[tableau.length - 1][j] += c * tableau[i][j];
        }
      }
    }

    // Registrar tableau al inicio de Fase II
    this.solutionSteps.push({
      iteration,
      tableau: JSON.parse(JSON.stringify(tableau)),
      headers: [...headers],
      enteringCol: null,
      leavingRow: null,
      enteringVar: null,
      leavingVar: null,
      pivot: null,
      z: tableau[tableau.length - 1][tableau[0].length - 1],
      note: 'Tabla inicial (Fase II)',
    });

    // Fase II
    while (iteration < this.maxIterations) {
      const z = tableau[tableau.length - 1][tableau[0].length - 1];
      // Ya no hay columnas artificiales en Phase II
      const pivotCol = this.findPivotColumn(tableau);
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
          note: 'Óptimo Fase II',
        });
        this.optimalSolution = this.extractSolution(tableau, headers);
        return;
      }

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
          note: 'Solución no acotada en Fase II.',
        });
        this.optimalSolution = { error: 'Solución no acotada.' };
        return;
      }

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
        note: 'Pivoteo Fase II',
      });

      this.performPivot(tableau, pivotRow, pivotCol);
      iteration++;
    }

    this.optimalSolution = {
      error: `Se alcanzó el máximo de ${this.maxIterations} iteraciones sin converger.`,
    };
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
