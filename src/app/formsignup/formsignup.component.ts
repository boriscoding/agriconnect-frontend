import { Component, EventEmitter, Output } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http'; // Ajout de HttpHeaders

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
  // Crée cette variable en haut de ta classe
triedToSubmit = false;
  
  nom: string = '';
  prenom: string = '';
  email: string = ''; 
  password: string = '';
  selectedCategorie: string = 'Producteur'; 

  passwordType: string = 'password';
  passwordIcon: string = 'fas fa-eye';

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
this.triedToSubmit = true; // Ceci va activer le calcul du [ngClass] dans le HTML

  if (form.invalid) {
    // Les bordures vont devenir rouges ici
    alert("Veuillez remplir correctement tous les champs en rouge.");
    return;
  }

  // 1. D'abord, on vérifie si l'email existe déjà dans la base (Toutes tables confondues)
  this.http.get<boolean>(`http://localhost:8080/auth/check-email?email=${this.email}`).subscribe({
    next: (exists) => {
      if (exists) {
        // Si l'email existe, on arrête tout et on affiche une alerte
        alert("Cet email est déjà utilisé. Veuillez en choisir un autre ou vous inscrire.");
      } else {
        // 2. Si l'email est libre, on procède à l'inscription normalement
        this.executeRegistration();
      }
    },
    error: (err) => {
      console.error('Erreur lors de la vérification de l\'email :', err);
      alert("Impossible de vérifier l'email. Vérifiez que votre serveur backend est lancé.");
    }
  });
}

// J'ai extrait la logique de création dans une fonction séparée pour plus de clarté
executeRegistration(): void {
  // Préparation de l'objet JSON
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
      endpoint = 'http://localhost:8080/producteurs';
      routeDestination = '/open';
      break;
    case 'Transporteur':
      endpoint = 'http://localhost:8080/transporteurs';
      routeDestination = '/opentrans';
      break;
    case 'Acheteur':
      endpoint = 'http://localhost:8080/api/acheteurs';
      routeDestination = '/openacheteur';
      break;
    default:
      endpoint = 'http://localhost:8080/producteurs';
      routeDestination = '/open';
  }

  // Envoi de la requête POST pour l'inscription
  this.http.post(endpoint, userData, httpOptions).subscribe({
    next: (response: any) => {
      localStorage.setItem('userId', response.id); 
      localStorage.setItem('userEmail', response.email);
      localStorage.setItem('userFirstName', this.prenom);
      localStorage.setItem('userRole', this.selectedCategorie);

      console.log('Utilisateur créé avec succès, ID récupéré :', response.id);

      this.isClosing = true;
      setTimeout(() => {
        this.router.navigate([routeDestination]); 
      }, 300);
    },
    error: (err) => {
      console.error('Erreur d\'inscription :', err);
      alert('Erreur d\'inscription : ' + (err.error?.message || 'Serveur hors ligne'));
    }
  });
}
}