import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { Sesion1Component } from './sesion1/sesion1.component';

export const routes: Routes = [
    {
        path:'',
        redirectTo:'home',
        pathMatch:'full'
    },
    {
        path:'home',
        component:HomeComponent
    },
    {
        path:'sesión1',
        component:Sesion1Component
    },
    {
        path:'**',
        redirectTo:'home',
    }
];
