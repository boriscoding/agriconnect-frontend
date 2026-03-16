import { Component, EventEmitter, Output, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-formsignup',
  templateUrl: './formsignup.component.html',
  styleUrls: ['./formsignup.component.css']
})
export class FormsignupComponent {
  
  @Output() requestLogin = new EventEmitter<void>();
  @Output() backToHome = new EventEmitter<void>();

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

  // ✅ TON ADRESSE IP RÉSEAU
  private serverIp = 'localhost';

  constructor(private router: Router, private http: HttpClient) {}

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
    setTimeout(() => { this.requestLogin.emit(); }, 300);
  }

  goToHome() { this.backToHome.emit(); }

  onSubmit(form: any): void {
    this.triedToSubmit = true;

    if (form.invalid) {
      alert("Veuillez remplir correctement tous les champs.");
      return;
    }

    // Vérification de l'email via l'IP
    this.http.get<boolean>(`http://${this.serverIp}:8080/auth/check-email?email=${this.email}`).subscribe({
      next: (exists) => {
        if (exists) {
          alert("Cet email est déjà utilisé.");
        } else {
          this.executeRegistration();
        }
      },
      error: (err) => {
        console.error('Erreur :', err);
        alert("Serveur injoignable à l'adresse " + this.serverIp);
      }
    });
  }

  executeRegistration(): void {
    const userData = {
      nom: this.nom + ' ' + this.prenom,
      email: this.email,
      password: this.password,
      localisation: "Cameroun",
      sexe: "M",
      number: 0,
      photosuser: "assets/images/default-avatar.png"
    };

    const httpOptions = {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    };

    let endpoint = '';
    let routeDestination = '';

    switch (this.selectedCategorie) {
      case 'Producteur':
        endpoint = `http://${this.serverIp}:8080/producteurs`;
        routeDestination = '/open';
        break;
      case 'Transporteur':
        endpoint = `http://${this.serverIp}:8080/transporteurs`;
        routeDestination = '/opentrans';
        break;
      case 'Acheteur':
        endpoint = `http://${this.serverIp}:8080/api/acheteurs`;
        routeDestination = '/openacheteur';
        break;
      default:
        endpoint = `http://${this.serverIp}:8080/producteurs`;
        routeDestination = '/open';
    }

    this.http.post(endpoint, userData, httpOptions).subscribe({
      next: (response: any) => {
        // ✅ STOCKAGE CRUCIAL POUR LA PAGE SUIVANTE
        // On crée un objet utilisateur complet pour que le service Auth soit content
        const userToSave = {
          id: response.id,
          nom: response.nom,
          email: response.email,
          type: this.selectedCategorie
        };

        // On stocke dans 'user' car c'est ce que cherche ton logi-chat.ts (this.authService.getUserId())
        localStorage.setItem('user', JSON.stringify(userToSave));
        
        // On garde tes anciens stockages au cas où d'autres composants en ont besoin
        localStorage.setItem('userId', response.id); 
        localStorage.setItem('userRole', this.selectedCategorie);

        console.log('Inscription réussie, ID stocké :', response.id);

        this.isClosing = true;
        setTimeout(() => {
          this.router.navigate([routeDestination]); 
        }, 300);
      },
      error: (err) => {
        alert('Erreur d\'inscription : ' + (err.error?.message || 'Serveur hors ligne'));
      }
    });
  }
}