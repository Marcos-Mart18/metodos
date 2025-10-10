import { CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-simplex',
  templateUrl: './simplex.component.html',
  imports: [CommonModule, FormsModule, NgFor,NgIf,RouterLink],
  styleUrls: ['./simplex.component.css'],
})
export class SimplexComponent implements OnInit {
  // Input fields
  numVariables: number = 2; // Number of decision variables
  numConstraints: number = 2; // Number of constraints
  objectiveFunction: number[] = []; // Coefficients of the objective function
  constraints: { coefficients: number[]; rhs: number; type: string }[] = []; // Constraints
  solutionSteps: any[] = []; // Steps of the simplex method
  optimalSolution: any = null; // Final optimal solution

  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  constructor() {}

  ngOnInit(): void {
    this.initializeConstraints();
  }

  // Initialize constraints with default values
  initializeConstraints() {
    this.constraints = Array.from({ length: this.numConstraints }, () => ({
      coefficients: Array(this.numVariables).fill(0),
      rhs: 0,
      type: '<=',
    }));
    this.objectiveFunction = Array(this.numVariables).fill(0);
  }

  // Update the number of variables and constraints
  updateDimensions() {
    this.initializeConstraints();
    this.solutionSteps = [];
    this.optimalSolution = null;
  }

  // Solve the problem using the Simplex method
  solveSimplex() {
    const tableau = this.createInitialTableau();
    this.solutionSteps = [];
    let iteration = 0;

    while (true) {
      this.solutionSteps.push({
        iteration,
        tableau: JSON.parse(JSON.stringify(tableau)),
      });

      const pivotColumn = this.findPivotColumn(tableau);
      if (pivotColumn === -1) {
        // Optimal solution found
        this.optimalSolution = this.extractSolution(tableau);
        break;
      }

      const pivotRow = this.findPivotRow(tableau, pivotColumn);
      if (pivotRow === -1) {
        // Unbounded solution
        this.optimalSolution = { error: 'Unbounded solution' };
        break;
      }

      this.performPivotOperation(tableau, pivotRow, pivotColumn);
      iteration++;
    }
  }

  // Create the initial tableau for the simplex method
  createInitialTableau() {
    const tableau = [];

    // Add constraints to the tableau
    for (const constraint of this.constraints) {
      const row = [...constraint.coefficients];
      row.push(...Array(this.numConstraints).fill(0)); // Slack variables
      row.push(constraint.rhs); // RHS value
      tableau.push(row);
    }

    // Add slack variables
    for (let i = 0; i < this.numConstraints; i++) {
      tableau[i][this.numVariables + i] = 1;
    }

    // Add the objective function row
    const objectiveRow = [...this.objectiveFunction.map((c) => -c)];
    objectiveRow.push(...Array(this.numConstraints).fill(0)); // Slack variables
    objectiveRow.push(0); // RHS value
    tableau.push(objectiveRow);

    return tableau;
  }

  // Find the pivot column (most negative value in the objective row)
  findPivotColumn(tableau: number[][]): number {
    const objectiveRow = tableau[tableau.length - 1];
    let minValue = 0;
    let pivotColumn = -1;

    for (let i = 0; i < objectiveRow.length - 1; i++) {
      if (objectiveRow[i] < minValue) {
        minValue = objectiveRow[i];
        pivotColumn = i;
      }
    }

    return pivotColumn;
  }

  // Find the pivot row (smallest positive ratio of RHS to pivot column value)
  findPivotRow(tableau: number[][], pivotColumn: number): number {
    let minRatio = Infinity;
    let pivotRow = -1;

    for (let i = 0; i < tableau.length - 1; i++) {
      const row = tableau[i];
      const pivotValue = row[pivotColumn];
      if (pivotValue > 0) {
        const ratio = row[row.length - 1] / pivotValue;
        if (ratio < minRatio) {
          minRatio = ratio;
          pivotRow = i;
        }
      }
    }

    return pivotRow;
  }

  // Perform the pivot operation
  performPivotOperation(tableau: number[][], pivotRow: number, pivotColumn: number) {
    const pivotValue = tableau[pivotRow][pivotColumn];

    // Normalize the pivot row
    for (let i = 0; i < tableau[pivotRow].length; i++) {
      tableau[pivotRow][i] /= pivotValue;
    }

    // Update other rows
    for (let i = 0; i < tableau.length; i++) {
      if (i !== pivotRow) {
        const factor = tableau[i][pivotColumn];
        for (let j = 0; j < tableau[i].length; j++) {
          tableau[i][j] -= factor * tableau[pivotRow][j];
        }
      }
    }
  }

  // Extract the solution from the final tableau
  extractSolution(tableau: number[][]) {
    const solution: any = { variables: {}, optimalValue: 0 };

    for (let i = 0; i < this.numVariables; i++) {
      solution.variables[`x${i + 1}`] = 0;
    }

    for (let i = 0; i < this.numConstraints; i++) {
      const basicVariableIndex = tableau[i].findIndex((value, index) => value === 1 && index < this.numVariables);
      if (basicVariableIndex !== -1) {
        solution.variables[`x${basicVariableIndex + 1}`] = tableau[i][tableau[i].length - 1];
      }
    }

    solution.optimalValue = tableau[tableau.length - 1][tableau[0].length - 1];
    return solution;
  }
}