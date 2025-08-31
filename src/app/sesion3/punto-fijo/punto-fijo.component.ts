import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { create, all } from 'mathjs';

const math = create(all);

declare var GGBApplet: any;
declare var ggbApplet: any;
declare var MathJax: any;

type Despeje = {
  expr: string;
  mostrar: string;
  latex: string;
  nota?: string;
};

@Component({
  selector: 'app-punto-fijo',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './punto-fijo.component.html',
})
export class PuntoFijoComponent implements OnInit {
  ecuacion: string = '';
  x0: number | null = null;
  errorMax: number = 0;
  maxIter: number = 0;

  mensaje: string | null = null;

  ggbApp: any;

  despejes: Despeje[] = [];
  idxDespejeSeleccionado: number = -1;
  despejeGanador: Despeje | null = null;

  resultados: Array<{ it: number; xk: string; gxk: string; err: string }> = [];
  resultadosPaginados: typeof this.resultados = [];
  paginaActual: number = 1;
  itemsPorPagina: number = 10;
  totalPaginas: number = 1;

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

  // ===== Normalizaciones =====
  private fParaMath(): string {
    if (!this.ecuacion) return '';
    let e = this.ecuacion.replace(/ln\(([^()]*)\)/g, 'log($1)');
    if (e.includes('=')) {
      const [lhs, rhs] = e.split('=');
      return `(${lhs.trim()}) - (${rhs.trim()})`;
    }
    return e;
  }

  private parseSide(raw: string): any {
    try {
      return math.parse(raw.replace(/ln\(/g, 'log('));
    } catch {
      return null;
    }
  }
  private nodeToString(n: any): string {
    return n?.toString({ parenthesis: 'auto' });
  }
  private nodeIsX(n: any): boolean {
    return n?.type === 'SymbolNode' && n.name === 'x';
  }
  private nodeIsConst(n: any): boolean {
    return n?.type === 'ConstantNode';
  }
  private nodeIsPow(n: any): boolean {
    return n?.type === 'OperatorNode' && n.op === '^';
  }
  private nodeIsMul(n: any): boolean {
    return n?.type === 'OperatorNode' && n.op === '*';
  }
  private containsX(n: any): boolean {
    let ok = false;
    n?.traverse?.((m: any) => {
      if (this.nodeIsX(m)) ok = true;
    });
    return ok;
  }

  // ===== UI principales =====
  generarDespejes() {
    this.despejes = [];
    this.idxDespejeSeleccionado = -1;
    this.despejeGanador = null;
    this.resultados = [];
    this.actualizarPaginacion();

    if (!this.ecuacion) {
      this.mensaje = "Por favor, ingresa una ecuación (ejemplo: x^2=2 o x^2-2).";
      return;
    }
    this.mensaje = null;

    this.despejes = this.generarDespejesDesdeIgualdad();

    if (this.despejes.length === 0) {
      const f = this.fParaMath();
      [1, 0.5, 0.2, 0.1].forEach((lam) => {
        const node = math.parse(`x - (${lam})*(${f})`);
        this.despejes.push({
          expr: `x - (${lam})*(${f})`,
          mostrar: `x - ${lam}·f(x)`,
          latex: node.toTex(),
          nota: 'Fallback genérico'
        });
      });
    }
    if (this.despejes.length > 0) this.idxDespejeSeleccionado = 0;

    this.renderMathJax();
  }

  seleccionarDespeje(i: number) {
    this.idxDespejeSeleccionado = i;
    this.renderMathJax();
  }

  // ===== Graficado =====
  private plotOriginal() {
    if (typeof ggbApplet === 'undefined') return;
    ggbApplet.reset();

    let expr = this.ecuacion.replace(/log\(/g, 'ln(');
    if (expr.includes('=')) {
      const [lhs, rhs] = expr.split('=');
      expr = `(${lhs.trim()}) - (${rhs.trim()})`;
    }

    ggbApplet.evalCommand(`f(x)=${expr}`);
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

  resolver() {
    this.resultados = [];
    this.actualizarPaginacion();
    this.despejeGanador = null;

    if (!this.ecuacion) {
      this.mensaje = "Por favor, ingresa una ecuación.";
      return;
    }
    if (this.x0 === null || isNaN(this.x0)) {
      this.mensaje = 'Ingresa x₀ (valor inicial).';
      return;
    }
    if (this.maxIter <= 0) {
      this.mensaje = 'El número de iteraciones debe ser mayor que 0.';
      return;
    }
    if (this.errorMax <= 0) {
      this.mensaje = 'El error máximo debe ser mayor que 0.';
      return;
    }
    if (this.idxDespejeSeleccionado < 0 || this.idxDespejeSeleccionado >= this.despejes.length) {
      this.mensaje = 'Primero detecta y selecciona un despeje.';
      return;
    }

    this.mensaje = null;

    const g = this.despejes[this.idxDespejeSeleccionado];
    const ok = this.iterarConG(g);
    if (ok) {
      this.despejeGanador = g;
      this.plotOriginal();

      const last = this.resultados[this.resultados.length - 1];
      const gx = Number(String(last?.gxk ?? '').replace(',', '.'));
      const xk = Number(String(last?.xk ?? '').replace(',', '.'));
      const xApprox = isFinite(gx) ? gx : xk;
      this.plotApproxPoint(xApprox);
    } else {
      this.mensaje = 'No se logró convergencia con el despeje seleccionado en el número de iteraciones dado.';
    }
    this.renderMathJax();
  }

  probarTodos() {
    this.resultados = [];
    this.actualizarPaginacion();
    this.despejeGanador = null;

    if (!this.ecuacion) {
      this.mensaje = "Por favor, ingresa una ecuación.";
      return;
    }
    if (this.x0 === null || isNaN(this.x0)) {
      this.mensaje = 'Ingresa x₀ (valor inicial).';
      return;
    }
    if (this.maxIter <= 0 || this.errorMax <= 0) {
      this.mensaje = 'Revisa iteraciones y error máximo.';
      return;
    }
    if (this.despejes.length === 0) this.generarDespejes();

    this.mensaje = null;
    this.plotOriginal();

    for (let i = 0; i < this.despejes.length; i++) {
      const g = this.despejes[i];
      this.resultados = [];
      const ok = this.iterarConG(g);
      if (ok) {
        this.despejeGanador = g;
        this.idxDespejeSeleccionado = i;

        const last = this.resultados[this.resultados.length - 1];
        const gx = Number(String(last?.gxk ?? '').replace(',', '.'));
        const xk = Number(String(last?.xk ?? '').replace(',', '.'));
        const xApprox = isFinite(gx) ? gx : xk;
        this.plotApproxPoint(xApprox);

        break;
      }
    }
    if (!this.despejeGanador) {
      this.mensaje = 'Ninguno de los despejes propuestos convergió dentro del error e iteraciones especificados.';
      this.resultados = [];
      this.actualizarPaginacion();
    }
    this.renderMathJax();
  }

  // ===== iteratividad de la tabla =====
  private iterarConG(g: Despeje): boolean {
    const gfun = (x: number) => math.evaluate(g.expr, { x, log: Math.log });

    let X_prev = this.x0 as number;
    let X_ante: number | null = null;
    const rows: Array<{ it: number; xk: string; gxk: string; err: string }> = [];

    for (let k = 0; k < this.maxIter; k++) {
      let X_curr: number;
      try {
        X_curr = gfun(X_prev);
        if (!isFinite(X_curr)) throw new Error('g(x) no finito');
      } catch {
        return false;
      }

      // Error relativo porcentual: |x_k - x_{k-1}| / |x_k| * 100 (k>=1)
      let err: number;
      if (k === 0) {
        err = Number.POSITIVE_INFINITY;
      } else {
        const denom = Math.abs(X_prev) > 1e-12 ? Math.abs(X_prev) : 1e-12;
        err = Math.abs((X_prev - (X_ante as number)) / denom) * 100;
      }

      // Fila
      rows.push({
        it: k,
        xk: X_prev.toFixed(9),   // x_k
        gxk: X_curr.toFixed(9),  // x_{k+1} = g(x_k)
        err: isFinite(err) ? err.toFixed(9) : "Infinity",
      });

      if (k > 0 && err <= this.errorMax) {
        this.resultados = rows;
        this.actualizarPaginacion();
        return true;
      }

      X_ante = X_prev;
      X_prev = X_curr;
    }

    this.resultados = rows;
    this.actualizarPaginacion();
    return false;
  }

  actualizarPaginacion() {
    this.totalPaginas = Math.ceil(this.resultados.length / this.itemsPorPagina) || 1;
    this.paginaActual = Math.min(this.paginaActual, this.totalPaginas);
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

  private renderMathJax() {
    setTimeout(() => {
      if (typeof MathJax !== 'undefined') {
        MathJax.typesetPromise();
      }
    }, 0);
  }

  private generarDespejesDesdeIgualdad(): Despeje[] {
    let raw = this.ecuacion.includes('=') ? this.ecuacion : `${this.ecuacion}=0`;
    raw = raw.replace(/ln\(([^()]*)\)/g, 'log($1)');
    const [lhsRaw, rhsRaw] = raw.split('=').map(s => s.trim());
    if (!lhsRaw || !rhsRaw) return [];

    const lhs = this.parseSide(lhsRaw);
    const rhs = this.parseSide(rhsRaw);
    if (!lhs || !rhs) return [];

    const gs: Despeje[] = [];

    const pushXeq = (gRaw: string) => {
      const node = math.parse(gRaw);
      gs.push({ expr: gRaw, mostrar: gRaw, latex: node.toTex(), nota: 'Reordenado: x = g(x)' });
    };

    if (rhsRaw === '0' && lhs.type === 'OperatorNode' && lhs.op === '-') {
      const [A, B] = lhs.args;
      if (this.nodeIsX(A)) pushXeq(this.nodeToString(B)!);
      if (this.nodeIsX(B)) pushXeq(this.nodeToString(A)!);
    }
    if (lhsRaw === '0' && rhs.type === 'OperatorNode' && rhs.op === '-') {
      const [A, B] = rhs.args;
      if (this.nodeIsX(A)) pushXeq(this.nodeToString(B)!);
      if (this.nodeIsX(B)) pushXeq(this.nodeToString(A)!);
    }

    if (this.nodeIsX(lhs)) {
      const node = math.parse(rhsRaw);
      gs.push({ expr: rhsRaw, mostrar: rhsRaw, latex: node.toTex(), nota: 'x = RHS' });
    }
    if (this.nodeIsX(rhs)) {
      const node = math.parse(lhsRaw);
      gs.push({ expr: lhsRaw, mostrar: lhsRaw, latex: node.toTex(), nota: 'x = LHS' });
    }

    const seen = new Set<string>();
    const uniq = gs.filter(g => {
      const key = g.expr.replace(/\s+/g, ' ');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // si no hay nada, añadimos los gλ(x) = x - λ f(x)
    if (uniq.length === 0) {
      const f = this.fParaMath();
      [1, 0.5, 0.2, 0.1].forEach(lam => {
        const expr = `x - (${lam})*(${f})`;
        const node = math.parse(expr);
        uniq.push({ expr, mostrar: expr, latex: node.toTex(), nota: 'Fallback genérico' });
      });
    }

    return uniq;
  }
}
