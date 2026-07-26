import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-bottom-nav',
  standalone: false,
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css'
})
export class BottomNav implements OnInit, OnDestroy {

  // Nombre de messages non lus (badge sur Chat)
  unreadCount: number = 0;

  // Route active courante
  currentRoute: string = '';

  private routerSub!: Subscription;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Suivre la route active pour les animations
    this.currentRoute = this.router.url;

    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.urlAfterRedirects;
    });

    // Optionnel : charger le compteur de messages non lus
    // this.chargerMessagesNonLus();
  }

  ngOnDestroy(): void {
    if (this.routerSub) this.routerSub.unsubscribe();
  }

  isActive(route: string): boolean {
    return this.currentRoute.includes(route);
  }

  // À connecter à ton service MessageApi si besoin
  // chargerMessagesNonLus(): void {
  //   this.messageApi.getUnreadCount(userId).subscribe(count => {
  //     this.unreadCount = count;
  //   });
  // }
}
