import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { create, all } from 'mathjs';

const math = create(all);

declare var GGBApplet: any;
declare var ggbApplet: any;

@Component({
  selector: 'app-secante',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './secante.component.html'
})
export class SecanteComponent implements OnInit {
  ecuacion: string = '';
  x0: number | null = null;
  x1: number | null = null;
  errorMax: number = 0;
  maxIter: number = 0;

  resultados: Array<{ iteracion: number; xk: string; xk1: string; error: string }> = [];

  paginaActual: number = 1;
  resultadosPaginados: any[] = [];
  itemsPorPagina: number = 10;
  totalPaginas: number = 1;

  mensaje: string | null = null;
  ggbApp: any;

  ngOnInit(): void {
    this.ggbApp = new GGBApplet(
      {
        appName: 'graphing',
        width: 700,
        height: 500,
        showToolBar: false,
        showAlgebraInput: true,
        showMenuBar: false,
      },
      true
    );
    this.ggbApp.inject('ggb-element');
  }

  insertar(simbolo: string) {
    this.ecuacion = (this.ecuacion || '') + simbolo;
  }

  private normalizarEcuacionMath(): string {
    if (!this.ecuacion) return '';
    // En math.js, log() es log natural; convertimos ln() -> log()
    let eq = this.ecuacion.replace(/ln\(([^()]*)\)/g, 'log($1)');
    if (eq.includes('=')) {
      const [lhs, rhs] = eq.split('=');
      return `(${lhs.trim()}) - (${rhs.trim()})`;
    }
    return eq;
  }

  private normalizarEcuacionGeoGebra(): string {
    if (!this.ecuacion) return '';
    // En GeoGebra, mantenemos ln()
    let eq = this.ecuacion.replace(/ln\(([^()]*)\)/g, 'ln($1)');
    if (eq.includes('=')) {
      const [lhs, rhs] = eq.split('=');
      return `(${lhs.trim()}) - (${rhs.trim()})`;
    }
    return eq;
  }

  resolver() {
    this.resultados = [];
    this.paginaActual = 1;
  
    const expr = this.normalizarEcuacionMath();
    if (!expr) {
      this.mensaje = 'Por favor, ingresa una ecuación válida.';
      return;
    }
    if (this.x0 === null || this.x1 === null) {
      this.mensaje = 'Debes ingresar X₀ y X₁.';
      return;
    }
    if (this.x0 === this.x1) {
      this.mensaje = 'X₀ y X₁ no deben ser iguales.';
      return;
    }
    if (this.maxIter <= 0) {
      this.mensaje = 'El número máximo de iteraciones debe ser mayor que 0.';
      return;
    }
    if (this.errorMax <= 0) {
      this.mensaje = 'El error máximo debe ser mayor que 0.';
      return;
    }
  
    const f = (x: number) => math.evaluate(expr, { x });
  
    // Graficar la función en GeoGebra
    if (typeof ggbApplet !== 'undefined') {
      ggbApplet.reset();
      ggbApplet.evalCommand(`f(x)=${this.normalizarEcuacionGeoGebra()}`);
    }
  
    let xPrev = this.x0;
    let xCurr = this.x1;
  
    const fx0 = f(xPrev);
    if (!isFinite(fx0)) {
      this.mensaje = 'La función no está definida en X₀.';
      return;
    }
  
    this.resultados.push({
      iteracion: 0,
      xk: Number(xPrev).toFixed(9),
      xk1: '—',
      error: 'Infinity'
    });
  
    // Iteraciones k >= 1
    for (let k = 1; k <= this.maxIter; k++) {
      const fxPrev = f(xPrev);
      const fxCurr = f(xCurr);
  
      if (!isFinite(fxPrev) || !isFinite(fxCurr)) {
        this.mensaje = 'La función no está definida en algún punto evaluado.';
        this.resultados.push({
          iteracion: k,
          xk: Number(xCurr).toFixed(9),
          xk1: '—',
          error: 'Infinity'
        });
        break;
      }
  
      // Error relativo porcentual
      let error: number;
      if (isFinite(xCurr) && xCurr !== 0) {
        error = Math.abs((xCurr - xPrev) / xCurr) * 100; //xCurr = xk actual, XPrev = Xk anterior
      } else {
        error = Math.abs(xCurr - xPrev) * 100;
      }
  
      const denom = fxCurr - fxPrev;

      if (!isFinite(denom) || Math.abs(denom) < Number.EPSILON) {
        this.mensaje = 'f(Xk) - f(Xk-1) ≈ 0. No se puede continuar (división por cero).';
        this.resultados.push({
          iteracion: k,
          xk: Number(xCurr).toFixed(9),
          xk1: '—',
          error: 'Infinity'
        });
        break;
      }
      
      //Formula para hallar Xk+1
      const xNext = xCurr - (fxCurr * (xCurr - xPrev)) / denom;
  
      this.resultados.push({
        iteracion: k,
        xk: Number(xCurr).toFixed(9),
        xk1: isFinite(xNext) ? Number(xNext).toFixed(9) : '—', 
        error: isFinite(error) ? error.toFixed(9) : 'Infinity'
      });
  
      if (!isFinite(xNext)) {
        this.mensaje = 'Se obtuvo un valor no finito para Xₖ₊₁. Iteración detenida.';
        break;
      }
      
      // Criterio de paro por error
      if (error <= this.errorMax) {
        this.mensaje = null;
        xPrev = xCurr;
        xCurr = xNext;
        break;
      }
  
      xPrev = xCurr;
      xCurr = xNext;
    }
  
    this.actualizarPaginacion();
    if (!this.mensaje) this.mensaje = null;
  }
  
  

  actualizarPaginacion() {
    this.totalPaginas = Math.ceil(this.resultados.length / this.itemsPorPagina) || 1;
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
