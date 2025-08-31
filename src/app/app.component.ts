import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { initFlowbite } from 'flowbite';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'metodoNumericoApp';

  constructor(
    private router: Router,
    private zone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private reinitFlowbite() {
    if (isPlatformBrowser(this.platformId)) {
      this.zone.onStable.subscribe(() => {
        setTimeout(() => initFlowbite(), 0);
      });
    }
  }

  ngOnInit(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.reinitFlowbite());
  }

  ngAfterViewInit(): void {
    this.reinitFlowbite();
  }
}
