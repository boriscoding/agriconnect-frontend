import { Component, EventEmitter, Output, AfterViewInit, ViewChild, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Auth } from '../services/auth';
import { User } from '../services/user';
import { environment } from '../../environments/environment';
import { animate, stagger } from 'motion';

@Component({
  selector: 'app-formsignup',
  templateUrl: './formsignup.component.html',
  styleUrls: ['./formsignup.component.css']
})
export class FormsignupComponent implements AfterViewInit {

  @ViewChild('card') cardRef!: ElementRef<HTMLElement>;
  @ViewChild('fields') fieldsRef!: ElementRef<HTMLElement>;

  @Output() requestLogin = new EventEmitter<void>();
  @Output() backToHome   = new EventEmitter<void>();

  loading: boolean = false;
  Form: boolean = true;
  isClosing: boolean = false;
  triedToSubmit = false;

  nom: string = '';
  prenom: string = '';
  email: string = '';
  password: string = '';
  selectedCategorie: string = 'Producteur';

  passwordType: string = 'password';
  passwordIcon: string = 'fas fa-eye';

  private apiUrl = environment.apiUrl;

  constructor(
    private router:      Router,
    private http:        HttpClient,
    private toastr:      ToastrService,
    private authService: Auth,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // ── L'unique moment d'animation : l'apparition de la carte d'inscription ──
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
      this.passwordIcon = 'fas fa-eye-slash';
    } else {
      this.passwordType = 'password';
      this.passwordIcon = 'fas fa-eye';
    }
  }

  goToLogin(): void {
    this.isClosing = true;
    setTimeout(() => this.requestLogin.emit(), 300);
  }

  goToHome() { this.backToHome.emit(); }

  onSubmit(form: any): void {
    this.triedToSubmit = true;
    if (form.invalid) {
      this.toastr.warning('Veuillez remplir correctement tous les champs.');

      // Feedback visuel qui répond directement à l'action de l'utilisateur
      if (isPlatformBrowser(this.platformId) && this.cardRef) {
        animate(
          this.cardRef.nativeElement,
          { transform: ['translateX(0)', 'translateX(-8px)', 'translateX(8px)', 'translateX(-6px)', 'translateX(0)'] },
          { duration: 0.35 }
        );
      }
      return;
    }
    this.loading = true;

    const checkUrl = `${this.apiUrl}/auth/check-email?email=${this.email}`;
    this.http.get<boolean>(checkUrl).subscribe({
      next: (exists) => {
        if (exists) {
          this.toastr.error('Cet email est déjà utilisé.');
          this.loading = false;
        } else {
          this.executeRegistration();
        }
      },
      error: () => {
        this.executeRegistration();
      }
    });
  }

  executeRegistration(): void {
    let endpoint        = '';
    let routeDestination = '';

    switch (this.selectedCategorie) {
      case 'Producteur':
        endpoint         = `${this.apiUrl}/producteurs`;
        routeDestination = '/open';
        break;
      case 'Transporteur':
        endpoint         = `${this.apiUrl}/transporteurs`;
        routeDestination = '/opentrans';
        break;
      case 'Acheteur':
        endpoint         = `${this.apiUrl}/acheteurs/inscription`;
        routeDestination = '/openacheteur';
        break;
      default:
        endpoint         = `${this.apiUrl}/producteurs`;
        routeDestination = '/open';
    }

    const formData = new FormData();
    formData.append('nom',          this.nom + ' ' + this.prenom);
    formData.append('email',        this.email);
    formData.append('password',     this.password);
    formData.append('localisation', 'Cameroun');
    formData.append('sexe',         'M');
    formData.append('number',       '0');

    if (this.selectedCategorie === 'Acheteur') {
      formData.append('adresseLivraison', '');
    }

    this.http.post(endpoint, formData).subscribe({
      next: (response: any) => {
        if (isPlatformBrowser(this.platformId)) {
          const userToSave: User = {
            id:    response.id,
            nom:   response.nom || (this.nom + ' ' + this.prenom),
            email: response.email || this.email,
            type:  this.selectedCategorie
          };
          this.authService.saveUser(userToSave);
        }

        this.toastr.success('Inscription réussie !');
        this.isClosing = true;
        setTimeout(() => {
          this.loading = false;
          this.router.navigate([routeDestination]);
        }, 500);
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error('Erreur d\'inscription : ' + (err.error?.message || 'Serveur hors ligne'));
      }
    });
  }
}