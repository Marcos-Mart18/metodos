import { CommonModule, NgFor } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { create, all } from 'mathjs';

const math = create(all);

// Declaración global para TypeScript para que reconozca el objeto ggbApplet en window
declare global {
  interface Window {
    ggbApplet: any;
  }
}

@Component({ selector: 'app-gradiente', standalone: true, 
imports: [FormsModule, NgFor, CommonModule,RouterLink], 
templateUrl: './gradiente.component.html', })
export class GradienteComponent implements OnInit {
  ecuacion: string = '';
  errorMax: number = 0.01;
  maximizar: boolean = false;
  Xa: number = 1;
  Ya: number = 1;
  resultados: any[] = [];
  mensajeResultado: string = '';

  paginaActual: number = 1;
  itemsPorPagina: number = 15;
  totalPaginas: number = 1;
  resultadosPaginados: any[] = [];

  ngOnInit(): void {
    this.initGeoGebra3D();
  }

  resolver() {
    this.resultados = [];
    this.mensajeResultado = '';
    let iteracion = 0;

    const gradienteX = (x: number, y: number) => {
      const dfx = math.derivative(this.ecuacion, 'x');
      return dfx.evaluate({ x, y });
    };
    const gradienteY = (x: number, y: number) => {
      const dfy = math.derivative(this.ecuacion, 'y');
      return dfy.evaluate({ x, y });
    };

    let Xa = this.Xa;
    let Ya = this.Ya;
    let error: number = 100;
    let XkAnt: number | null = null;

    while (error > this.errorMax) {
      let Sx = gradienteX(Xa, Ya);
      let Sy = gradienteY(Xa, Ya);

      if (this.maximizar) {
        Sx = -Sx;
        Sy = -Sy;
      }

      let alpha = this.calcularAlpha(Xa, Ya, Sx, Sy);
      const Xk = Xa + alpha * Sx;
      const Yk = Ya + alpha * Sy;

      let errorCalc = 0;
      if (XkAnt !== null) {
        errorCalc = Math.abs((Xk - XkAnt) / Xk);
      } else {
        errorCalc = 100;
      }

      this.resultados.push({
        iteracion: iteracion,
        X: Xa.toFixed(4),
        Y: Ya.toFixed(4),
        vectorS: `(${Sx.toFixed(4)}, ${Sy.toFixed(4)})`,
        alpha: alpha.toFixed(4),
        Xk: `${Xk.toFixed(4)}, ${Yk.toFixed(4)}`,
        error: errorCalc.toFixed(4),
      });

      Xa = Xk;
      Ya = Yk;
      XkAnt = Xk;
      error = errorCalc;
      iteracion++;
    }

    const punto = `(${Xa.toFixed(4)}, ${Ya.toFixed(4)})`;
    this.mensajeResultado = this.maximizar
      ? `El punto máximo encontrado es en: ${punto}`
      : `El punto mínimo encontrado es en: ${punto}`;

    this.actualizarPaginacion();
    this.actualizarGraficoGeoGebra(); // Actualiza el gráfico después de calcular
  }

  calcularAlpha(Xa: number, Ya: number, Sx: number, Sy: number): number {
    const alphaInicial = 1;
    const beta = 0.5;
    const sigma = 1e-4;

    let alpha = alphaInicial;
    const gradienteX = (x: number, y: number) => {
      const dfx = math.derivative(this.ecuacion, 'x');
      return dfx.evaluate({ x, y });
    };
    const gradienteY = (x: number, y: number) => {
      const dfy = math.derivative(this.ecuacion, 'y');
      return dfy.evaluate({ x, y });
    };

    let fX = math.evaluate(this.ecuacion, { x: Xa, y: Ya });
    let fXAlpha = math.evaluate(this.ecuacion, { x: Xa + alpha * Sx, y: Ya + alpha * Sy });

    while (fXAlpha > fX + sigma * alpha * (Sx * gradienteX(Xa, Ya) + Sy * gradienteY(Xa, Ya))) {
      alpha *= beta;
      fXAlpha = math.evaluate(this.ecuacion, { x: Xa + alpha * Sx, y: Ya + alpha * Sy });
    }

    return alpha;
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

  insertar(simbolo: string) {
    this.ecuacion = (this.ecuacion || '') + simbolo;
  }

  initGeoGebra3D() {
    const container = document.getElementById('geogebra-graph') as HTMLElement;

    const ggbApp = new (window as any).GGBApplet({
      appName: "3d",
      width: 800,
      height: 600,
      showToolBar: false,
      showAlgebraInput: false,
      showMenuBar: false,
    }, true);

    window.addEventListener("load", function () {
      ggbApp.inject('geogebra-graph');
    });
  }

  actualizarGraficoGeoGebra() {
    const ecuacion = this.ecuacion;
    const ggbApp = window.ggbApplet;

    if (ecuacion) {
      const ecuacion3D = ecuacion.replace("x", "X").replace("y", "Y");
      ggbApp.evalCommand(`f(X, Y) = ${ecuacion3D}`);
      ggbApp.evalCommand("SetVisibleInView(f, 1, true)");
    }
  }
}