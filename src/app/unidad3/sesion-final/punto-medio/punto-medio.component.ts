import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

declare const math: any;

type Resultado = {
  i: number;
  xi: number;
  yi: number;
  k1: number;
  k2: number;
  yNext: number;
};

@Component({
  selector: 'app-punto-medio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './punto-medio.component.html',
})
export class PuntoMedioComponent {
  // Parámetros de entrada
  ecuacion: string = 'x + y';
  x0: number = 0;
  y0: number = 1;
  h: number = 0.1;
  xFinal: number = 1;
  decimales: number = 6;

  // Resultados
  resultados: Resultado[] = [];
  mensajeError: string = '';
  mensajeResultado: string = '';

  // Paginación
  paginaActual: number = 1;
  itemsPorPagina: number = 10;

  get totalPaginas(): number {
    return Math.ceil(this.resultados.length / this.itemsPorPagina);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  get resultadosPaginados(): Resultado[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.resultados.slice(inicio, fin);
  }

  // Insertar símbolos en la ecuación
  insertar(simbolo: string): void {
    this.ecuacion += simbolo;
  }

  // Cargar ejemplo
  setEjemplo(ec: string): void {
    this.ecuacion = ec;
    this.mensajeError = '';
  }

  // Evaluar la función dy/dx = f(x, y)
  private evaluar(x: number, y: number): number {
    try {
      const scope = { x, y, e: Math.E, pi: Math.PI };
      return math.evaluate(this.ecuacion, scope);
    } catch (e) {
      throw new Error('Error al evaluar la ecuación');
    }
  }

  // Método de Runge-Kutta de segundo orden (Punto Medio)
  resolver(): void {
    this.mensajeError = '';
    this.mensajeResultado = '';
    this.resultados = [];

    // Validaciones
    if (!this.ecuacion || this.ecuacion.trim() === '') {
      this.mensajeError = 'Por favor ingresa una ecuación válida.';
      return;
    }

    if (this.h <= 0) {
      this.mensajeError = 'El tamaño del paso h debe ser positivo.';
      return;
    }

    if (this.xFinal <= this.x0) {
      this.mensajeError = 'xFinal debe ser mayor que x0.';
      return;
    }

    if (typeof math === 'undefined') {
      this.mensajeError =
        'Math.js no está disponible. Verifica que el script esté cargado.';
      return;
    }

    try {
      // Inicialización
      let x = this.x0;
      let y = this.y0;
      let i = 0;
      const maxIteraciones = 10000; // Límite de seguridad

      // Calcular número de pasos
      const numPasos = Math.ceil((this.xFinal - this.x0) / this.h);

      while (x < this.xFinal && i < maxIteraciones) {
        // k1 = f(xi, yi)
        const k1 = this.evaluar(x, y);

        // k2 = f(xi + h/2, yi + k1*h/2)
        const k2 = this.evaluar(x + this.h / 2, y + (k1 * this.h) / 2);

        // y_{i+1} = yi + k2 * h
        const yNext = y + k2 * this.h;

        this.resultados.push({
          i,
          xi: x,
          yi: y,
          k1,
          k2,
          yNext,
        });

        // Avanzar
        x += this.h;
        y = yNext;
        i++;

        // Ajustar último paso si nos pasamos
        if (x > this.xFinal) {
          x = this.xFinal;
        }
      }

      if (i >= maxIteraciones) {
        this.mensajeError = 'Se alcanzó el límite máximo de iteraciones.';
      } else {
        this.mensajeResultado = `✔ Solución calculada exitosamente. ${this.resultados.length} iteraciones.`;
        this.mensajeResultado += ` Aproximación final: y(${this.xFinal.toFixed(
          this.decimales
        )}) ≈ ${y.toFixed(this.decimales)}`;
      }

      this.paginaActual = 1;
    } catch (e: any) {
      this.mensajeError =
        'Error: ' + (e.message || 'No se pudo calcular la solución.');
      this.resultados = [];
    }
  }

  // Limpiar
  limpiar(): void {
    this.ecuacion = 'x + y';
    this.x0 = 0;
    this.y0 = 1;
    this.h = 0.1;
    this.xFinal = 1;
    this.resultados = [];
    this.mensajeError = '';
    this.mensajeResultado = '';
    this.paginaActual = 1;
  }

  // Cambiar página
  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  // TrackBy para optimizar *ngFor
  trackByIndex(index: number): number {
    return index;
  }

  // Cargar ejemplos predefinidos
  cargarEjemplo1(): void {
    this.ecuacion = 'x + y';
    this.x0 = 0;
    this.y0 = 1;
    this.h = 0.1;
    this.xFinal = 1;
    this.mensajeError = '';
    this.mensajeResultado = '⚙ Ejemplo 1 cargado: dy/dx = x + y, y(0) = 1';
  }

  cargarEjemplo2(): void {
    this.ecuacion = 'x^2 - y';
    this.x0 = 0;
    this.y0 = 1;
    this.h = 0.1;
    this.xFinal = 2;
    this.mensajeError = '';
    this.mensajeResultado = '⚙ Ejemplo 2 cargado: dy/dx = x² - y, y(0) = 1';
  }

  cargarEjemplo3(): void {
    this.ecuacion = '-2*x*y';
    this.x0 = 0;
    this.y0 = 1;
    this.h = 0.05;
    this.xFinal = 1;
    this.mensajeError = '';
    this.mensajeResultado = '⚙ Ejemplo 3 cargado: dy/dx = -2xy, y(0) = 1';
  }
}
