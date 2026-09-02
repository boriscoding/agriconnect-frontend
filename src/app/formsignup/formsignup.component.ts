import { Component, EventEmitter, Output, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Auth } from '../services/auth';
import { User } from '../services/user';
import { environment } from '../../environments/environment'; // 👈 Import de l'environnement

@Component({
  selector: 'app-formsignup',
  templateUrl: './formsignup.component.html',
  styleUrls: ['./formsignup.component.css']
})
export class FormsignupComponent {

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

  private apiUrl = environment.apiUrl; // 👈 Utilisation de l'URL centralisée

  constructor(
    private router:      Router,
    private http:        HttpClient,
    private toastr:      ToastrService,
    private authService: Auth,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

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
        // ✅ Si l'endpoint check-email n'existe pas encore, on tente l'inscription directement
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
        // ✅ CORRECTION : l'endpoint Acheteur attend multipart/form-data
        endpoint         = `${this.apiUrl}/acheteurs/inscription`;
        routeDestination = '/openacheteur';
        break;
      default:
        endpoint         = `${this.apiUrl}/producteurs`;
        routeDestination = '/open';
    }

    // ✅ CORRECTION : on envoie avec FormData pour tous les types
    // car Spring attend multipart/form-data (consumes = {"multipart/form-data"})
    const formData = new FormData();
    formData.append('nom',          this.nom + ' ' + this.prenom);
    formData.append('email',        this.email);
    formData.append('password',     this.password);
    formData.append('localisation', 'Cameroun');
    formData.append('sexe',         'M');
    formData.append('number',       '0');

    // Champ spécifique à l'Acheteur
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

          // ✅ CORRECTION : on utilise le service Auth (écrit dans localStorage)
          // au lieu de sessionStorage — openacheteur.ts lit dans localStorage
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