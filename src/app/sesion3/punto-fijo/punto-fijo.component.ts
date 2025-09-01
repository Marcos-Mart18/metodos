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

type ResultRow = { it: number; xk: string; gxk: string; err: string };

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
  convergio = false;

  ggbApp: any;

  despejes: Despeje[] = [];
  idxDespejeSeleccionado: number = -1;
  despejeGanador: Despeje | null = null;

  resultados: ResultRow[] = [];
  resultadosPaginados: ResultRow[] = [];
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
  private nodeToString(n: any): string | undefined {
    return n?.toString({ parenthesis: 'auto' });
  }
  private nodeIsX(n: any): boolean {
    return n?.type === 'SymbolNode' && n.name === 'x';
  }

  private containsX(n: any): boolean {
    let ok = false;
    n?.traverse?.((m: any) => {
      if (this.nodeIsX(m)) ok = true;
    });
    return ok;
  }

  private unwrapParen(n: any): any {
    return n && n.type === 'ParenthesisNode' ? this.unwrapParen(n.content) : n;
  }

  private isSymbolX(n: any): boolean {
    const m = this.unwrapParen(n);
    return m?.type === 'SymbolNode' && m.name === 'x';
  }

  private isNumericConst(n: any): boolean {
    const m = this.unwrapParen(n);
    return m?.type === 'ConstantNode' && !isNaN(Number(m.value));
  }

  private isConstTimesX(n: any): { ok: boolean; a: number } {
    const m = this.unwrapParen(n);
    if (!m || m.type !== 'OperatorNode' || m.op !== '*') return { ok: false, a: 0 };
    const args = m.args || [];
    if (args.length !== 2) return { ok: false, a: 0 };
    const A = this.unwrapParen(args[0]);
    const B = this.unwrapParen(args[1]);
    if (this.isNumericConst(A) && this.isSymbolX(B)) return { ok: true, a: Number(A.value) };
    if (this.isNumericConst(B) && this.isSymbolX(A)) return { ok: true, a: Number(B.value) };
    return { ok: false, a: 0 };
  }

  private collectAdditiveTerms(node: any, sign = 1, out: Array<{ node: any; sign: number }> = []) {
    const n = this.unwrapParen(node);
    if (!n) return out;
    if (n.type === 'OperatorNode' && n.op === '+') {
      for (const arg of n.args) this.collectAdditiveTerms(arg, sign, out);
    } else if (n.type === 'OperatorNode' && n.op === '-') {
      if (n.args.length === 1) {
        this.collectAdditiveTerms(n.args[0], -sign, out); // -(a)
      } else if (n.args.length === 2) {
        this.collectAdditiveTerms(n.args[0], sign, out);  // a - b
        this.collectAdditiveTerms(n.args[1], -sign, out);
      } else {
        out.push({ node: n, sign });
      }
    } else {
      out.push({ node: n, sign });
    }
    return out;
  }

  private nodeStr(n: any): string {
    const m = this.unwrapParen(n);
    return m?.toString({ parenthesis: 'auto' });
  }

  generarDespejes() {
    this.despejes = [];
    this.idxDespejeSeleccionado = -1;
    this.despejeGanador = null;
    this.resultados = [];
    this.convergio = false;
    this.actualizarPaginacion();

    if (!this.ecuacion) {
      this.mensaje = 'Por favor, ingresa una ecuación (ejemplo: x^2=2 o x^2-2).';
      return;
    }
    this.mensaje = null;

    this.despejes = this.generarDespejesDesdeIgualdad();

    if (this.despejes.length === 0) {
      this.mensaje = 'No se pudo aislar x en una forma x = g(x). No es posible iterar.';
      return;
    }

    this.idxDespejeSeleccionado = 0;
    this.renderMathJax();
  }

  seleccionarDespeje(i: number) {
    this.idxDespejeSeleccionado = i;
    this.renderMathJax();
  }

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
    this.convergio = false;
    this.actualizarPaginacion();
    this.despejeGanador = null;

    if (!this.ecuacion) {
      this.mensaje = 'Por favor, ingresa una ecuación.';
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

    if (this.despejes.length === 0) {
      this.mensaje = 'No se pudo aislar x en una forma x = g(x). No es posible iterar.';
      return;
    }
    if (this.idxDespejeSeleccionado < 0 || this.idxDespejeSeleccionado >= this.despejes.length) {
      this.mensaje = 'Primero detecta y selecciona un despeje.';
      return;
    }

    this.mensaje = null;

    const g = this.despejes[this.idxDespejeSeleccionado];
    const { success, rows } = this.iterarConG(g);

    this.resultados = rows;
    this.actualizarPaginacion();

    if (success) {
      this.convergio = true;
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
    this.convergio = false;
    this.actualizarPaginacion();
    this.despejeGanador = null;

    if (!this.ecuacion) {
      this.mensaje = 'Por favor, ingresa una ecuación.';
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

    if (this.despejes.length === 0) {
      this.despejes = this.generarDespejesDesdeIgualdad();
      if (this.despejes.length === 0) {
        this.mensaje = 'No se pudo aislar x en una forma x = g(x). No es posible iterar.';
        return;
      }
    }

    this.mensaje = null;
    this.plotOriginal();

    let mejor: { idx: number; rows: ResultRow[]; finalError: number } | null = null;

    for (let i = 0; i < this.despejes.length; i++) {
      const g = this.despejes[i];
      const r = this.iterarConG(g);

      if (r.success) {
        this.resultados = r.rows;
        this.actualizarPaginacion();
        this.despejeGanador = this.despejes[i];
        this.idxDespejeSeleccionado = i;
        this.convergio = true;
        this.mensaje = `Convergió con el despeje #${i + 1} en ${r.rows.length} iteraciones (err ≈ ${r.finalError.toFixed(9)} ≤ ${this.errorMax}).`;

        const last = this.resultados[this.resultados.length - 1];
        const gx = Number(String(last?.gxk ?? '').replace(',', '.'));
        const xk = Number(String(last?.xk ?? '').replace(',', '.'));
        const xApprox = isFinite(gx) ? gx : xk;
        this.plotApproxPoint(xApprox);

        this.renderMathJax();
        return;
      }

      if (!mejor || r.finalError < mejor.finalError) {
        mejor = { idx: i, rows: r.rows, finalError: r.finalError };
      }
    }

    if (mejor) {
      this.resultados = mejor.rows;
      this.actualizarPaginacion();
      this.despejeGanador = this.despejes[mejor.idx];
      this.idxDespejeSeleccionado = mejor.idx;
      this.mensaje = `Ningún despeje alcanzó la tolerancia. Se muestra el mejor intento (despeje #${mejor.idx + 1}) con error final ≈ ${mejor.finalError.toFixed(9)} ≥ ${this.errorMax}.`;
    } else {
      this.mensaje = 'No fue posible evaluar g(x) con los despejes propuestos.';
      this.resultados = [];
      this.actualizarPaginacion();
    }

    this.renderMathJax();
  }

  // ===== iteratividad y error correcto =====
  private iterarConG(
    g: Despeje
  ): {
    success: boolean;
    rows: ResultRow[];
    finalError: number;
  } {
    const gfun = (x: number) => math.evaluate(g.expr, { x, log: Math.log });

    let Xk = this.x0 as number; // x_k
    let success = false;
    const rows: ResultRow[] = [];
    let finalError = Number.POSITIVE_INFINITY;

    for (let k = 1; k <= this.maxIter; k++) {
      let Xk1: number; // x_{k+1} = g(x_k)
      try {
        Xk1 = gfun(Xk);
        if (!isFinite(Xk1)) throw new Error('g(x) no finito');
      } catch {
        return { success: false, rows, finalError };
      }

      // Error relativo porcentual respecto a x_{k+1}
      const denom = Math.max(Math.abs(Xk1), 1e-12);
      const err = Math.abs((Xk1 - Xk) / denom) * 100;
      finalError = err;

      rows.push({
        it: k,
        xk: Xk.toFixed(9),
        gxk: Xk1.toFixed(9),
        err: isFinite(err) ? err.toFixed(9) : 'Infinity',
      });

      if (err <= this.errorMax) {
        success = true;
        break;
      }

      Xk = Xk1; // avanzar
    }

    return { success, rows, finalError };
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

  // ===== Generador ampliado SIN fallbacks x - λ f(x) =====
  private generarDespejesDesdeIgualdad(): Despeje[] {
    // Asegura forma F(x) = 0
    let raw = this.ecuacion.includes('=') ? this.ecuacion : `${this.ecuacion}=0`;
    raw = raw.replace(/ln\(([^()]*)\)/g, 'log($1)');
    const [lhsRaw, rhsRaw] = raw.split('=').map((s) => s.trim());
    if (!lhsRaw || !rhsRaw) return [];

    const lhs = this.parseSide(lhsRaw);
    const rhs = this.parseSide(rhsRaw);
    if (!lhs || !rhs) return [];

    const gs: Despeje[] = [];
    const pushXeq = (gRaw: string, nota = 'Reordenado: x = g(x)') => {
      const node = math.parse(gRaw);
      gs.push({ expr: gRaw, mostrar: gRaw, latex: node.toTex(), nota });
    };

    // Casos explícitos: x = RHS o LHS = x
    if (this.isSymbolX(lhs)) pushXeq(rhsRaw, 'Explícito: x = RHS');
    if (this.isSymbolX(rhs)) pushXeq(lhsRaw, 'Explícito: x = LHS');
    if (gs.length > 0) return uniqByExpr(gs);

    // Construye F(x) = lhs - rhs
    const F = math.parse(`(${lhsRaw}) - (${rhsRaw})`);

    // Aísla x si F(x) es lineal en x a nivel suma/resta: coefX*x + (otros) = 0
    const terms = this.collectAdditiveTerms(F, 1, []);
    let coefX = 0;
    const others: Array<{ sign: number; str: string }> = [];

    for (const t of terms) {
      const n = t.node;

      if (this.isSymbolX(n)) {
        coefX += t.sign;
        continue;
      }
      const cx = this.isConstTimesX(n);
      if (cx.ok) {
        coefX += t.sign * cx.a;
        continue;
      }
      const s = this.nodeStr(n);
      if (s) others.push({ sign: t.sign, str: s });
    }

    if (coefX === 0) return []; // no se pudo aislar linealmente

    // x = -(sum otros)/coefX
    const parts: string[] = [];
    for (const o of others) parts.push(o.sign === 1 ? `(${o.str})` : `-(${o.str})`);
    const sumOthers = parts.length ? parts.join(' + ') : '0';

    let gStr: string;
    if (coefX === 1) gStr = `-(${sumOthers})`;
    else if (coefX === -1) gStr = `(${sumOthers})`;
    else gStr = `-(${sumOthers})/(${coefX})`;

    gStr = gStr.replace(/\-\(0\)/g, '0');
    if (gStr.trim() === 'x') return [];

    pushXeq(gStr, 'Aislamiento lineal en x a nivel suma');

    return uniqByExpr(gs);

    function uniqByExpr(arr: Despeje[]): Despeje[] {
      const seen = new Set<string>();
      return arr.filter((g) => {
        const key = g.expr.replace(/\s+/g, ' ');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  }
}
