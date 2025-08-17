import { NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-punto-flotante',
  standalone: true,
  imports: [FormsModule, NgIf, RouterLink],
  templateUrl: './punto-flotante.component.html',
  styleUrls: ['./punto-flotante.component.css'],
})
export class PuntoFlotanteComponent {
  base!: number; // B
  mantisa!: number; // t
  menorPot!: number; // m
  mayorPot!: number; // M

  // resultados
  formalizacion: string | null = null;
  elementos: number | null = null;
  maxNum: number | null = null;
  minNum: number | null = null;
  rango: string | null = null;

  // pruebas
  numeroPrueba!: number;
  metodo: 'truncamiento' | 'redondeo' = 'truncamiento';
  resultadoPrueba: string | null = null;

  // errores y avisos
  mensajeError: string | null = null;
  mensajeInfo: string | null = null;

  mensajeError2: string | null = null;

  calcularSistema() {
    this.mensajeError = null;
    this.mensajeInfo = null;
    if (
      !this.base ||
      !this.mantisa ||
      this.menorPot == null ||
      this.mayorPot == null
    ) {
      this.mensajeError = 'Completa todos los datos.';
      this.mensajeInfo = null;
      return;
    }

    if (this.base < 2) {
      this.mensajeError = 'La base debe ser mayor o igual a 2.';
      this.mensajeInfo = null;
      return;
    }

    if (this.mantisa <= 0 || !Number.isInteger(this.mantisa)) {
      this.mensajeError = 'La mantisa debe ser un entero positivo.';
      this.mensajeInfo = null;
      return;
    }

    if (this.menorPot >= this.mayorPot) {
      this.mensajeError =
        'La menor potencia debe ser menor que la mayor potencia.';
      this.mensajeInfo = null;
      return;
    }

    // si no existen errores empezamos a calcular
    this.formalizacion = `F(${this.base}, ${this.mantisa}, ${this.menorPot}, ${this.mayorPot})`;

    // Fórmula cantidad de elementos
    this.elementos =
      2 *
        (this.base - 1) *
        (this.mayorPot - this.menorPot + 1) *
        Math.pow(this.base, this.mantisa - 1) +
      1;

    // Número más grande
    this.maxNum =
      (Math.pow(this.base, this.mantisa - 1) /
        Math.pow(this.base, this.mantisa)) *
      Math.pow(this.base, this.mayorPot);

    // Número más pequeño
    this.minNum = Math.pow(this.base, this.menorPot - 1);

    this.rango = `[${this.minNum} , ${this.maxNum}]`;
    this.mensajeInfo = 'Sistema calculado correctamente.';
  }

  probarNumero() {
    this.mensajeError2 = null;
    if (
      this.numeroPrueba == null ||
      this.base == null ||
      this.mantisa == null
    ) {
      this.mensajeError2 =
        'Ingresa los datos del sistema y el número a probar.';
      return;
    }

    if (!this.minNum || !this.maxNum) {
      this.mensajeError2 = 'Primero calcula el sistema.';
      return;
    }

    const n = this.numeroPrueba;

    if (n > this.maxNum) {
      this.resultadoPrueba = `Overflow 🚨 → ${n} > ${this.maxNum}`;
      return;
    }
    if (n < this.minNum) {
      this.resultadoPrueba = `Underflow ⚠ → ${n} < ${this.minNum}`;
      return;
    }

    // Número dentro del rango → aplicar truncamiento/redondeo
    let resultado: string;

    const numStr = n.toString();
    const [entero, decimal] = numStr.split('.');

    if (!decimal || this.mantisa <= 0) {
      this.resultadoPrueba = `${n} está dentro del rango.`;
      return;
    }

    // Mantener solo "t" cifras en la parte decimal
    const decLimit = decimal.slice(0, this.mantisa);

    if (this.metodo === 'truncamiento') {
      resultado = `${entero}.${decLimit}`;
    } else {
      // redondeo
      const nextDigit = parseInt(decimal[this.mantisa] || '0', 10);
      let truncado = parseInt(decLimit, 10);

      if (nextDigit >= 5) {
        truncado += 1;
      }

      // asegurar que no crezca en longitud
      resultado = `${entero}.${truncado
        .toString()
        .padStart(this.mantisa, '0')}`;
    }
    this.mensajeError2 = null;
    this.resultadoPrueba = `${n} está dentro del rango → Representado como ${resultado} (${this.metodo})`;
  }
}
