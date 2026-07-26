import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { OffreService, OffreData } from '../services/offre';
import { Auth } from '../services/auth';
import { Demande } from '../services/demande';

@Component({
  selector: 'app-openachecteur',
  standalone: false,
  templateUrl: './openachecteur.html',
  styleUrls: ['./openachecteur.css']
})
export class Openachecteur implements OnInit {

  // ✅ CONFIGURATION SERVEUR
  private serverIp = 'localhost';
  serverI: string = 'localhost';

  // ✅ ÉTATS UI
  sidebarOpen = false;
  isModalOpen = false;       // Modale Profil
  isSubmitting = false;
  loading = false;
  pub = true;

  viewType: 'OFFRES' | 'MES_DEMANDES' = 'OFFRES';
  filterType: 'TOUS' | 'MES_OFFRES' = 'TOUS';

  // ✅ DONNÉES
  user: any = {};
  userIdConnecte: number | null = null;
  offres: OffreData[] = [];
  offresProducteurs: any[] = [];
  demandesAcheteur: any[] = [];

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
const storedId = localStorage.getItem('userId') 
              || sessionStorage.getItem('userId');    
                if (storedId) {
        this.userIdConnecte = +storedId.replace(/\D/g, '');
        this.loadUserProfile();
        this.chargerToutesLesOffres();
      } else {
        this.router.navigate(['/login']);
      }
    }
  }

  // ─── SECTION 1 : PROFIL UTILISATEUR ───────────────────────────────────────

  loadUserProfile(): void {
    if (!this.userIdConnecte) return;
    this.http.get(`http://${this.serverIp}:8080/api/utilisateurs/${this.userIdConnecte}`)
      .subscribe({
        next: (data: any) => this.user = data,
        error: (err: any) => console.error('Erreur profil', err)
      });
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

 saveUser(): void {
  if (!this.userIdConnecte) {
    this.toastr.error('Session expirée, veuillez vous reconnecter');
    return;
  }

  this.loading = true;
  const formData = new FormData();

  // On ajoute le fichier seulement s'il a été modifié
  if (this.selectedFile) {
    formData.append('file', this.selectedFile);
  }

  // On remplit le FormData
  formData.append('nom', this.user.nom || '');
  formData.append('email', this.user.email || '');
  formData.append('localisation', this.user.localisation || '');
  formData.append('sexe', this.user.sexe || '');
  
  // Correction ici : number peut être une chaîne, on s'assure qu'il n'est pas vide
  formData.append('number', (this.user.number || '').toString());

  // Appel API
  this.http.put(`http://${this.serverIp}:8080/acheteurs/modifier/${this.userIdConnecte}`, formData)
    .subscribe({
      next: (res: any) => {
        this.user = res; // Mise à jour de l'objet local avec les nouvelles données
        
        // Optionnel : Mettre à jour les infos dans le localStorage si tu y stockes le nom/photo
        // localStorage.setItem('userData', JSON.stringify(res));

        this.loading = false;
        this.toastr.success('Profil mis à jour avec succès !');
        this.closeModal(); // Ferme la modale
      },
      error: (err) => {
        this.loading = false;
        console.error("Erreur update profil:", err);
        this.toastr.error('Erreur lors de la modification');
      }
    });
}

  // ─── SECTION 2 : OFFRES ────────────────────────────────────────────────────

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

  // ─── SECTION 3 : MES DEMANDES ─────────────────────────────────────────────

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

  // ─── SECTION 4 : NAVIGATION ET FILTRES ────────────────────────────────────

  switchView(type: 'OFFRES' | 'MES_DEMANDES'): void {
    this.viewType = type;
    this.pub = (type === 'OFFRES');
    if (type === 'MES_DEMANDES' && this.demandesAcheteur.length === 0) {
      this.chargerMesDemandes();
    }
  }

  get offresFiltrees(): OffreData[] {
    if (this.filterType === 'MES_OFFRES') {
      // Un acheteur peut vouloir filtrer les offres par producteur favori — ici on renvoie tout
      return this.offres;
    }
    return this.offres;
  }

  getFiltreLength(): number {
    if (this.viewType === 'OFFRES') return this.offresFiltrees.length;
    if (this.viewType === 'MES_DEMANDES') return this.demandesAcheteur.length;
    return 0;
  }

  // ─── SECTION 5 : COMMANDE ─────────────────────────────────────────────────

  // Ouvre la modale app-commande pour l'offre choisie
  ouvrirCommande(offre: any): void {
    if (!this.userIdConnecte) {
      this.toastr.warning('Veuillez vous connecter pour passer commande');
      this.router.navigate(['/login']);
      return;
    }
    this.offreSelectionnee = offre;
  }

  // Ferme la modale app-commande
  fermerCommande(): void {
    this.offreSelectionnee = null;
    // Rafraîchit les demandes si la vue est active
    if (this.viewType === 'MES_DEMANDES') this.chargerMesDemandes();
  }

  // Ouvre le chat pour discuter avec le producteur
  initierDiscussion(destinataireId: number | undefined, titreProduit: string): void {
    if (!this.userIdConnecte) {
      this.toastr.warning('Veuillez vous connecter');
      this.router.navigate(['/login']);
      return;
    }
    if (destinataireId === this.userIdConnecte) {
      this.toastr.info("C'est votre propre publication !");
      return;
    }
    const message = `Bonjour, je suis intéressé par votre offre : "${titreProduit}". Est-elle toujours disponible ?`;
    this.router.navigate(['/chat'], { queryParams: { contactId: destinataireId, message } });
  }

  // Gestion d'une demande existante (annuler, voir détail…)
  ouvrirGerer(demande: any): void {
    console.log('Gérer la demande', demande);
    // TODO : ouvrir une modale de détail de la demande
  }

  // ─── SECTION 6 : UTILITAIRES ──────────────────────────────────────────────

  getDisplayPhoto(photoName: string | undefined, type: 'PRODUIT' | 'USER' = 'PRODUIT'): string {
    if (!photoName || photoName === 'null') {
      return type === 'USER'
        ? 'assets/images/default-user.png'
        : 'assets/images/default-produit.png';
    }
    return photoName.startsWith('http')
      ? photoName
      : `http://${this.serverIp}:8080/uploads/${photoName}`;
  }

  getPhotoUrl(photo: string | undefined): string {
    return this.getDisplayPhoto(photo, 'PRODUIT');
  }

  handleImageError(event: any): void {
    event.target.src = 'assets/images/lop.png';
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        if (this.isModalOpen) {
          this.user.photosuser = e.target.result;
        } else {
          this.imagePreview = e.target.result;
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // ─── SECTION 7 : UI HELPERS ───────────────────────────────────────────────

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
}