import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { Sesion1Component } from './sesion1/sesion1.component';
import { TheoryErrorComponent } from './sesion1/theory-error/theory-error.component';
import { PuntoFlotanteComponent } from './sesion1/punto-flotante/punto-flotante.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    component: HomeComponent,
  },
  {
    path: 'sesion1',
    component: Sesion1Component,
  },
  {
    path: 'theory-error',
    component: TheoryErrorComponent,
  },
  {
    path: 'punto-flotante',
    component: PuntoFlotanteComponent,
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
