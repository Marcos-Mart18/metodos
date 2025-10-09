import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { create, all } from 'mathjs';
const math = create(all);

@Component({
  selector: 'app-newtonn',
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './newtonn.component.html',
  styleUrl: './newtonn.component.css',
})
export class NewtonnComponent implements OnInit {
  ecuacion: string = '';
  x0: number | null = null;
  errorMax: number = 0;
  maxIter: number = 0;
  resultados: any[] = [];
  resultadosPaginados: any[] = [];
  paginaActual: number = 1;
  itemsPorPagina: number = 10;
  totalPaginas: number = 1;
  mensaje: string | null = null;

  ngOnInit(): void {}

  insertar(simbolo: string) {
    this.ecuacion = (this.ecuacion || '') + simbolo;
  }

  resolver() {
    this.resultados = []; // Limpiamos los resultados antes de iniciar el cálculo
    this.paginaActual = 1; // Reiniciamos la paginación

    if (!this.ecuacion) {
      alert('Por favor, ingresa una ecuación válida.');
      return;
    }
    if (this.x0 === null) {
      alert('Debes ingresar un valor inicial X₀.');
      return;
    }

    // Asegúrate de que la ecuación se evalúe correctamente
    const expr = this.ecuacion;
    const f = (x: number) => math.evaluate(expr, { x });
    const df = math.derivative(expr, 'x').toString(); // Calcula la primera derivada
    const d2f = math.derivative(df, 'x').toString(); // Calcula la segunda derivada

    let xk = this.x0!;
    let error: number = Infinity;

    for (let i = 0; i < this.maxIter; i++) {
      const fxk = f(xk);
      const dfxk = math.evaluate(df, { x: xk });
      const d2fxk = math.evaluate(d2f, { x: xk });

      // Si la segunda derivada es cero, no podemos continuar
      if (d2fxk === 0) {
        this.mensaje =
          'La segunda derivada se anuló en X₀, no se puede continuar.';
        return;
      }

      const xk1 = xk - dfxk / d2fxk;

      // Calcular el error relativo
      error = Math.abs((xk1 - xk) / xk1) * 100;

      // Añadir el resultado de la iteración al array
      this.resultados.push({
        iteracion: i + 1,
        xk: xk.toFixed(9),
        dfxk: dfxk.toFixed(9),
        d2fxk: d2fxk.toFixed(9),
        xk1: xk1.toFixed(9),
        error: error.toFixed(9),
      });

      // Si el error es menor que el error máximo, terminamos
      if (error <= this.errorMax) {
        if (d2fxk > 0) {
          this.mensaje =
            'F tiene un mínimo relativo en (' +
            xk1.toFixed(9) +
            ', ' +
            f(xk1).toFixed(9) +
            ')';
        } else if (d2fxk < 0) {
          this.mensaje =
            'F tiene un máximo relativo en (' +
            xk1.toFixed(9) +
            ', ' +
            f(xk1).toFixed(9) +
            ')';
        } else if (d2fxk === 0) {
          this.mensaje =
            'El punto crítico en (' +
            xk1.toFixed(9) +
            ', ' +
            f(xk1).toFixed(9) +
            ') es un punto silla.';
        }
        break;
      }

      xk = xk1; // Actualizamos xk para la siguiente iteración
    }

    // Verificamos que los resultados están siendo guardados
    this.actualizarPaginacion();
  }

  actualizarPaginacion() {
    this.totalPaginas = Math.ceil(this.resultados.length / this.itemsPorPagina);
    this.resultadosPaginados = this.resultados.slice(
      (this.paginaActual - 1) * this.itemsPorPagina,
      this.paginaActual * this.itemsPorPagina
    );
  }

  cambiarPagina(pagina: number) {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
    this.actualizarPaginacion();
  }
}
