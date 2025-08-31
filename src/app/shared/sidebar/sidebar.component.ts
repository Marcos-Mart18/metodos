import { NgFor, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [NgIf, NgFor, RouterLink],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent{
  unidades = [
    {
      nombre: 'Unidad 1',
      expandida: false,
      semanas: [
        { id: 1, nombre: 'Sesión 1' },
        { id: 2, nombre: 'Sesión 2' },
        { id: 3, nombre: 'Sesión 3' },
        // { id: 4, nombre: 'Sesión 4' }
      ],
    },
    {
      nombre: 'Unidad 2',
      expandida: false,
      semanas: [
        // { id: 5, nombre: 'Sesión 1' },
        // { id: 6, nombre: 'Sesión 2' },
        // { id: 7, nombre: 'Sesión 3' },
        // { id: 8, nombre: 'Sesión 4' },
        // { id: 9, nombre: 'Sesión 5' }
        { id: 9, nombre: 'Próximamente' },
      ],
    },
    {
      nombre: 'Unidad 3',
      expandida: false,
      semanas: [
        // { id: 10, nombre: 'Sesión 1' },
        // { id: 11, nombre: 'Sesión 2' },
        // { id: 12, nombre: 'Sesión 3' },
        // { id: 13, nombre: 'Sesión 4' }
        { id: 13, nombre: 'Próximamente' },
      ],
    },
  ];

  unidadSeleccionada: any = null;

  constructor(private router: Router) {}

  /*seleccionarUnidad(unidad: any) {
    if (this.unidadSeleccionada === unidad) {
      // Si clickea la misma unidad, la des-selecciona y va a Home
      this.unidadSeleccionada = null;
      this.router.navigate(['/home']);
    } else {
      // Selecciona nueva unidad
      this.unidadSeleccionada = unidad;
    }
  }*/

  seleccionarUnidad(unidad: any) {
    unidad.expandida = !unidad.expandida; // Alterna expandido/colapsado
  }
}
