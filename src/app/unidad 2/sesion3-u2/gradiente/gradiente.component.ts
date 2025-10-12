import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { all, create, MathJsStatic, MathNode } from 'mathjs';

const math: MathJsStatic = create(all, {});

declare global {
  interface Window { ggbApplet?: any; GGBApplet?: any; }
}

interface ResultadoFila {
  k: number;
  x: number; y: number;
  gx: number; gy: number; // gradiente puro
  sxDir: number; syDir: number; // dirección elegida (gradiente o -gradiente)
  gradNorm: number;
  sx: number; sy: number; // vector s = dirección elegida
  alpha: number;
  xNext: number; yNext: number;
  fNext: number;
  errPct: number; // error relativo (%) usando norma del paso
}

@Component({
  selector: 'app-gradiente',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './gradiente.component.html'
})
export class GradienteComponent implements OnInit {
  // Estado UI
  ecuacion = '';
  errorMax = 0.01; // %
  maxIter = 200;
  maximizar = false;
  Xa = 1;
  Ya = 1;
  decimales = 10;

  mensajeResultado = '';
  mensajeError = '';
  geogebraNoDisponible = false;

  // Resultados y paginación
  resultados: ResultadoFila[] = [];
  paginaActual = 1;
  itemsPorPagina = 15;
  totalPaginas = 1;
  resultadosPaginados: ResultadoFila[] = [];
  paginas: number[] = [];

  // Compilados para rendimiento
  private fNode?: MathNode;
  private dfxNode?: MathNode;
  private dfyNode?: MathNode;

  ngOnInit(): void {
    this.initGeoGebra3D();
  }

  // === Núcleo del método ===
  resolver(): void {
    this.mensajeResultado = '';
    this.mensajeError = '';
    this.resultados = [];
    this.paginaActual = 1;

    // Validación básica
    if (!this.ecuacion?.trim()) {
      this.mensajeError = 'Ingresa una ecuación válida de x e y.';
      this.actualizarPaginacion();
      return;
    }

    // Compilar f y derivadas una sola vez
    try {
      this.fNode = math.parse(this.ecuacion);
      this.dfxNode = math.derivative(this.fNode, 'x');
      this.dfyNode = math.derivative(this.fNode, 'y');
    } catch (e) {
      this.mensajeError = 'La ecuación no se pudo interpretar. Revisa la sintaxis.';
      this.actualizarPaginacion();
      return;
    }

    // Scopes numéricos
    const f = (x: number, y: number): number => {
      return this.fNode!.evaluate({ x, y }) as number;
    };
    const gx = (x: number, y: number): number => {
      return this.dfxNode!.evaluate({ x, y }) as number;
    };
    const gy = (x: number, y: number): number => {
      return this.dfyNode!.evaluate({ x, y }) as number;
    };

    // Parámetros de búsqueda de línea (Armijo backtracking)
    const beta = 0.5;   // factor de reducción
    const c1 = 1e-4;    // condición de Armijo
    const gradTol = 1e-12; // tolerancia de gradiente

    let x = Number(this.Xa);
    let y = Number(this.Ya);

    if (!isFinite(x) || !isFinite(y)) {
      this.mensajeError = 'X₀ y Y₀ deben ser números válidos.';
      this.actualizarPaginacion();
      return;
    }

    let k = 0;
    let errPct = 100;

    while (k < this.maxIter && errPct > this.errorMax) {
      const gxVal = gx(x, y);
      const gyVal = gy(x, y);
      const gradNorm = Math.hypot(gxVal, gyVal);

      if (!isFinite(gradNorm)) {
        this.mensajeError = 'El gradiente produjo valores no finitos. Revisa la ecuación y el punto inicial.';
        break;
      }
      if (gradNorm < gradTol) {
        // Punto estacionario alcanzado
        const valor = f(x, y);
        this.mensajeResultado = `${this.maximizar ? 'Máximo (posible)' : 'Mínimo (posible)'} en (${x.toFixed(this.decimales)}, ${y.toFixed(this.decimales)}), f = ${valor.toFixed(this.decimales)}`;
        break;
      }

      // Dirección (ascenso si maximizar, descenso si minimizar)
      const sxDir = this.maximizar ? gxVal : -gxVal;
      const syDir = this.maximizar ? gyVal : -gyVal;

      // Búsqueda de línea (Armijo) adaptada a ascenso/descenso
      const fxy = f(x, y);
      const dphi = gxVal * sxDir + gyVal * syDir; // derivada direccional
      let alpha = 1;
      let xNew = x + alpha * sxDir;
      let yNew = y + alpha * syDir;
      let fNew = f(xNew, yNew);

      // Condición de Armijo: para descenso: f(x+αs) <= f(x) + c1 α dphi; para ascenso, la desigualdad se invierte
      const isArmijoOk = (fTrial: number, a: number) => {
        const rhs = fxy + c1 * a * dphi;
        return this.maximizar ? (fTrial >= rhs) : (fTrial <= rhs);
      };

      let lsIters = 0;
      while (!isArmijoOk(fNew, alpha) && alpha > 1e-12 && lsIters < 50) {
        alpha *= beta;
        xNew = x + alpha * sxDir;
        yNew = y + alpha * syDir;
        fNew = f(xNew, yNew);
        lsIters++;
      }

      if (!isFinite(fNew)) {
        this.mensajeError = 'La búsqueda de línea generó valores no finitos. Intenta con otro punto inicial o ajusta la ecuación.';
        break;
      }

      // Error relativo porcentual usando norma del paso
      const stepNorm = Math.hypot(xNew - x, yNew - y);
      const denom = Math.max(1, Math.hypot(xNew, yNew));
      errPct = (stepNorm / denom) * 100;

      this.resultados.push({
        k,
        x, y,
        gx: gxVal, gy: gyVal,
        sxDir, syDir,
        gradNorm,
        sx: sxDir, sy: syDir,
        alpha,
        xNext: xNew, yNext: yNew,
        fNext: fNew,
        errPct,
      });

      // Avance
      x = xNew; y = yNew; k++;
    }

    // Mensaje final si no se disparó antes
    if (!this.mensajeResultado) {
      const valor = this.fNode ? (this.fNode.evaluate({ x, y }) as number) : NaN;
      this.mensajeResultado = `${this.maximizar ? 'Máximo (iterado)' : 'Mínimo (iterado)'} en (${x.toFixed(this.decimales)}, ${y.toFixed(this.decimales)}), f = ${isFinite(valor) ? valor.toFixed(this.decimales) : '—'}`;
    }

    this.actualizarPaginacion();
    this.actualizarGraficoGeoGebra();
  }

  // === Utilitarios de UI ===
  insertar(simbolo: string): void { this.ecuacion = (this.ecuacion || '') + simbolo; }
  setEjemplo(expr: string): void { this.ecuacion = expr; }
  limpiar(): void {
    this.resultados = [];
    this.mensajeResultado = '';
    this.mensajeError = '';
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  trackByIndex(index: number): number { return index; }

  // === Paginación ===
  private buildPaginas(): void {
    this.totalPaginas = Math.max(1, Math.ceil(this.resultados.length / this.itemsPorPagina));
    this.paginas = Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  actualizarPaginacion(): void {
    this.buildPaginas();
    const start = (this.paginaActual - 1) * this.itemsPorPagina;
    const end = this.paginaActual * this.itemsPorPagina;
    this.resultadosPaginados = this.resultados.slice(start, end);
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
    this.actualizarPaginacion();
  }

  // === GeoGebra ===
  initGeoGebra3D(): void {
    const container = document.getElementById('geogebra-graph');
    if (!container) return;

    try {
      if (window.GGBApplet) {
        const ggbApp = new window.GGBApplet({
          appName: '3d',
          width: container.clientWidth,
          height: container.clientHeight,
          showToolBar: false,
          showAlgebraInput: false,
          showMenuBar: false,
        }, true);
        // Inyección inmediata (SPA)
        ggbApp.inject('geogebra-graph');
      } else {
        this.geogebraNoDisponible = true;
      }
    } catch {
      this.geogebraNoDisponible = true;
    }
  }

  actualizarGraficoGeoGebra(): void {
    const ggb = window.ggbApplet;
    if (!ggb || !this.ecuacion) return;

    // Reemplazar x,y por X,Y SOLO como variables aisladas
    const ecuacion3D = this.ecuacion
      .replace(/\bx\b/g, 'X')
      .replace(/\by\b/g, 'Y');

    try {
      ggb.evalCommand(`f(X, Y) = ${ecuacion3D}`);
      ggb.evalCommand('SetVisibleInView(f, 1, true)');
      ggb.evalCommand('SetVisibleInView(f, 2, true)');
      ggb.evalCommand('SetVisibleInView(f, 3, true)');
    } catch {
      // Silencioso
    }
  }
}