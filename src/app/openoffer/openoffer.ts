import { Component, OnInit, EventEmitter, Output, Input, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
// MODIFICATION : On importe OffreService et l'interface OffreData
import { OffreService, OffreData } from '../services/offre'; 
import { Auth } from '../services/auth';

@Component({
  selector: 'app-openoffer',
  standalone: false,
  templateUrl: './openoffer.html',
  styleUrl: './openoffer.css'
})
export class Openoffer implements OnInit {

  // --- ÉTATS UI ---
  sidebarOpen = false;
  isModalOpen = false;
  isOffreModalOpen = false;
  isSubmitting = false;
  loading = false;
  pub = true;
  filterType: 'TOUS' | 'MES_OFFRES' = 'TOUS';

  // --- DONNÉES UTILISATEUR ---
  user: any = {};
  userIdConnecte: number | null = null;

  // --- DONNÉES OFFRES ---
  // MODIFICATION : Utilisation du type OffreData pour garantir l'affichage des infos
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

  constructor(
    private router: Router, 
    private http: HttpClient,
    // MODIFICATION : Injection de OffreService au lieu de Offre
    private offreService: OffreService, 
    private authService: Auth,
    private toastr: ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

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

  loadUserProfile() {
    if (!this.userIdConnecte) return;
    this.http.get(`http://localhost:8080/api/utilisateurs/${this.userIdConnecte}`)
      .subscribe({
        next: (data: any) => this.user = data,
        error: (err: any) => console.error('Erreur profil', err)
      });
  }

  saveUser() {
    if (!this.userIdConnecte) return;
    this.loading = true;
    this.http.put(`http://localhost:8080/api/utilisateurs/modifier/${this.userIdConnecte}`, this.user)
      .subscribe({
        next: (res: any) => {
          this.user = res; 
          this.closeModal();
          this.loading = false;
          this.toastr.success("Profil mis à jour !");
        },
        error: (err: any) => {
          this.loading = false;
          this.toastr.error("Erreur de mise à jour");
        }
      });
  }

  // ==========================================
  // LOGIQUE OFFRES (PUBLICATION & FILTRES)
  // ==========================================
  chargerToutesLesOffres() {
    // MODIFICATION : Ajout du typage dans le next pour éviter le crash au refresh
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

  // --- FILTRES ---
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

  openEditModal() { this.isModalOpen = true; }
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

  getPhotoUrl(photo: string | undefined): string {
    if (!photo) {
      return 'assets/images/default-produit.png';
    }
    if (photo.startsWith('http')) {
      return photo;
    }
    return `http://localhost:8080/uploads/${photo}`;
  }

  //gestion des offres

  // --- ÉTATS POUR LES MODALES DE GESTION ---
showGererModal = false;
showModifierModal = false;
offreSelectionnee: any = null;

// Ouvrir la première modale (Gérer)
ouvrirGerer(offre: any) {
  // On crée une copie pour ne pas modifier l'original avant validation
  this.offreSelectionnee = { ...offre }; 
  this.showGererModal = true;
}

// Supprimer l'offre
confirmerSuppression() {
  if (this.offreSelectionnee && confirm('Voulez-vous vraiment supprimer cette offre ?')) {
    this.offreService.supprimerOffre(this.offreSelectionnee.id).subscribe({
      next: () => {
        // Mise à jour de la liste source
        this.offres = this.offres.filter(o => o.id !== this.offreSelectionnee.id);
        this.showGererModal = false;
        this.toastr.success('Offre supprimée avec succès');
      },
      error: (err) => this.toastr.error('Erreur lors de la suppression')
    });
  }
}

// Ouvrir la deuxième modale (Modifier)
ouvrirModifier() {
  this.showGererModal = false; // Ferme la première modale (Gérer)
  
  // MODIFICATION : On réinitialise l'aperçu avant d'ouvrir
  // pour voir la photo actuelle du produit.
  this.imagePreview = null; 

  // Petit délai pour laisser l'animation de slideUp se jouer
  setTimeout(() => this.showModifierModal = true, 150); 
}
// Valider les modifications vers le Backend
validerModification() {
  this.isSubmitting = true;
  this.offreService.modifierOffre(this.offreSelectionnee.id, this.offreSelectionnee).subscribe({
    next: (res) => {
      const index = this.offres.findIndex(o => o.id === res.id);
      if (index !== -1) this.offres[index] = res; // Mise à jour locale
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

}