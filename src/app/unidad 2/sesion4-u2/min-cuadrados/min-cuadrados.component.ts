import { Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

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
  imports: [CommonModule, FormsModule, RouterLink],
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

  // ------------- Importar Excel/CSV -------------
  async onExcelFileSelected(evt: Event): Promise<void> {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');

      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      if (!ws) throw new Error('No se encontró hoja en el archivo.');

      // header:1 -> filas como arrays
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
      if (!rows.length) throw new Error('La hoja está vacía.');

      const first = rows[0]?.map((c: any) => (c ?? '').toString().trim().toLowerCase());
      let dataRows: any[][] = rows;
      let xIdx = 0, yIdx = 1;

      const idxOf = (arr: string[], key: string) => arr.findIndex(h => h.replace(/\s+/g, '') === key);

      const looksHeader = first && (idxOf(first, 'x') !== -1 || idxOf(first, 'y') !== -1);
      if (looksHeader) {
        const fx = idxOf(first, 'x');
        const fy = idxOf(first, 'y');
        if (fx !== -1) xIdx = fx;
        if (fy !== -1) yIdx = fy;
        dataRows = rows.slice(1);
      } else {
        xIdx = 0; yIdx = 1;
      }

      const parseNum = (v: any): number | null => {
        if (v === null || v === undefined || v === '') return null;
        if (typeof v === 'string') v = v.replace(',', '.');
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const parsed: Fila[] = [];
      for (const r of dataRows) {
        if (!r) continue;
        const x = parseNum(r[xIdx]);
        const y = parseNum(r[yIdx]);
        if (x === null && y === null) continue;
        parsed.push({ x, y });
      }

      if (parsed.length === 0) {
        throw new Error('No se encontraron pares (x, y) válidos.');
      }

      this.filas = parsed;
      this.resetResultados();

      // Si quieres calcular automáticamente:
      // await this.calcularYMostrar();

      input.value = ''; // permitir re-subir el mismo archivo
    } catch (err: any) {
      console.error(err);
      alert('No se pudo importar el archivo: ' + (err?.message || 'Error desconocido'));
    }
  }

  // ------------- Descargar plantilla (XLSX/CSV) -------------
  async onDownloadTemplate(format: 'xlsx' | 'csv' = 'xlsx'): Promise<void> {
    const headers = ['x', 'y'];
    const sampleRows = [
      [1, 1.2],
      [2, 1.9],
      [3, 3.2],
      [4, 3.9],
    ];

    if (format === 'csv') {
      const lines = [headers.join(','), ...sampleRows.map(r => r.join(','))];
      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_regresion_simple.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // XLSX
    const XLSX = await import('xlsx');
    const aoa = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 10 }, { wch: 10 }]; // ancho de columnas

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, 'plantilla_regresion_simple.xlsx');
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
      \hat{\beta}_0=\frac{\sum y-(\hat{\beta}_1)(\sum x)}{n}
      =\frac{${sY}-(${b1s})\,(${sX})}{${n}}
      = ${b0s}
    \]`;

    this.ecuacionTeX = String.raw`\[
      \hat{y} = ${b0s} + ${b1s}\,x
    \]`;

    this.calculado = true;
    await this.typesetMath();

    const ok = await this.ensureGeoGebraInjected();
    if (!ok) return;

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
