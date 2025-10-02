import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { Sesion1Component } from './sesion1/sesion1.component';
import { TheoryErrorComponent } from './sesion1/theory-error/theory-error.component';
import { PuntoFlotanteComponent } from './sesion1/punto-flotante/punto-flotante.component';
import { Sesion2Component } from './sesion2/sesion2.component';
import { BiseccionComponent } from './sesion2/biseccion/biseccion.component';
import { FalsaPosicionComponent } from './sesion2/falsa-posicion/falsa-posicion.component';
import { Sesion3Component } from './sesion3/sesion3.component';
import { PuntoFijoComponent } from './sesion3/punto-fijo/punto-fijo.component';
import { NewtonComponent } from './sesion3/newton/newton.component';
import { SecanteComponent } from './sesion3/secante/secante.component';
import { Sesion1U2Component } from './sesion1-u2/sesion1-u2.component';
import { GaussComponent } from './sesion1-u2/gauss/gauss.component';
import { GaussJordanComponent } from './sesion1-u2/gauss-jordan/gauss-jordan.component';
import { FactorizacionLuComponent } from './sesion1-u2/factorizacion-lu/factorizacion-lu.component';

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
    path: 'sesion2',
    component: Sesion2Component,
  },
  {
    path: 'biseccion',
    component: BiseccionComponent,
  },
  {
    path: 'falsa-posicion',
    component: FalsaPosicionComponent,
  },
  {
    path: 'sesion3',
    component: Sesion3Component,
  },
  {
    path: 'punto-fijo',
    component: PuntoFijoComponent,
  },
  {
    path: 'newton',
    component: NewtonComponent,
  },
  {
    path: 'secante',
    component: SecanteComponent,
  },
  {
    path: 'sesion5',
    component: Sesion1U2Component,
  },
  {
    path: 'gauss',
    component: GaussComponent,
  },
  {
    path: 'gauss-jordan',
    component: GaussJordanComponent,
  },
  {
    path: 'factorizacionLU',
    component: FactorizacionLuComponent,
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
