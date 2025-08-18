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
  base!: number; // B → La base del sistema (ej: 2 para binario, 10 para decimal)
  mantisa!: number; // t → El número de dígitos significativos de la mantisa
  menorPot!: number; // m → El exponente más pequeño permitido
  mayorPot!: number; // M → El exponente más grande permitido

  // resultados que calcula el sistema
  formalizacion: string | null = null; // la notación formal F(B, t, m, M)
  elementos: number | null = null; // cantidad total de números que el sistema puede representar
  maxNum: number | null = null; // el número más grande que puede representar el sistema
  minNum: number | null = null; // el número más pequeño (positivo) que puede representar el sistema
  rango: string | null = null; // el intervalo [mínimo, máximo]

  // pruebas con un número
  numeroPrueba!: number; // número que el usuario quiere probar si cabe en el sistema
  metodo: 'truncamiento' | 'redondeo' = 'truncamiento'; // cómo aproximar la mantisa
  resultadoPrueba: string | null = null; // resultado de la prueba

  // mensajes de error e información
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
      return;
    }

    if (this.base < 2) {
      this.mensajeError = 'La base debe ser mayor o igual a 2.';
      return;
    }

    if (this.mantisa <= 0 || !Number.isInteger(this.mantisa)) {
      this.mensajeError = 'La mantisa debe ser un entero positivo.';
      return;
    }

    if (this.menorPot >= this.mayorPot) {
      this.mensajeError =
        'La menor potencia debe ser menor que la mayor potencia.';
      return;
    }

    // --- Formalización ---
    this.formalizacion = `F(${this.base}, ${this.mantisa}, ${this.menorPot}, ${this.mayorPot})`;

    // --- Cantidad de elementos ---
    this.elementos =
      2 *
        (this.base - 1) *
        (this.mayorPot - this.menorPot + 1) *
        Math.pow(this.base, this.mantisa - 1) +
      1;

    // --- Número máximo representable ---
    // ( (B^t - 1) / B^t ) * B^M
    let max =
      ((Math.pow(this.base, this.mantisa) - 1) /
        Math.pow(this.base, this.mantisa)) *
      Math.pow(this.base, this.mayorPot);

    // Redondear el máximo según la cantidad de dígitos significativos
    let maxStr = max.toPrecision(this.mantisa);
    this.maxNum = Number(maxStr);

    // --- Número mínimo representable ---
    // B^(m-1)
    let min = Math.pow(this.base, this.menorPot - 1);

    // Redondear el mínimo también
    let minStr = min.toPrecision(this.mantisa);
    this.minNum = Number(minStr);

    // --- Rango ---
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
    const signo = n < 0 ? '-' : '';

    // --- Overflow ---
    if (n > this.maxNum) {
      this.resultadoPrueba =
        `Overflow 🚨 → ${n} > ${this.maxNum}\n` +
        `Representado como ∞ (sistema ${this.formalizacion})`;
      return;
    }
    if (n < -this.maxNum) {
      this.resultadoPrueba =
        `Overflow 🚨 → ${n} < -${this.maxNum}\n` +
        `Representado como -∞ (sistema ${this.formalizacion})`;
      return;
    }

    // --- Underflow ---
    if (Math.abs(n) < this.minNum && n !== 0) {
      this.resultadoPrueba =
        `Underflow ⚠ → |${n}| < ${this.minNum}\n` +
        `Representado como 0 (sistema ${this.formalizacion})`;
      return;
    }

    // --- Número dentro del rango ---
    const base = this.base;
    const t = this.mantisa;

    // Convertimos a valor absoluto
    let exp = 0;
    let valor = Math.abs(n);

    // Normalizamos con respecto a la base
    while (valor >= base) {
      valor /= base;
      exp++;
    }
    while (valor < 1 && valor !== 0) {
      valor *= base;
      exp--;
    }

    // --- Construcción de la mantisa en cualquier base ---
    let digits: string[] = [];
    let frac = valor;
    for (let i = 0; i < t; i++) {
      const d = Math.floor(frac);
      digits.push(d.toString(base).toUpperCase());
      frac = (frac - d) * base;
    }

    // Truncamiento o redondeo
    if (this.metodo === 'truncamiento') {
      // Mantener t dígitos
    } else {
      // Redondeo: mirar el siguiente dígito
      const nextDigit = Math.floor(frac);
      if (nextDigit >= base / 2) {
        // Propagamos acarreo
        for (let i = digits.length - 1; i >= 0; i--) {
          let d = parseInt(digits[i], base) + 1;
          if (d === base) {
            digits[i] = '0';
            if (i === 0) {
              // Overflow en la mantisa → ajustamos exponente
              digits.unshift('1');
              digits = digits.slice(0, t);
              exp++;
            }
          } else {
            digits[i] = d.toString(base).toUpperCase();
            break;
          }
        }
      }
    }

    const mantisaFinal = `${digits[0]}.${digits.slice(1).join('')}`;

    this.resultadoPrueba =
      `${n} está dentro del rango →\n` +
      `Representado como ${signo}${mantisaFinal} × ${base}^${exp} ` +
      `(criterio ${this.metodo}, sistema ${this.formalizacion})`;
  }
}
