import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { OffreService, OffreData } from '../services/offre';
import { Auth } from '../services/auth';
import { Demande } from '../services/demande';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppCommande } from '../app-commande/app-commande';
import { Sidebar } from '../core/sidebar/sidebar/sidebar';
import { BottomNav } from '../bottom-nav/bottom-nav';
import { environment } from '../../environments/environment'; // 👈 Import de l'environnement

@Component({
  selector: 'app-openachecteur',
  standalone: true,
  imports: [
      CommonModule,
      FormsModule,
      AppCommande,
      Sidebar,
      BottomNav
    ],
  templateUrl: './openachecteur.html',
  styleUrls: ['./openachecteur.css']
})
export class Openachecteur implements OnInit {

  // ✅ CONFIGURATION SERVEUR (conservé pour compatibilité)
  serverIp: string = 'localhost';

  // ✅ ÉTATS UI
  sidebarOpen = false;
  isModalOpen = false;        // Modale Profil
  isSubmitting = false;
  loading = false;
  pub = true;

  // Gestion des 3 vues de l'interface (Producteur, Transporteur, Acheteur)
  viewType: 'OFFRES' | 'VEHICULES' | 'DEMANDES' = 'OFFRES';
  filterType: 'TOUS' | 'MES_OFFRES' = 'TOUS';

  // ✅ Recherche (barre du header + sidebar)
  searchTerm: string = '';

  // ✅ DONNÉES
  user: any = {};
  userIdConnecte: number | null = null;
  offres: OffreData[] = [];
  offresProducteurs: any[] = [];
  demandesAcheteur: any[] = [];
  vehicules: any[] = []; // Données pour les transporteurs

  // ✅ SÉLECTION ET IMAGES
  selectedFile: File | null = null;
  imagePreview: string | ArrayBuffer | null = null;
  offreSelectionnee: any = null;   // Offre ouverte dans app-commande

  constructor(
    private router: Router,
    private http: HttpClient,
    private offreService: OffreService,
    private authService: Auth,
    private demandeService: Demande,
    private toastr: ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // ─── INIT ──────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.serverIp = window.location.hostname;

      const storedId = localStorage.getItem('userId') || sessionStorage.getItem('userId');    
      if (storedId) {
        this.userIdConnecte = +storedId.replace(/\D/g, '');
        this.loadUserProfile();
        this.chargerToutesLesOffres();
        this.chargerVehicules();
      } else {
        this.router.navigate(['/login']);
      }
    }
  }

  // ─── SECTION 1 : PROFIL UTILISATEUR ───────────────────────────────────────

  loadUserProfile(): void {
    if (!this.userIdConnecte) return;
    this.http.get(`${environment.apiUrl}/utilisateurs/${this.userIdConnecte}`)
      .subscribe({
        next: (data: any) => this.user = data,
        error: (err: any) => console.error('Erreur profil', err)
      });
  }

  saveUser(): void {
    if (!this.userIdConnecte) {
      this.toastr.error('Session expirée, veuillez vous reconnecter');
      return;
    }

    this.loading = true;
    const formData = new FormData();

    if (this.selectedFile) {
      formData.append('file', this.selectedFile);
    }

    formData.append('nom', this.user.nom || '');
    formData.append('email', this.user.email || '');
    formData.append('localisation', this.user.localisation || '');
    formData.append('sexe', this.user.sexe || '');
    formData.append('number', (this.user.number || '').toString());

    // ✅ Corrigé avec environment.apiUrl
    this.http.put(`${environment.apiUrl}/acheteurs/modifier/${this.userIdConnecte}`, formData)
      .subscribe({
        next: (res: any) => {
          this.user = res;
          this.loading = false;
          this.toastr.success('Profil mis à jour avec succès !');
          this.closeModal();
        },
        error: (err) => {
          this.loading = false;
          console.error("Erreur update profil:", err);
          this.toastr.error('Erreur lors de la modification');
        }
      });
  }

  // ─── SECTION 2 : CHARGEMENT DES DONNÉES ────────────────────────────────────

  chargerToutesLesOffres(): void {
    this.loading = true;
    this.offreService.getAllOffres().subscribe({
      next: (data: OffreData[]) => {
        this.offres = data;
        this.offresProducteurs = data;
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Erreur chargement offres');
        this.loading = false;
      }
    });
  }

  chargerOffres(): void {
    this.chargerToutesLesOffres();
  }

  chargerVehicules(): void {
    this.http.get<any[]>(`${environment.apiUrl}/vehicules`).subscribe({
      next: (data) => {
        this.vehicules = data;
      },
      error: () => {
        console.warn('Impossible de charger la flotte de véhicules pour le moment.');
      }
    });
  }

  chargerMesDemandes(): void {
    if (!this.userIdConnecte) return;
    this.loading = true;
    this.demandeService.getMesDemandes(this.userIdConnecte).subscribe({
      next: (data: any[]) => {
        this.demandesAcheteur = data;
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Erreur chargement de vos demandes');
        this.loading = false;
      }
    });
  }

  // ─── SECTION 3 : NAVIGATION ET FILTRES ────────────────────────────────────

  switchView(type: 'OFFRES' | 'VEHICULES' | 'DEMANDES'): void {
    this.viewType = type;
    this.pub = (type === 'OFFRES');
    if (type === 'DEMANDES' && this.demandesAcheteur.length === 0) {
      this.chargerMesDemandes();
    }
    if (type === 'VEHICULES' && this.vehicules.length === 0) {
      this.chargerVehicules();
    }
  }

  get offresFiltrees(): OffreData[] {
    let liste = this.offres;
    const q = this.searchTerm.trim().toLowerCase();
    if (q) {
      liste = liste.filter((o: any) =>
        (o.nproduit || o.nomProduit || '').toLowerCase().includes(q) ||
        (o.description || '').toLowerCase().includes(q) ||
        (o.lieuProduction || '').toLowerCase().includes(q)
      );
    }
    return liste;
  }

  get vehiculesFiltres(): any[] {
    let liste = this.vehicules;
    const q = this.searchTerm.trim().toLowerCase();
    if (q) {
      liste = liste.filter((v: any) =>
        (v.marque || '').toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q) ||
        (v.immatriculation || '').toLowerCase().includes(q) ||
        (v.voitureType || v.typeVehicule || '').toLowerCase().includes(q)
      );
    }
    return liste;
  }

  get demandesFiltrees(): any[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.demandesAcheteur;
    return this.demandesAcheteur.filter((d: any) =>
      (d.nomProduit || '').toLowerCase().includes(q)
    );
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  getFiltreLength(): number {
    if (this.viewType === 'OFFRES') return this.offresFiltrees.length;
    if (this.viewType === 'VEHICULES') return this.vehiculesFiltres.length;
    if (this.viewType === 'DEMANDES') return this.demandesFiltrees.length;
    return 0;
  }

  // ─── SECTION 4 : COMMANDE & INTERACTIONS ──────────────────────────────────

  ouvrirCommande(offre: any): void {
    if (!this.userIdConnecte) {
      this.toastr.warning('Veuillez vous connecter pour passer commande');
      this.router.navigate(['/login']);
      return;
    }
    this.offreSelectionnee = offre;
  }

  fermerCommande(): void {
    this.offreSelectionnee = null;
    if (this.viewType === 'DEMANDES') this.chargerMesDemandes();
  }

  ouvrirGerer(item: any): void {
    console.log('Gérer l’élément', item);
  }

  // ─── SECTION 5 : UTILITAIRES IMAGES ────────────────────────────────────────

  getDisplayPhoto(photoName: string | undefined, type: 'PRODUIT' | 'USER' = 'PRODUIT'): string {
    if (!photoName || photoName === 'null') {
      return type === 'USER'
        ? 'assets/images/default-user.png'
        : 'assets/images/default-produit.png';
    }
    const baseUrl = environment.apiUrl.replace(/\/api\/?$/, '');
    return photoName.startsWith('http')
      ? photoName
      : `${baseUrl}/uploads/${photoName}`;
  }

  getPhotoUrl(photo: string | undefined): string {
    return this.getDisplayPhoto(photo, 'PRODUIT');
  }

  getVehiculePhoto(photo: string | undefined): string {
    return this.getDisplayPhoto(photo, 'PRODUIT');
  }

  handleImageError(event: any): void {
    event.target.src = 'assets/images/lop.png';
  }

  onPhotoSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => this.imagePreview = reader.result as string;
      reader.readAsDataURL(file);
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // ─── SECTION 6 : UI HELPERS ───────────────────────────────────────────────

  toussoffres(): void { this.pub = true; this.filterType = 'TOUS'; }
  mesoffres(): void   { this.pub = false; this.filterType = 'MES_OFFRES'; }

  openEditModal(): void  { this.isModalOpen = true; }
  closeModal(): void     { this.isModalOpen = false; }
  toggleSidebar(): void  { this.sidebarOpen = !this.sidebarOpen; }
  navigateTo(path: string): void { this.router.navigate([path]); }
  
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  initierDiscussion(producteurId: any, email?: string): void {
    this.router.navigate(['/chat'], { 
      queryParams: { id: producteurId, email: email } 
    });
  }
}