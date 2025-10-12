import { Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Num = number;
interface Fila { x: Num | null; y: Num | null; }

declare global {
  interface Window {
    GGBApplet?: any;
    ggbApplet?: any; // instancia global que crea GeoGebra
    MathJax?: any;
  }
}

@Component({
  selector: 'app-min-cuadrados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './min-cuadrados.component.html'
})
export class MinCuadradosComponent {

  constructor(private cdr: ChangeDetectorRef) {}

  // -------- Datos ----------
  filas: Fila[] = [
    { x: 1, y: 1.2 },
    { x: 2, y: 1.9 },
    { x: 3, y: 3.2 },
    { x: 4, y: 3.9 }
  ];
  decimales = 4;

  // derivadas y sumas
  x2: Num[] = [];
  xy: Num[] = [];
  n = 0; sumX = 0; sumY = 0; sumX2 = 0; sumXY = 0;

  // coeficientes
  b1: number | null = null;
  b0: number | null = null;

  // fórmulas (TeX)
  formulaB1TeX = '';
  formulaB0TeX = '';
  ecuacionTeX  = '';
  sxxMsgTeX    = '';

  calculado = false;
  sxxCero = false;
  insuficiente = false;

  // Hosts
  @ViewChild('mathHost') mathHost!: ElementRef<HTMLDivElement>;
  @ViewChild('ggbHost')  ggbHost?: ElementRef<HTMLDivElement>;

  // GeoGebra
  private ggbInjected = false;
  private ggbReady = false;

  // ------------- Utils -------------
  private nextFrame(): Promise<void> {
    return new Promise(res => requestAnimationFrame(() => res()));
  }

  private waitForMathJax(): Promise<any> {
    return new Promise((resolve) => {
      const tick = () => {
        const MJ = window.MathJax;
        if (MJ?.typesetPromise) resolve(MJ);
        else setTimeout(tick, 40);
      };
      tick();
    });
  }

  private async typesetMath(): Promise<void> {
    // asegura que el bloque con *ngIf ya esté en el DOM
    this.cdr.detectChanges();
    await this.nextFrame();
    const MJ = await this.waitForMathJax();
    await MJ.typesetPromise([this.mathHost?.nativeElement || document.body]);
  }

  private waitForGgbApplet(): Promise<void> {
    return new Promise((resolve) => {
      const tick = () => {
        if (window.ggbApplet) resolve();
        else setTimeout(tick, 40);
      };
      tick();
    });
  }

  private async ensureGeoGebraInjected(): Promise<boolean> {
    // Solo cuando el contenedor exista (está dentro de *ngIf)
    await this.nextFrame();
    const host = this.ggbHost?.nativeElement;
    if (!host) return false;

    if (!host.id) host.id = 'ggb-element';

    if (!this.ggbInjected) {
      const app = new window.GGBApplet(
        {
          appName: 'graphing',
          width: host.clientWidth || 800,
          height: 400,
          showToolBar: false,
          showAlgebraInput: false,
          showMenuBar: false,
          showKeyboard: false,
          showZoomButtons: true,
          appletOnLoad: () => {
            this.ggbReady = true;
            window.ggbApplet?.setGridVisible(true);
            window.ggbApplet?.setAxesVisible(true, true);
          }
        },
        true
      );
      app.inject(host.id);
      this.ggbInjected = true;
      await this.waitForGgbApplet();
    }

    // si aún no disparó appletOnLoad, espera brevemente
    if (!this.ggbReady) {
      await new Promise(res => setTimeout(res, 100));
    }
    return true;
  }

  // ------------- UI helpers -------------
  f(v: unknown): string {
    const n = typeof v === 'string' ? Number(v) : (v as number);
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(this.decimales);
  }
  addFila() { this.filas.push({ x: null, y: null }); }
  delFila(i: number) { this.filas.splice(i, 1); }
  limpiar(): void {
    this.filas = [{ x: null, y: null }];
    this.resetResultados();
    if (this.ggbReady) window.ggbApplet?.reset();
  }
  private resetResultados(): void {
    this.x2 = []; this.xy = [];
    this.n = 0; this.sumX = this.sumY = this.sumX2 = this.sumXY = 0;
    this.b0 = this.b1 = null;
    this.formulaB0TeX = this.formulaB1TeX = this.ecuacionTeX = this.sxxMsgTeX = '';
    this.sxxCero = this.insuficiente = false;
    this.calculado = false;
  }

  // ------------- Cálculo + Render -------------
  async calcularYMostrar(): Promise<void> {
    this.resetResultados();

    const datos = this.filas
      .map(r => ({ x: Number(r.x), y: Number(r.y) }))
      .filter(r => Number.isFinite(r.x) && Number.isFinite(r.y));

    this.n = datos.length;
    if (this.n < 2) {
      this.insuficiente = true;
      this.calculado = true;
      await this.typesetMath();
      return;
    }

    // derivadas y sumas
    for (const { x, y } of datos) {
      const xq = x * x, xy = x * y;
      this.x2.push(xq); this.xy.push(xy);
      this.sumX += x; this.sumY += y; this.sumX2 += xq; this.sumXY += xy;
    }

    // coeficientes prácticos
    const denom = this.n * this.sumX2 - this.sumX * this.sumX;
    const numer = this.n * this.sumXY - this.sumX * this.sumY;

    if (Math.abs(denom) < Number.EPSILON) {
      this.sxxCero = true;
      this.sxxMsgTeX = String.raw`\[
        \text{No se puede calcular la pendiente porque }
        n\sum x^{2} - (\sum x)^{2} = 0 \ \text{(todos los X son iguales).}
      \]`;
      this.calculado = true;
      await this.typesetMath();
      return;
    }

    this.b1 = numer / denom;
    this.b0 = (this.sumY - (this.b1 * this.sumX)) / this.n;

    // strings redondeados
    const n = this.n;
    const sX  = this.f(this.sumX);
    const sY  = this.f(this.sumY);
    const sX2 = this.f(this.sumX2);
    const sXY = this.f(this.sumXY);
    const b1s = this.f(this.b1);
    const b0s = this.f(this.b0);

    this.formulaB1TeX = String.raw`\[
      \hat{\beta}_1=\frac{n\sum xy-(\sum x)(\sum y)}{n\sum x^{2}-(\sum x)^{2}}
      =\frac{${n}\cdot ${sXY}-(${sX})(${sY})}{${n}\cdot ${sX2}-(${sX})^{2}}
      = ${b1s}
    \]`;

    this.formulaB0TeX = String.raw`\[
      \hat{\beta}_0=\frac{\sum y-\hat{\beta}_1\sum x}{n}
      =\frac{${sY}-${b1s}\,${sX}}{${n}}
      = ${b0s}
    \]`;

    this.ecuacionTeX = String.raw`\[
      \hat{y} = ${b0s} + ${b1s}\,x
    \]`;

    // 1) mostrar panel y tipografiar al primer click
    this.calculado = true;
    await this.typesetMath();

    // 2) inyectar GeoGebra si aún no existe (el div recién apareció)
    const ok = await this.ensureGeoGebraInjected();
    if (!ok) return;

    // 3) dibujar
    if (this.ggbReady) {
      const g = window.ggbApplet;
      g.reset();
      g.setGridVisible(true);
      g.setAxesVisible(true, true);

      datos.forEach((p, i) => {
        const name = `A${i + 1}`;
        g.evalCommand(`${name}=(${p.x},${p.y})`);
        g.setPointSize(name, 5);
        g.setPointStyle(name, 0);
        g.setColor(name, 20, 20, 20);
      });

      const b0 = this.b0 as number, b1 = this.b1 as number;
      g.evalCommand(`f(x)=${b0}+${b1}*x`);
      g.setLineThickness('f', 5);
      g.setColor('f', 0, 80, 200);

      const xs = datos.map(d => d.x), ys = datos.map(d => d.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const mx = (maxX - minX) || 1, my = (maxY - minY) || 1;
      const x1 = minX - 0.1*mx, x2 = maxX + 0.1*mx;
      const y1 = minY - 0.2*my, y2 = maxY + 0.2*my;
      g.setCoordSystem(x1, x2, y1, y2);
    }
  }
}
