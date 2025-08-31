import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { create, all } from 'mathjs';

const math = create(all);

declare var GGBApplet: any;
declare var ggbApplet: any;

@Component({
  selector: 'app-biseccion',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './biseccion.component.html'
})
export class BiseccionComponent implements OnInit {
  ecuacion: string = '';
  errorMax: number = 0;
  maxIter: number = 0;

  resultados: any[] = [];

  // Intervalos detectados
  intervalos: { Xa: number; Xb: number }[] = [];
  intervaloSeleccionado: number = -1;

  // Nueva opción: detección automática o ingreso manual
  detectarAutomatico: boolean = true;

  // Variables para ingreso manual
  XaManual: number | null = null;
  XbManual: number | null = null;
  funcionGraficada: boolean = false;

  ggbApp: any;

  paginaActual: number = 1;
  resultadosPaginados: any[] = [];
  itemsPorPagina: number = 10;
  totalPaginas: number = 1;

  mensaje: string | null = null;

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

  detectarIntervalos() {
    const expr = this.normalizarEcuacionMath();
    if (!expr) {
      this.mensaje = 'Por favor, ingresa una ecuación válida';
      return;
    }

    const f = (x: number) => math.evaluate(expr, { x });
    this.intervalos = [];

    for (let i = -100; i < 100; i++) {
      try {
        const fa = f(i);
        const fb = f(i + 1);
        if (!isFinite(fa) || !isFinite(fb)) continue;
        if (fa * fb < 0) this.intervalos.push({ Xa: i, Xb: i + 1 });
      } catch {
        continue;
      }
    }

    if (this.intervalos.length === 0) {
      this.mensaje = 'No se encontró ningún intervalo con cambio de signo en [-100,100]';
    } else {
      this.mensaje = null;
      this.intervaloSeleccionado = 0;
    }

    setTimeout(() => {
      if (typeof ggbApplet !== 'undefined') {
        ggbApplet.reset();
        ggbApplet.evalCommand(`f(x)=${this.normalizarEcuacionGeoGebra()}`);
      }
    }, 500);
  }

  graficarFuncion() {
    const exprGeo = this.normalizarEcuacionGeoGebra();
    if (!exprGeo) {
      this.mensaje = 'Por favor, ingresa una ecuación válida antes de graficar.';
      return;
    }
    if (typeof ggbApplet !== 'undefined') {
      ggbApplet.reset();
      ggbApplet.evalCommand(`f(x)=${exprGeo}`);
    }
    this.funcionGraficada = true;
    this.mensaje = null;
  }

  resolver() {
    this.resultados = [];
    this.paginaActual = 1;

    const expr = this.normalizarEcuacionMath();
    if (!expr) {
      this.mensaje = 'Por favor, ingresa una ecuación válida.';
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

    let Xa: number, Xb: number;

    if (this.detectarAutomatico) {
      if (
        this.intervalos.length === 0 ||
        this.intervaloSeleccionado < 0 ||
        this.intervaloSeleccionado >= this.intervalos.length
      ) {
        this.mensaje = 'Primero detecta intervalos y selecciona uno válido.';
        return;
      }
      Xa = this.intervalos[this.intervaloSeleccionado].Xa;
      Xb = this.intervalos[this.intervaloSeleccionado].Xb;
    } else {
      if (this.XaManual === null || this.XbManual === null) {
        this.mensaje = 'Ingresa manualmente Xa y Xb después de graficar.';
        return;
      } else if (this.XaManual >= this.XbManual) {
        this.mensaje = 'Xa tiene q ser menor que Xb';
        return;
      } else if (f(this.XaManual) * f(this.XbManual) > 0) {
        this.mensaje = 'f(Xa) y f(Xb) deben tener signos opuestos';
        return;
      }
      Xa = this.XaManual;
      Xb = this.XbManual;
    }

    let XkAnt: number | null = null;
    let error: number = 100;

    for (let k = 1; k <= this.maxIter && error > this.errorMax; k++) {
      const Xk: number = (Xa + Xb) / 2;
      const fXa: number = f(Xa);
      const fXb: number = f(Xb);
      const fXk: number = f(Xk);

      if (XkAnt !== null) {
        error = Math.abs((Xk - XkAnt) / Xk) * 100;
      } else {
        error = Number.POSITIVE_INFINITY;
      }

      this.resultados.push({
        id: k,
        Xa: Xa.toFixed(9),
        Xb: Xb.toFixed(9),
        fXa: fXa.toFixed(9),
        fXb: fXb.toFixed(9),
        Xk: Xk.toFixed(9),
        fXk: fXk.toFixed(9),
        signo: fXa * fXk > 0 ? '> 0' : '< 0',
        error: error.toFixed(9),
      });

      if (fXa * fXk < 0) {
        Xb = Xk;
      } else {
        Xa = Xk;
      }

      XkAnt = Xk;
    }

    this.actualizarPaginacion();
    this.mensaje = null;

    // 👉 Dibujar P sobre el eje X con la última aproximación
    if (typeof ggbApplet !== 'undefined' && this.resultados.length > 0) {
      const last = this.resultados[this.resultados.length - 1];
      const xApprox = Number(String(last.Xk).replace(',', '.'));
      if (isFinite(xApprox)) {
        this.plotApproxPoint(xApprox);
      }
    }
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

  // Solo dibuja el punto P sobre el eje X
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
