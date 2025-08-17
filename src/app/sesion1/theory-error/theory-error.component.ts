import { NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgModel } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-theory-error',
  standalone: true,
  imports: [NgIf, FormsModule, RouterLink],
  templateUrl: './theory-error.component.html',
  styleUrls: ['./theory-error.component.css'],
})
export class TheoryErrorComponent {
  vv!: number; // valor verdadero
  va!: number; // valor aproximado
  cs!: number; // cifras significativas

  resultadoEt: string | null = null;
  resultadoEr: string | null = null;
  resultadoErp: string | null = null;
  mensaje: string | null = null;

  calcular() {
    // Validaciones
    if (isNaN(this.vv) || isNaN(this.va) || isNaN(this.cs) || this.cs <= 0) {
      this.mensaje =
        'Por favor, ingresa valores válidos y un número de cifras significativas mayor que 0.';
      return;
    }

    if (this.vv === 0) {
      this.mensaje =
        'El valor verdadero no puede ser cero para calcular el error relativo.';
      return;
    }

    if (!Number.isInteger(this.cs)) {
      this.mensaje = 'Las cifras significativas deben ser un número entero.';
      return;
    }

    if (!isFinite(this.va) || !isFinite(this.vv)) {
      this.mensaje = 'Los valores no pueden ser infinitos.';
      return;
    }

    // Cálculos
    const et = this.vv - this.va;
    const er = et / this.vv;
    const erp = er * 100;

    // Función para cifras significativas
    const sigFig = (num: number, sig: number) => num.toPrecision(sig);

    // Resultados
    this.resultadoEt = `Error total o absoluto: ${sigFig(et, this.cs)}`;
    this.resultadoEr = `Error relativo: ${sigFig(er, this.cs)}`;
    this.resultadoErp = `Error relativo porcentual: ${sigFig(erp, this.cs)} %`;

    this.mensaje = '';
  }
}
