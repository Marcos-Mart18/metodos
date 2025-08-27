import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { create, all } from 'mathjs';

const math = create(all);

declare var GGBApplet: any;
declare var ggbApplet: any;
@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './falsa-posicion.component.html',
  styleUrls: ['./falsa-posicion.component.css'],
})
export class FalsaPosicionComponent {
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

  private normalizarEcuacion(): string {
    if (!this.ecuacion) return '';
    if (this.ecuacion.includes('=')) {
      const [lhs, rhs] = this.ecuacion.split('=');
      return `(${lhs.trim()}) - (${rhs.trim()})`;
    }
    return this.ecuacion;
  }

  detectarIntervalos() {
    const expr = this.normalizarEcuacion();
    if (!expr) {
      this.mensaje = 'Por favor, ingresa una ecuación válida';
      return;
    }

    const f = (x: number) => math.evaluate(expr, { x });
    this.intervalos = [];

    // Recorrer la función para detectar intervalos con cambio de signo
    for (let i = -100; i < 100; i++) {
      if (f(i) * f(i + 1) < 0) {
        this.intervalos.push({ Xa: i, Xb: i + 1 });
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
        ggbApplet.evalCommand(`f(x)=${expr}`);
      }
    }, 500);
  }

  graficarFuncion() {
    const expr = this.normalizarEcuacion();
    if (!expr) {
      this.mensaje = 'Por favor, ingresa una ecuación válida antes de graficar.';
      return;
    }

    if (typeof ggbApplet !== 'undefined') {
      ggbApplet.reset();
      ggbApplet.evalCommand(`f(x)=${expr}`);
    }

    this.funcionGraficada = true;
    this.mensaje = null;
  }

  resolver() {
    this.resultados = [];
    this.paginaActual = 1;

    const expr = this.normalizarEcuacion();
    if (!expr) {
      this.mensaje = 'Por favor, ingresa una ecuación válida.';
      return;
    }

    if(this.maxIter <= 0) {
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
      } else if(this.XaManual >= this.XbManual){    
        this.mensaje = 'Xa tiene q ser menor que Xb';
        return;
      }else if (f(this.XaManual) * f(this.XbManual) > 0) {   //validar que las funciones xa y xb sean menores que 0
        this.mensaje = 'f(Xa) y f(Xb) deben tener signos opuestos';
        return;
    }
      Xa = this.XaManual;
      Xb = this.XbManual;
    }

    let XkAnt: number | null = null;
    let error: number = 100;

    
    //cálculos para los componentes de la tabla
    for (let k = 1; k <= this.maxIter && error > this.errorMax; k++) {
      const fXa: number = f(Xa);
      const fXb: number = f(Xb);
      const Xk: number = ((Xa* fXb) - (Xb* fXa)) / (fXb-fXa);
      const fXk: number = f(Xk);

      if (XkAnt !== null) {
        error = Math.abs((Xk - XkAnt) / Xk) * 100;
      } else {
        error = Number.POSITIVE_INFINITY; 
      }

      this.resultados.push({
        id: k,
        Xa: Xa,
        Xb: Xb,
        fXa: fXa.toFixed(9),
        fXb: fXb.toFixed(9),
        Xk: Xk.toFixed(9),
        fXk: fXk.toFixed(9),
        signo: fXa * fXk > 0 ? '> 0' : '< 0',
        error: error.toFixed(9),
      });

      
      //condiciones de cambios del valor del intervalo
      if (fXa * fXk < 0) {
        Xb = Xk;
      } else {
        Xa = Xk;
      }

      XkAnt = Xk;
    }

    this.actualizarPaginacion();
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
}
