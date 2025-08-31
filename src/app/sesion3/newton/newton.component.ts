import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { create, all } from 'mathjs';

const math = create(all);

declare var GGBApplet: any;
declare var ggbApplet: any;

@Component({
  selector: 'app-newton',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './newton.component.html'
})
export class NewtonComponent implements OnInit {
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
    let ecuacionNormalizada = this.ecuacion.replace(/ln\(([^()]*)\)/g, 'log($1)');
    if (ecuacionNormalizada.includes('=')) {
      const [lhs, rhs] = ecuacionNormalizada.split('=');
      return `(${lhs.trim()}) - (${rhs.trim()})`;
    }
    return ecuacionNormalizada;
  }

  private normalizarEcuacionGeoGebra(): string {
    if (!this.ecuacion) return '';
    let ecuacionNormalizada = this.ecuacion.replace(/ln\(([^()]*)\)/g, 'ln($1)');
    if (ecuacionNormalizada.includes('=')) {
      const [lhs, rhs] = ecuacionNormalizada.split('=');
      return `(${lhs.trim()}) - (${rhs.trim()})`;
    }
    return ecuacionNormalizada;
  }

  resolver() {
    this.resultados = [];
    this.paginaActual = 1;

    const expr = this.normalizarEcuacionMath();
    if (!expr) { this.mensaje = 'Por favor, ingresa una ecuación válida.'; return; }
    if (this.x0 === null) { this.mensaje = 'Debes ingresar un valor inicial X₀.'; return; }
    if (this.maxIter <= 0) { this.mensaje = 'El número máximo de iteraciones debe ser mayor que 0.'; return; }
    if (this.errorMax <= 0) { this.mensaje = 'El error máximo debe ser mayor que 0.'; return; }

    const f = (x: number) => math.evaluate(expr, { x });
    const dfdx = math.derivative(expr, 'x').toString();
    const df = (x: number) => math.evaluate(dfdx, { x });

    // --- Iteración 0: calcular x1 y registrar error = ∞ ---
    const x0 = this.x0!;
    const fx0 = f(x0);
    const dfx0 = df(x0);
    if (dfx0 === 0) { this.mensaje = 'La derivada se anuló en X₀, no se puede continuar.'; return; }
    const x1 = x0 - fx0 / dfx0;

    this.resultados.push({
      iteracion: 0,
      xk: x0.toFixed(9),
      fxk: fx0.toFixed(9),
      dfxk: dfx0.toFixed(9),
      xk1: x1.toFixed(9),
      error: 'Infinity'
    });

    // Para la iteración 1 en adelante:
    let xPrev = x0;
    let xk = x1;

    for (let i = 1; i < this.maxIter; i++) {
      const fxk = f(xk);
      const dfxk = df(xk);
      if (dfxk === 0) { this.mensaje = 'La derivada se anuló, no se puede continuar.'; break; }

      // Calcular Xk+1
      const xk1 = xk - fxk / dfxk;

      // ERROR relativo porcentual: |x_k - x_{k-1}| / |x_k| * 100
      const error = (xk === 0) ? Infinity : Math.abs((xk - xPrev) / xk) * 100;

      this.resultados.push({
        iteracion: i,
        xk: xk.toFixed(9),
        fxk: fxk.toFixed(9),
        dfxk: dfxk.toFixed(9),
        xk1: xk1.toFixed(9),
        error: (Number.isFinite(error) ? error.toFixed(9) : 'Infinity'),
      });

      if (Number.isFinite(error) && error <= this.errorMax) {
        xk = xk1; // opcional: llevar el último para graficar
        break;
      }

      xPrev = xk;
      xk = xk1;
    }

    this.actualizarPaginacion();

    if (typeof ggbApplet !== 'undefined') {
      ggbApplet.reset();
      ggbApplet.evalCommand(`f(x)=${this.normalizarEcuacionGeoGebra()}`);

      if (this.resultados.length > 0) {
        const last = this.resultados[this.resultados.length - 1];
        const xApprox = Number(String(last.xk1 ?? last.xk).replace(',', '.'));
        if (isFinite(xApprox)) {
          this.plotApproxPoint(xApprox);
        }
      }
    }

    this.mensaje = null;
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
