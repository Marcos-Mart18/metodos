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

  resultados: Array<{
    iteracion: number;
    xkPrev: string;     // Agregado para Xₖ₋₁
    xk: string;         // Agregado para Xₖ
    fxPrev: string;     // Agregado para f(Xₖ₋₁)
    fxCurr: string;     // Agregado para f(Xₖ)
    xk1: string;        // Agregado para Xₖ₊₁
    fxNext: string;     // Agregado para f(Xₖ₊₁)
    error: string;      // Agregado para el error
  }> = [];
  
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
        showAlgebraInput: false,
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
  
    let xPrev = this.x0;  // Xₖ₋₁ será igual a X₀
    let xCurr = this.x1;  // Xₖ será igual a X₁ (para la primera iteración)
  
    let fxPrev = f(xPrev);
    let fxCurr = f(xCurr);
  
    if (!isFinite(fxPrev) || !isFinite(fxCurr)) {
      this.mensaje = 'La función no está definida en X₀ o X₁.';
      return;
    }
  
    // Iteraciones k >= 1
    for (let k = 1; k <= this.maxIter; k++) {
      const denom = fxCurr - fxPrev;
  
      if (!isFinite(fxPrev) || !isFinite(fxCurr)) {
        this.mensaje = 'La función no está definida en algún punto evaluado.';
        this.resultados.push({
          iteracion: k,
          xkPrev: Number(xPrev).toFixed(9),
          xk: '—',
          fxPrev: fxPrev.toFixed(9),
          fxCurr: fxCurr.toFixed(9),
          xk1: '—',
          fxNext: '—',
          error: 'Infinity'
        });
        break;
      }
  
      const xNext = xCurr - (fxCurr * (xCurr - xPrev)) / denom;
      const fxNext = f(xNext);
  
      let error: number;
      if (xCurr !== 0) {
        error = Math.abs((xCurr - xPrev) / xCurr) * 100;
      } else {
        error = Math.abs(xCurr - xPrev) * 100;
      }
  
      this.resultados.push({
        iteracion: k,
        xkPrev: Number(xPrev).toFixed(9),
        xk: Number(xCurr).toFixed(9),
        fxPrev: fxPrev.toFixed(9),
        fxCurr: fxCurr.toFixed(9),
        xk1: isFinite(xNext) ? Number(xNext).toFixed(9) : '—',
        fxNext: isFinite(fxNext) ? fxNext.toFixed(9) : '—',
        error: isFinite(error) ? error.toFixed(9) : 'Infinity'
      });
  
      if (!isFinite(xNext)) {
        this.mensaje = 'Se obtuvo un valor no finito para Xₖ₊₁. Iteración detenida.';
        break;
      }
  
      if (error <= this.errorMax) {
        this.mensaje = null;
        break;
      }
  
      // Actualizar los valores para la siguiente iteración
      xPrev = xCurr;
      xCurr = xNext;
      fxPrev = fxCurr;  // f(Xₖ) se convierte en f(Xₖ₋₁) en la siguiente iteración
      fxCurr = fxNext;  // f(Xₖ₋₁) se convierte en f(Xₖ) en la siguiente iteración
    }
  
    this.actualizarPaginacion();
    if (!this.mensaje) this.mensaje = null;
  
    if (typeof ggbApplet !== 'undefined' && this.resultados.length > 0) {
      const last = this.resultados[this.resultados.length - 1];
      const maybeXk1 = Number(String(last.xk1).replace(',', '.'));
      const maybeXk = Number(String(last.xk).replace(',', '.'));
      const xApprox = Number.isFinite(maybeXk1) ? maybeXk1 : maybeXk;
      if (Number.isFinite(xApprox)) this.plotApproxPoint(xApprox);
    }
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

  private plotApproxPoint(x: number) {
    try {
      if (typeof ggbApplet === 'undefined' || !isFinite(x)) return;

      if (ggbApplet.exists?.('P')) {
        ggbApplet.deleteObject('P');
      }

      ggbApplet.evalCommand(`P = (${x}, 0)`);

      ggbApplet.setPointSize?.('P', 7);
      ggbApplet.setColor?.('P', 0, 102, 204);
      ggbApplet.setLabelVisible?.('P', true);
      ggbApplet.setLabelStyle?.('P', 1);
    } catch {}
  }
}
