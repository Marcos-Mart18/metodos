import { NgFor, NgIf } from '@angular/common';
import { Component, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { CientificoPipe } from '../pipes/cientifico.pipes';
import { ViewChild } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    NgIf,
    FormsModule,
    NgFor,
    NgChartsModule,
    CientificoPipe,
  ],
  templateUrl: './falsa-posicion.component.html',
  styleUrls: ['./falsa-posicion.component.css'],
})
export class FalsaPosicionComponent {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  ecuacion: string = '';
  a: number | null = null;
  b: number | null = null;
  tol: number | null = null;
  maxIter: number = 1000;

  iteraciones: any[] = [];
  raiz: number | null = null;
  mensajeError: string | null = null;

  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'f(x)',
        borderColor: '#3BAFDA',
        fill: false,
        pointRadius: 0,
      },
      {
        data: [],
        label: 'Aproximaciones xr',
        borderColor: '#FF5733',
        pointRadius: 6,
        showLine: false,
      },
    ],
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { title: { display: true, text: 'x' } },
      y: { title: { display: true, text: 'f(x)' } },
    },
  };

  f(x: number): number {
    return Function('x', `return ${this.ecuacion};`)(x);
  }

  calcular() {
    this.mensajeError = null;
    this.iteraciones = [];
    this.raiz = null;

    if (
      !this.ecuacion ||
      this.a === null ||
      this.b === null ||
      this.tol === null
    ) {
      this.mensajeError = 'Por favor, completa todos los campos';
      return;
    }

    let a = this.a,
      b = this.b;
    let fa = this.f(a),
      fb = this.f(b);

    if (fa * fb >= 0) {
      this.mensajeError = 'El intervalo no contiene raíz';
      return;
    }

    let xr = a,
      error = 100,
      i = 0;

    while (i < this.maxIter && error > this.tol) {
      let xrold = xr;
      xr = (a * fb - b * fa) / (fb - fa);
      let fxr = this.f(xr);

      if (i > 0) error = Math.abs((xr - xrold) / xr) * 100;

      let signo: string;
      if (fa * fxr > 0) signo = '+';
      else if (fa * fxr < 0) signo = '-';
      else signo = '0';

      this.iteraciones.push({
        i: i + 1,
        a,
        b,
        fa,
        fb,
        xr,
        fxr,
        signo,
        error,
      });

      if (fxr === 0) {
        this.raiz = xr;
        break; // en vez de return
      } else if (fa * fxr < 0) {
        b = xr;
        fb = fxr;
      } else {
        a = xr;
        fa = fxr;
      }

      if (error <= this.tol) {
        this.raiz = xr;
        break; // en vez de return
      }

      i++;
    }

    if (i >= this.maxIter) {
      this.mensajeError =
        'Se alcanzó el máximo de 1000 iteraciones sin converger';
    }

    this.raiz = xr;
    this.actualizarGrafico();
  }

  actualizarGrafico() {
    if (!this.ecuacion) return;

    const f = new Function('x', 'return ' + this.ecuacion);

    // Intervalo de graficación
    let a = this.iteraciones[0]?.a ?? -10;
    let b = this.iteraciones[0]?.b ?? 10;

    // Generar puntos de la función
    const step = (b - a) / 200; // 200 puntos
    const labels: number[] = [];
    const values: number[] = [];

    for (let x = a; x <= b; x += step) {
      labels.push(x);
      values.push(f(x));
    }

    // Puntos de las iteraciones
    const iterX = this.iteraciones.map((it) => it.xr);
    const iterY = this.iteraciones.map((it) => f(it.xr));

    this.chartData = {
      labels,
      datasets: [
        {
          label: 'f(x)',
          data: values,
          borderColor: 'blue',
          fill: false,
          tension: 0.1, // curva suavizada
        },
        {
          label: 'Iteraciones',
          data: iterY,
          pointRadius: 6,
          pointBackgroundColor: 'red',
          showLine: false,
        },
      ],
    };

    this.chart?.update();
  }
}
