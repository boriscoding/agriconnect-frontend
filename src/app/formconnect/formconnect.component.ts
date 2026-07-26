import { Component, EventEmitter, Output, OnInit, NgZone, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Auth } from '../services/auth';
import { User } from '../services/user';

declare var google: any;

@Component({
  selector: 'app-formconnect',
  templateUrl: './formconnect.component.html',
  styleUrls: ['./formconnect.component.css']
})
export class FormconnectComponent implements OnInit {

  loading: boolean = false;
  email: string = '';
  password: string = '';
  selectedCategorie: string = 'Producteur';
  Form: boolean = true;
  isClosing: boolean = false;
  passwordType: string = 'password';
  passwordIcon: string = 'fas fa-eye-slash';

  private serverIp = 'localhost';

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
      endpoint = `http://${this.serverIp}:8080/producteurs/login`;
      routeDestination = '/open';
      break;
    case 'Transporteur':
      endpoint = `http://${this.serverIp}:8080/transporteurs/login`;
      routeDestination = '/opentrans';
      break;
    case 'Acheteur':
      endpoint = `http://${this.serverIp}:8080/acheteurs/login`;
      routeDestination = '/openacheteur';
      break;
  }

  this.http.post(endpoint, loginData).subscribe({
    next: (user: any) => {
      this.loading = false;
      
      // ✅ Sécurité : On vérifie que l'ID existe avant de continuer
      if (!user || (!user.id && !user.userId)) {
        this.toastr.error("Erreur : Données utilisateur incomplètes.");
        return;
      }

      const userId = user.id || user.userId;

      // ✅ Stockage explicite de l'ID pour que Openachecteur puisse le lire au ngOnInit
      localStorage.setItem('userId', userId.toString());

      const userToSave: User = {
        id: userId,
        nom: user.nom,
        email: user.email,
        type: this.selectedCategorie
      };

      this.authService.saveUser(userToSave);
      this.toastr.success(`Bienvenue, ${user.nom || 'Acheteur'}`);

      this.isClosing = true;
      // On laisse un petit délai pour l'animation et le stockage LocalStorage
      setTimeout(() => this.router.navigate([routeDestination]), 500);
    },
    error: (err) => {
      this.loading = false;
      console.error('Erreur Login:', err);
      this.toastr.error('Email ou mot de passe incorrect.');
    }
  });
}
  handleGoogleLogin(response: any) {
    this.toastr.success('Connexion Google réussie !');
    this.zone.run(() => this.router.navigate(['/open']));
  }

  goToHome() { this.backToHome.emit(); }
}