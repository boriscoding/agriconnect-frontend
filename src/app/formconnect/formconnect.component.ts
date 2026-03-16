import { Component, EventEmitter, Output, OnInit, NgZone, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common'; // Requis pour éviter les crashs
import { ToastrService } from 'ngx-toastr';
import { Auth } from '../services/auth'; // Ton service sécurisé
import { User } from '../services/user'; // Ton interface

declare var google: any;

@Component({
  selector: 'app-formconnect',
  templateUrl: './formconnect.component.html',
  styleUrls: ['./formconnect.component.css']
})
export class FormconnectComponent implements OnInit {
  // --- 1. VARIABLES ---
  email: string = '';
  private serverIp = 'localhost';
  password: string = '';
  selectedCategorie: string = 'Producteur'; 

  Form: boolean = true;
  isClosing: boolean = false;
  
  passwordType: string = 'password';
  passwordIcon: string = 'fas fa-eye-slash';

  @Output() backToHome = new EventEmitter<void>();

  constructor(
    private router: Router, 
    private toastr: ToastrService,
    private zone: NgZone,
    private http: HttpClient,
    private authService: Auth, // Injection du service sécurisé
    @Inject(PLATFORM_ID) private platformId: Object // Injection de l'ID plateforme
  ) {}

  ngOnInit() {
    // On n'initialise Google que si on est sur le navigateur
    if (isPlatformBrowser(this.platformId)) {
      try {
        const googleBtnElement = document.getElementById("googleBtn");
        const googleLoaded = (window as any).google;

        if (googleLoaded && googleBtnElement) {
          googleLoaded.accounts.id.initialize({
            client_id: "850542951980-g48lmld243np7pg52s741r4dgiem1h2u.apps.googleusercontent.com",
            callback: (response: any) => this.handleGoogleLogin(response)
          });

          googleLoaded.accounts.id.renderButton(
            googleBtnElement,
            { theme: "outline", size: "large", shape: "pill", width: "350" }
          );
        }
      } catch (error) {
        console.error("Erreur Google Init:", error);
      }
    }
  }

  // --- 2. GESTION DU MOT DE PASSE ---
  viewpass(): void {
    if (this.passwordType === 'password') {
      this.passwordType = 'text';
      this.passwordIcon = 'fas fa-eye';
    } else {
      this.passwordType = 'password';
      this.passwordIcon = 'fas fa-eye-slash';
    }
  }

  // --- 3. LOGIQUE DE CONNEXION AU BACKEND ---
  onSubmit(): void {
    if (!this.selectedCategorie) {
      this.toastr.error("Veuillez choisir une catégorie.");
      return;
    }

    const loginData = { email: this.email, password: this.password };
    let endpoint = '';
    let routeDestination = '';
switch (this.selectedCategorie) {
      case 'Producteur':
        // 2. Utilise bien les ` (Alt Gr + 7) pour que ${this.serverIp} fonctionne
        endpoint = `http://${this.serverIp}:8080/producteurs/login`;
        routeDestination = '/open';
        break;
      case 'Transporteur':
        endpoint = `http://${this.serverIp}:8080/transporteurs/login`;
        routeDestination = '/opentrans';
        break;
      case 'Acheteur':
        endpoint = `http://${this.serverIp}:8080/api/acheteurs/login`;
        routeDestination = '/openacheteur';
        break;
    }
    this.toastr.info(`Connexion en cours (${this.selectedCategorie})...`);

    this.http.post(endpoint, loginData).subscribe({
      next: (user: any) => {
        // ✅ ON UTILISE LE SERVICE AUTH AU LIEU DE LOCALSTORAGE DIRECT
        const userToSave: User = {
          id: user.id,
          nom: user.nom,
          email: user.email,
          type: this.selectedCategorie
        };
        
        this.authService.saveUser(userToSave);

        this.isClosing = true;
        setTimeout(() => {
          this.router.navigate([routeDestination]);
        }, 400);
      },
      error: (err) => {
        this.toastr.error(`Email ou mot de passe incorrect.`);
      }
    });
  }

  handleGoogleLogin(response: any) {
    this.toastr.success("Connexion Google réussie !");
    // Note: Ici tu devrais aussi appeler ton service pour sauvegarder l'ID Google si besoin
    this.zone.run(() => {
      this.router.navigate(['/open']);
    });
  }

  goToHome() {
    this.backToHome.emit();
  }
  // Dans ton service Auth (ou auth.ts)
saveUser(user: any) {
  // On utilise la clé 'user' (c'est celle que logi-chat cherche)
  localStorage.setItem('user', JSON.stringify(user));
}
}