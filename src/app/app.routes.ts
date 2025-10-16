import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { Sesion1Component } from './unidad 1/sesion1/sesion1.component';
import { TheoryErrorComponent } from './unidad 1/sesion1/theory-error/theory-error.component';
import { PuntoFlotanteComponent } from './unidad 1/sesion1/punto-flotante/punto-flotante.component';
import { Sesion2Component } from './unidad 1/sesion2/sesion2.component';
import { BiseccionComponent } from './unidad 1/sesion2/biseccion/biseccion.component';
import { FalsaPosicionComponent } from './unidad 1/sesion2/falsa-posicion/falsa-posicion.component';
import { Sesion3Component } from './unidad 1/sesion3/sesion3.component';
import { PuntoFijoComponent } from './unidad 1/sesion3/punto-fijo/punto-fijo.component';
import { NewtonComponent } from './unidad 1/sesion3/newton/newton.component';
import { SecanteComponent } from './unidad 1/sesion3/secante/secante.component';
import { Sesion1U2Component } from './unidad 2/sesion1-u2/sesion1-u2.component';
import { GaussComponent } from './unidad 2/sesion1-u2/gauss/gauss.component';
import { GaussJordanComponent } from './unidad 2/sesion1-u2/gauss-jordan/gauss-jordan.component';
import { FactorizacionLuComponent } from './unidad 2/sesion1-u2/factorizacion-lu/factorizacion-lu.component';
import { Sesion2U2Component } from './unidad 2/sesion2-u2/sesion2-u2.component';
import { CholeskiComponent } from './unidad 2/sesion2-u2/choleski/choleski.component';
import { JacobiComponent } from './unidad 2/sesion2-u2/jacobi/jacobi.component';
import { GaussSeidelComponent } from './unidad 2/sesion2-u2/gauss-seidel/gauss-seidel.component';
import { Sesion3U2Component } from './unidad 2/sesion3-u2/sesion3-u2.component';
import { NewtonnComponent } from './unidad 2/sesion3-u2/newtonn/newtonn.component';
import { GradienteComponent } from './unidad 2/sesion3-u2/gradiente/gradiente.component';
import { SimplexComponent } from './unidad 2/sesion3-u2/simplex/simplex.component';
import { Sesion4U2Component } from './unidad 2/sesion4-u2/sesion4-u2.component';
import { MinCuadradosComponent } from './unidad 2/sesion4-u2/min-cuadrados/min-cuadrados.component';
import { Sesion5U2Component } from './unidad 2/sesion5-u2/sesion5-u2.component';
import { LagrangeComponent } from './unidad 2/sesion5-u2/lagrange/lagrange.component';
import { DfdnewtonComponent } from './unidad 2/sesion5-u2/dfdnewton/dfdnewton.component';

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
    path: 'sesion6',
    component: Sesion2U2Component,
  },
  {
    path: 'choleski',
    component: CholeskiComponent,
  },
  {
    path: 'jacobi',
    component: JacobiComponent,
  },
  {
    path: 'gauss-seidel',
    component: GaussSeidelComponent,
  },
  {
    path: 'sesion7',
    component: Sesion3U2Component,
  },
  {
    path: 'newtonn',
    component: NewtonnComponent,
  },
  {
    path: 'gradiente',
    component: GradienteComponent,
  },
  {
    path: 'simplex',
    component: SimplexComponent,
  },
  {
    path: 'sesion8',
    component: Sesion4U2Component,
  },
  {
    path: 'cuadrados',
    component: MinCuadradosComponent,
  },
  {
    path: 'sesion9',
    component: Sesion5U2Component,
  },
  {
    path: 'lagrange',
    component: LagrangeComponent,
  },
  {
    path: 'dfdnewton',
    component: DfdnewtonComponent,
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
