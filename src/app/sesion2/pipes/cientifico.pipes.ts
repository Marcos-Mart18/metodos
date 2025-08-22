import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'cientifico' })
export class CientificoPipe implements PipeTransform {
  transform(value: number, cifras: number = 9): string {
    if (value === null || value === undefined || isNaN(value)) return '';

    // Valor absoluto para comparar magnitud
    const absValue = Math.abs(value);

    // Umbrales: si el número es muy grande (>1e6) o muy pequeño (<1e-3)
    if (absValue !== 0 && (absValue >= 1e6 || absValue < 1e-3)) {
      return value.toExponential(cifras);
    }

    // Si no, lo mostramos normal con las cifras decimales pedidas
    return value.toFixed(6).replace(/\.?0+$/, '');
    // (esto quita ceros sobrantes)
  }
}
