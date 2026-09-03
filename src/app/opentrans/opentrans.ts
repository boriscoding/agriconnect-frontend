import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Vehicule } from '../services/vehicule';
import { Auth } from '../services/auth';
import { OffreService, OffreData } from '../services/offre';
import { environment } from '../../environments/environment';
@Component({
  selector: 'app-opentrans',
  standalone: false,
  templateUrl: './opentrans.html',
  styleUrl: './opentrans.css',
})

export class Opentrans implements OnInit {

  // États UI
  sidebarOpen = false;
  isModalOpen = false;         // Modale Profil
  isOffreModalOpen = false;   // Modale Ajout Véhicule
  showGererModal = false;     // Modale Actions (Supprimer/Modifier)
  showModifierModal = false;  // Modale Formulaire Modification
  isSubmitting = false;
  loading = false;
  pub = true;                 // Contrôle l'affichage du bouton "Publier"
  
  viewType: 'OFFRES' | 'VEHICULES' | 'DEMANDES' = 'VEHICULES';
  filterType: 'TOUS' | 'MES_OFFRES' = 'TOUS';

  // Recherche (barre du header)
  searchTerm: string = '';
  
  // Données
  user: any = {};
  userIdConnecte: number | null = null;
  vehicules: any[] = []; 
  offresProducteurs: any[] = [];
  demandesAcheteurs: any[] = [];
  
  // Sélection et Images
  vehiculeSelectionne: any = null;
  selectedFile: File | null = null;
  imagePreview: string | ArrayBuffer | null = null;

  // Modèle de donnée pour nouveau véhicule
  newOffre: any = {
    marque: '',
    model: '',
    immatriculation: '',
    voitureType: 'CAMION', // Sera envoyé comme voiture_type
    description: '',
    chargeMax: null        // Sera envoyé comme charge_max
  };

  constructor(
    private router: Router, 
    private http: HttpClient,
    private vehiculeService: Vehicule,
    private offreService: OffreService,
    private authService: Auth,
    private toastr: ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const storedId = this.authService.getUserId()?.toString() || localStorage.getItem('userId');
      if (storedId) {
        this.userIdConnecte = +storedId.replace(/\D/g, '');
        this.loadUserProfile();
        this.chargerInitialData();
      } else {
        this.router.navigate(['/login']);
      }
    }
  }

  // --- SECTION 1 : GESTION DU PROFIL ---

  loadUserProfile() {
    if (!this.userIdConnecte) return;
    // 👈 URL dynamique basée sur l'environnement
    this.http.get(`${environment.apiUrl}/api/utilisateurs/${this.userIdConnecte}`)
      .subscribe({
        next: (data: any) => this.user = data,
        error: () => this.toastr.error("Erreur de chargement du profil")
      });
  }

  saveUser() {
    if (!this.userIdConnecte) {
      this.toastr.error("Transporteur non identifié");
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
    formData.append('number', (this.user.number || 0).toString());
    formData.append('typeVehicule', this.user.typeVehicule || '');
    formData.append('capaciteMax', (this.user.capaciteMax || 0).toString());

    // TransporteurController est mappé sans /api : environment.apiUrl est déjà la racine
    const url = `${environment.apiUrl}/transporteurs/modifier/${this.userIdConnecte}`;

    this.http.put(url, formData).subscribe({
      next: (res: any) => {
        this.user = res;
        this.loading = false;
        this.toastr.success("Profil transporteur mis à jour !");
        this.closeModal();
      },
      error: (err) => {
        this.loading = false;
        console.error("Erreur :", err);
        this.toastr.error("Erreur lors de la mise à jour du transporteur");
      }
    });
  }

  // --- SECTION 2 : CRUD VÉHICULES ---

  chargerInitialData() {
    this.chargerTousLesVehicules();
  }

  onPhotoSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  chargerTousLesVehicules() {
    this.loading = true;
    this.vehiculeService.getToutes().subscribe({
      next: (data) => { 
        this.vehicules = data; 
        this.loading = false; 
      },
      error: (err) => { 
        console.error("Erreur 404 ou Serveur:", err);
        this.loading = false; 
        this.toastr.error("Impossible de charger les véhicules");
      }
    });
  }

  saveOffre() {
    if (!this.userIdConnecte) {
      this.toastr.warning("Session expirée, veuillez vous reconnecter");
      return;
    }

    this.isSubmitting = true;
    const formData = new FormData();

    if (this.selectedFile) {
      formData.append('file', this.selectedFile);
    }

    formData.append('marque', this.newOffre.marque || '');
    formData.append('model', this.newOffre.model || '');
    formData.append('immatriculation', this.newOffre.immatriculation || '');
    formData.append('voitureType', this.newOffre.voitureType || 'CAMION');
    formData.append('description', this.newOffre.description || '');
    
    const charge = this.newOffre.chargeMax ? this.newOffre.chargeMax.toString() : '0';
    formData.append('chargeMax', charge);
    formData.append('transporteurId', this.userIdConnecte.toString());

    this.vehiculeService.publier(formData).subscribe({
      next: (res) => {
        this.vehicules.unshift(res);
        this.toastr.success("Véhicule ajouté avec succès !");
        this.closeOffreModal();
        this.isSubmitting = false;
        this.resetForm();
      },
      error: (err) => {
        console.error("Détails de l'erreur 400 :", err);
        this.isSubmitting = false;
        this.toastr.error("Erreur de validation des données (400)");
      }
    });
  }

  handleImageError(event: any) {
    event.target.src = 'assets/images/default-truck.png'; 
  }

  get offresFiltrees() {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.offresProducteurs;
    return this.offresProducteurs.filter((o: any) =>
      (o.nproduit || o.nomProduit || '').toLowerCase().includes(q) ||
      (o.lieuProduction || '').toLowerCase().includes(q)
    );
  }

  get demandesFiltrees() {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.demandesAcheteurs;
    return this.demandesAcheteurs.filter((d: any) =>
      (d.nomProduit || '').toLowerCase().includes(q)
    );
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  validerModification() {
    this.isSubmitting = true;
    this.vehiculeService.modifier(this.vehiculeSelectionne.id, this.vehiculeSelectionne).subscribe({
      next: (res) => {
        const index = this.vehicules.findIndex(v => v.id === res.id);
        if (index !== -1) this.vehicules[index] = res;
        this.toastr.success("Modifications enregistrées");
        this.showModifierModal = false;
        this.isSubmitting = false;
      },
      error: () => { this.isSubmitting = false; this.toastr.error("Erreur modification"); }
    });
  }

  confirmerSuppression() {
    if (!this.vehiculeSelectionne) return;
    if (confirm("Supprimer ce véhicule définitivement ?")) {
      this.vehiculeService.supprimer(this.vehiculeSelectionne.id).subscribe({
        next: () => {
          this.vehicules = this.vehicules.filter(v => v.id !== this.vehiculeSelectionne.id);
          this.toastr.success("Véhicule retiré");
          this.showGererModal = false;
        },
        error: () => this.toastr.error("Erreur suppression")
      });
    }
  }

  // --- SECTION 3 : NAVIGATION ET VUES ---

  switchView(type: 'OFFRES' | 'VEHICULES' | 'DEMANDES') {
    this.viewType = type;
    this.pub = (type === 'VEHICULES'); 
    
    if (type === 'OFFRES' && this.offresProducteurs.length === 0) {
      this.chargerOffres();
    }
    if (type === 'DEMANDES' && this.demandesAcheteurs.length === 0) {
      this.chargerDemandes();
    }
  }

  chargerOffres() {
    this.loading = true;
    this.offreService.getAllOffres().subscribe({
      next: (data: OffreData[]) => {
        this.offresProducteurs = data;
        this.loading = false;
      },
      error: (err) => {
        console.error("Erreur chargement offres agricoles:", err);
        this.toastr.error("Impossible de charger les produits agricoles");
        this.loading = false;
      }
    });
  }

  chargerDemandes() {
    // 👈 DemandesAcheteurController est mappé sur /api/demandes
    this.http.get(`${environment.apiUrl}/api/demandes/toutes`).subscribe({
      next: (data: any) => this.demandesAcheteurs = data,
      error: () => this.toastr.error("Erreur chargement des demandes")
    });
  }

  get vehiculesFiltres() {
    let liste = this.filterType === 'MES_OFFRES' 
      ? this.vehicules.filter(v => v.proprietaire?.id === this.userIdConnecte)
      : this.vehicules;

    const q = this.searchTerm.trim().toLowerCase();
    if (q) {
      liste = liste.filter(v =>
        (v.marque || '').toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q) ||
        (v.immatriculation || '').toLowerCase().includes(q)
      );
    }
    return liste;
  }

  getFiltreLength(): number {
    if (this.viewType === 'VEHICULES') return this.vehiculesFiltres.length;
    if (this.viewType === 'OFFRES') return this.offresFiltrees.length;
    return this.demandesFiltrees.length;
  }

  // --- SECTION 4 : UTILITAIRES ET UI ---

  onFileSelected(event: any) {
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

  getDisplayPhoto(photo: string | undefined, type: 'PRODUIT' | 'VEHICULE' = 'PRODUIT'): string {
    if (!photo || photo === 'null') {
      return type === 'VEHICULE' ? 'assets/images/default-truck.png' : 'assets/images/default-produit.png';
    }
    
    if (photo.startsWith('http')) return photo;

    // 👈 Construction dynamique de l'URL des uploads (pas de /api pour les fichiers statiques)
    return `${environment.apiUrl}/uploads/${photo}`;
  }

  resetForm() {
    this.newOffre = { marque: '', model: '', immatriculation: '', voitureType: 'CAMION', description: '', chargeMax: null };
    this.imagePreview = null;
    this.selectedFile = null;
  }

  ouvrirGerer(v: any) { 
    this.vehiculeSelectionne = { ...v }; 
    this.showGererModal = true; 
  }
  
  ouvrirModifier() { 
    this.showGererModal = false; 
    setTimeout(() => this.showModifierModal = true, 100); 
  }

  openEditModal() { this.isModalOpen = true; }
  closeModal() { this.isModalOpen = false; }
  openOffreModal() { this.isOffreModalOpen = true; }
  closeOffreModal() { this.isOffreModalOpen = false; this.resetForm(); }
  toggleSidebar() { this.sidebarOpen = !this.sidebarOpen; }
  mesoffres() { this.filterType = 'MES_OFFRES'; }
  toussoffres() { this.filterType = 'TOUS'; }
  
  logout() { 
    this.authService.logout(); 
    this.router.navigate(['/login']); 
  }

  navigateTo(path: string) { 
    this.router.navigate([path]); 
  }

  initierCommande(destinataireId: number | undefined, titreProduit: string) {
    if (!this.userIdConnecte) {
      this.toastr.warning("Veuillez vous connecter pour passer commande");
      this.router.navigate(['/login']);
      return;
    }

    if (destinataireId === this.userIdConnecte) {
      this.toastr.info("C'est votre propre publication !");
      return;
    }

    const messageAuto = `Bonjour, je suis intéressé par votre offre : "${titreProduit}". Est-elle toujours disponible ?`;

    this.router.navigate(['/chat'], { 
      queryParams: { 
        contactId: destinataireId,
        message: messageAuto 
      } 
    });
  }
  getUserPhotoUrl(photo: string | undefined): string {
    if (!photo || photo === 'null') {
      return 'assets/default-avatar.png';
    }
    if (photo.startsWith('http')) return photo;
    return `${environment.apiUrl}${photo}`;
  }
}