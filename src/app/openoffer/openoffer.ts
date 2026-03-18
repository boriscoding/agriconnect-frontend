import { Component, OnInit, EventEmitter, Output, Input, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { OffreService, OffreData } from '../services/offre'; 
import { Auth } from '../services/auth';

@Component({
  selector: 'app-openoffer',
  standalone: false,
  templateUrl: './openoffer.html',
  styleUrl: './openoffer.css'
})
export class Openoffer implements OnInit {

  // ✅ ADRESSE IP RÉSEAU CENTRALISÉE
  private serverIp = 'localhost';
serverI: string = 'localhost';
  sidebarOpen = false;
  isModalOpen = false;
  isOffreModalOpen = false;
  isSubmitting = false;
  loading = false;
  pub = true;
  filterType: 'TOUS' | 'MES_OFFRES' = 'TOUS';
hasImageError: boolean = false;
  user: any = {};
  userIdConnecte: number | null = null;

  offres: OffreData[] = []; 
  selectedFile: File | null = null;
  imagePreview: string | ArrayBuffer | null = null; 

  newOffre: any = {
    titre: '',
    nproduit: '',
    type_pro: 'PRODUCTEUR_DIRECT', 
    description: '',
    prixUnitaire: null,
    quantiteProduit: null,
    uniteMesure: 'Kg',
    lieuProduction: '',
    region: 'Littoral',
    statut: 'DISPONIBLE'
  };

  // États pour les modales de gestion
  showGererModal = false;
  showModifierModal = false;
  offreSelectionnee: any = null;

  constructor(
    private router: Router, 
    private http: HttpClient,
    private offreService: OffreService, 
    private authService: Auth,
    private toastr: ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}
handleImageError(event: any) {
  // Cette fonction est appelée si l'URL de l'image renvoie une erreur
  this.hasImageError = true;
}
  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const storedId = this.authService.getUserId()?.toString() || localStorage.getItem('userId');
      
      if (storedId) {
        const cleanId = storedId.replace(/\D/g, ''); 
        this.userIdConnecte = +cleanId;
        
        this.loadUserProfile();
        this.chargerToutesLesOffres();
      } else {
        this.toastr.warning('Session expirée, veuillez vous reconnecter');
        this.router.navigate(['/login']);
      }
    }
  }

  // ✅ RECTIFICATION DE L'URL PROFIL
  loadUserProfile() {
    if (!this.userIdConnecte) return;
    this.http.get(`http://${this.serverIp}:8080/api/utilisateurs/${this.userIdConnecte}`)
      .subscribe({
        next: (data: any) => this.user = data,
        error: (err: any) => console.error('Erreur profil', err)
      });
  }

  // ✅ RECTIFICATION DE L'URL MODIFICATION PROFIL
// Variables à ajouter dans ta classe
// Cette méthode est appelée par (change)="onPhotoSelected($event)" dans ton HTML
onPhotoSelected(event: any) {
  const file = event.target.files[0];
  if (file) {
    this.selectedFile = file;

    // Créer un aperçu temporaire pour l'utilisateur dans la modale
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }
}

saveUser() {
  if (!this.userIdConnecte) return;
  this.loading = true;

  // Utilisation de FormData pour envoyer le MultipartFile au backend
  const formData = new FormData();
  
  if (this.selectedFile) {
    formData.append('file', this.selectedFile);
  }

  // Ajout des champs texte attendus par ton nouveau contrôleur
  formData.append('nom', this.user.nom || '');
  formData.append('localisation', this.user.localisation || '');
  formData.append('sexe', this.user.sexe || '');
  formData.append('number', this.user.number ? this.user.number.toString() : '0');

  this.http.put(`http://${this.serverIp}:8080/api/utilisateurs/modifier/${this.userIdConnecte}`, formData)
    .subscribe({
      next: (res: any) => {
        this.user = res; // Contient maintenant le chemin correct (ex: /uploads/photo.jpg)
        this.imagePreview = null;
        this.selectedFile = null;
        this.loading = false;
        this.toastr.success("Profil mis à jour !");
        this.closeModal();
      },
      error: (err) => {
        this.loading = false;
        console.error("Erreur lors de la modification :", err);
        this.toastr.error("Erreur SQL ou réseau");
      }
    });
}
  chargerToutesLesOffres() {
    this.offreService.getAllOffres().subscribe({
      next: (data: OffreData[]) => this.offres = data,
      error: (err: any) => console.error('Erreur chargement offres', err)
    });
  }

  saveOffre() {
    if (!this.userIdConnecte) return;
    if (!this.newOffre.nproduit || !this.newOffre.prixUnitaire) {
      this.toastr.warning('Veuillez remplir les champs obligatoires');
      return;
    }

    this.isSubmitting = true;
    const formData = new FormData();
    if (this.selectedFile) formData.append('file', this.selectedFile);

    formData.append('titre', this.newOffre.nproduit); 
    formData.append('nomProduit', this.newOffre.nproduit);
    formData.append('categorie', this.newOffre.type_pro);
    formData.append('description', this.newOffre.description || '');
    formData.append('prixUnitaire', this.newOffre.prixUnitaire.toString());
    formData.append('quantiteProduit', this.newOffre.quantiteProduit?.toString() || '0');
    formData.append('lieuProduction', this.newOffre.lieuProduction || '');
    formData.append('statut', this.newOffre.statut);
    formData.append('producteurId', this.userIdConnecte.toString());

    this.offreService.creerOffre(formData).subscribe({
      next: (res: OffreData) => {
        this.toastr.success('Votre offre est en ligne !');
        this.offres.unshift(res); 
        this.closeOffreModal();
        this.resetForm();
        this.isSubmitting = false;
      },
      error: (err: any) => {
        this.toastr.error('Erreur lors de la publication');
        this.isSubmitting = false;
      }
    });
  }

  // ✅ RECTIFICATION DE L'URL DES PHOTOS (Backend)
  getPhotoUrl(photo: string | undefined): string {
    if (!photo) {
      return 'assets/images/default-produit.png';
    }
    if (photo.startsWith('http')) {
      return photo;
    }
    // On utilise l'IP réseau pour charger les images sur le téléphone
    return `http://${this.serverIp}:8080/uploads/${photo}`;
  }

  // --- GESTION DES OFFRES ---

  ouvrirGerer(offre: any) {
    this.offreSelectionnee = { ...offre }; 
    this.showGererModal = true;
  }

  confirmerSuppression() {
    if (this.offreSelectionnee && confirm('Voulez-vous vraiment supprimer cette offre ?')) {
      this.offreService.supprimerOffre(this.offreSelectionnee.id).subscribe({
        next: () => {
          this.offres = this.offres.filter(o => o.id !== this.offreSelectionnee.id);
          this.showGererModal = false;
          this.toastr.success('Offre supprimée avec succès');
        },
        error: (err) => this.toastr.error('Erreur lors de la suppression')
      });
    }
  }

  ouvrirModifier() {
    this.showGererModal = false; 
    this.imagePreview = null; 
    setTimeout(() => this.showModifierModal = true, 150); 
  }

  validerModification() {
    this.isSubmitting = true;
    this.offreService.modifierOffre(this.offreSelectionnee.id, this.offreSelectionnee).subscribe({
      next: (res) => {
        const index = this.offres.findIndex(o => o.id === res.id);
        if (index !== -1) this.offres[index] = res;
        this.toastr.success('Modification enregistrée');
        this.showModifierModal = false;
        this.isSubmitting = false;
      },
      error: () => {
        this.toastr.error('Erreur de mise à jour');
        this.isSubmitting = false;
      }
    });
  }

  // --- FILTRES ET UTILITAIRES ---
  get offresFiltrees() {
    if (this.filterType === 'MES_OFFRES') {
      return this.offres.filter(o => o.producteur?.id === this.userIdConnecte);
    }
    return this.offres;
  }

  mesoffres() { this.pub = false; this.filterType = 'MES_OFFRES'; }
  toussoffres() { this.pub = true; this.filterType = 'TOUS'; }

  onFileSelected(event: any) {
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

  openEditModal() { this.isModalOpen = true;
    this.hasImageError = false; // On réinitialise pour la prochaine tentative
   }
  closeModal() { this.isModalOpen = false; }
  openOffreModal() { this.isOffreModalOpen = true; }
  closeOffreModal() { 
    this.isOffreModalOpen = false; 
    this.imagePreview = null;
    this.selectedFile = null;
  }
  toggleSidebar() { this.sidebarOpen = !this.sidebarOpen; }
  resetForm() {
    this.newOffre = {
      titre: '', nproduit: '', type_pro: 'PRODUCTEUR_DIRECT',
      description: '', prixUnitaire: null, quantiteProduit: null,
      uniteMesure: 'Kg', lieuProduction: '', region: 'Littoral',
      statut: 'DISPONIBLE'
    };
  }
  navigateTo(path: string) { this.router.navigate([path]); }
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  // --- ÉTATS D'AFFICHAGE ---
viewType: 'OFFRES' | 'VEHICULES' | 'DEMANDES' = 'OFFRES';

// --- DONNÉES ---
vehicules: any[] = [];
demandesAcheteurs: any[] = [];
// ✅ MÉTHODE DE NAVIGATION MISE À JOUR
  switchView(type: 'OFFRES' | 'VEHICULES' | 'DEMANDES') {
      this.viewType = type;
      this.pub = (type === 'OFFRES'); // Gère l'affichage du bouton "Publier"
      
      if (type === 'VEHICULES' && this.vehicules.length === 0) this.chargerVehicules();
      if (type === 'DEMANDES' && this.demandesAcheteurs.length === 0) this.chargerDemandes();
  }

  // ✅ AJOUT DE L'IP DANS LES REQUÊTES
 chargerVehicules() {
    this.loading = true;
    // Utilise ta variable serverIp définie plus haut dans ton fichier
    this.http.get(`http://${this.serverIp}:8080/api/vehicules`).subscribe({
        next: (data: any) => {
            this.vehicules = data;
            this.loading = false;
        },
        error: (err) => {
            console.error("Détail erreur 404 :", err);
            this.toastr.error("Le serveur ne répond pas sur /api/vehicules");
            this.loading = false;
        }
    });
}

  chargerDemandes() {
      this.loading = true;
      this.http.get(`http://${this.serverIp}:8080/api/demandes`).subscribe({
          next: (data: any) => {
              this.demandesAcheteurs = data;
              this.loading = false;
          },
          error: (err) => {
              this.toastr.error("Erreur chargement demandes");
              this.loading = false;
          }
      });
  }

  // ✅ UNIFORMISATION DE LA PHOTO POUR TOUT LE MONDE
  // Cette méthode servira pour les Offres, les Véhicules et le Profil
  getDisplayPhoto(photoName: string | undefined, type: 'PRODUIT' | 'VEHICULE' | 'USER' = 'PRODUIT'): string {
      if (!photoName) {
          return type === 'USER' ? 'assets/images/default-user.png' : 'assets/images/default-item.png';
      }
      return `http://${this.serverIp}:8080/uploads/${photoName}`;
  }
  getFiltreLength(): number {
  if (this.viewType === 'OFFRES') return this.offresFiltrees.length;
  if (this.viewType === 'VEHICULES') return this.vehicules.length;
  if (this.viewType === 'DEMANDES') return this.demandesAcheteurs.length;
  return 0;
}

}