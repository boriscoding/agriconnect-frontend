import { Component, EventEmitter, Output, OnInit, AfterViewInit, ViewChild, ElementRef, NgZone, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Auth } from '../services/auth';
import { User } from '../services/user';
import { environment } from '../../environments/environment';
import { animate, stagger } from 'motion';

declare var google: any;

@Component({
  selector: 'app-formconnect',
  templateUrl: './formconnect.component.html',
  styleUrls: ['./formconnect.component.css']
})
export class FormconnectComponent implements OnInit, AfterViewInit {

  @ViewChild('card') cardRef!: ElementRef<HTMLElement>;
  @ViewChild('fields') fieldsRef!: ElementRef<HTMLElement>;

  loading: boolean = false;
  email: string = '';
  password: string = '';
  selectedCategorie: string = 'Producteur';
  Form: boolean = true;
  isClosing: boolean = false;
  passwordType: string = 'password';
  passwordIcon: string = 'fas fa-eye-slash';

  private apiUrl = environment.apiUrl;

  @Output() backToHome = new EventEmitter<void>();

  constructor(
    private router:      Router,
    private toastr:      ToastrService,
    private zone:        NgZone,
    private http:        HttpClient,
    private authService: Auth,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const googleBtnElement = document.getElementById('googleBtn');
        const googleLoaded = (window as any).google;
        if (googleLoaded && googleBtnElement) {
          googleLoaded.accounts.id.initialize({
            client_id: '850542951980-g48lmld243np7pg52s741r4dgiem1h2u.apps.googleusercontent.com',
            callback: (response: any) => this.handleGoogleLogin(response)
          });
          googleLoaded.accounts.id.renderButton(googleBtnElement,
            { theme: 'outline', size: 'large', shape: 'pill', width: '350' });
        }
      } catch (error) {
        console.error('Erreur Google Init:', error);
      }
    }
  }

  // ── L'unique moment d'animation : l'apparition de la carte de connexion ──
  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    animate(
      this.cardRef.nativeElement,
      { opacity: [0, 1], transform: ['translateY(16px) scale(0.98)', 'translateY(0px) scale(1)'] },
      { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
    );

    const fieldEls = this.fieldsRef.nativeElement.children;
    animate(
      Array.from(fieldEls) as HTMLElement[],
      { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0px)'] },
      { duration: 0.35, delay: stagger(0.06, { startDelay: 0.15 }) }
    );
  }

  viewpass(): void {
    if (this.passwordType === 'password') {
      this.passwordType = 'text';
      this.passwordIcon = 'fas fa-eye';
    } else {
      this.passwordType = 'password';
      this.passwordIcon = 'fas fa-eye-slash';
    }
  }

  onSubmit(): void {
    if (!this.selectedCategorie) {
      this.toastr.error('Veuillez choisir une catégorie.');
      return;
    }
    this.loading = true;

    const loginData = { email: this.email, password: this.password };
    let endpoint = '';
    let routeDestination = '';

    switch (this.selectedCategorie) {
      case 'Producteur':
        endpoint = `${this.apiUrl}/producteurs/login`;
        routeDestination = '/open';
        break;
      case 'Transporteur':
        endpoint = `${this.apiUrl}/transporteurs/login`;
        routeDestination = '/opentrans';
        break;
      case 'Acheteur':
        endpoint = `${this.apiUrl}/acheteurs/login`;
        routeDestination = '/openacheteur';
        break;
    }

    this.http.post(endpoint, loginData).subscribe({
      next: (user: any) => {
        this.loading = false;

        if (!user || (!user.id && !user.userId)) {
          this.toastr.error("Erreur : Données utilisateur incomplètes.");
          return;
        }

        const userId = user.id || user.userId;
        sessionStorage.setItem('userId', userId.toString());

        const userToSave: User = {
          id: userId,
          nom: user.nom,
          email: user.email,
          type: this.selectedCategorie
        };

        this.authService.saveUser(userToSave);
        this.toastr.success(`Bienvenue, ${user.nom || 'Acheteur'}`);

        this.isClosing = true;
        setTimeout(() => this.router.navigate([routeDestination]), 500);
      },
      error: (err) => {
        this.loading = false;
        console.error('Erreur Login:', err);
        this.toastr.error('Email ou mot de passe incorrect.');

        // Feedback visuel sur échec : léger "shake" de la carte
        if (isPlatformBrowser(this.platformId) && this.cardRef) {
          animate(
            this.cardRef.nativeElement,
            { transform: ['translateX(0)', 'translateX(-8px)', 'translateX(8px)', 'translateX(-6px)', 'translateX(0)'] },
            { duration: 0.35 }
          );
        }
      }
    });
  }

  handleGoogleLogin(response: any) {
    this.toastr.success('Connexion Google réussie !');
    this.zone.run(() => this.router.navigate(['/open']));
  }

  goToHome() { this.backToHome.emit(); }
}