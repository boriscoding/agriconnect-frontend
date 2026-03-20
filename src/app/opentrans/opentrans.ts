import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Vehicule } from '../services/vehicule';
import { Auth } from '../services/auth';

@Component({
  selector: 'app-opentrans',
  standalone: false,
  templateUrl: './opentrans.html',
  styleUrl: './opentrans.css',
})

export class Opentrans implements OnInit {
  
  // ✅ CONFIGURATION SERVEUR
  private serverIp = 'localhost'; 
  serverI: string = 'localhost';

  // États UI
  sidebarOpen = false;
  isModalOpen = false;        // Modale Profil
  isOffreModalOpen = false;   // Modale Ajout Véhicule
  showGererModal = false;     // Modale Actions (Supprimer/Modifier)
  showModifierModal = false;  // Modale Formulaire Modification
  isSubmitting = false;
  loading = false;
  pub = true;                 // Contrôle l'affichage du bouton "Publier"
  // ✅ Et remplace-les par celles-ci :
viewType: string = 'VEHICULES';
filterType: string = 'TOUS';
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
    private vehiculeService: Vehicule, // Ton service Angular
    private authService: Auth,
    private toastr: ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const storedId = this.authService.getUserId()?.toString() || localStorage.getItem('userId');
      if (storedId) {
        // Nettoyage de l'ID (garde uniquement les chiffres)
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
    this.http.get(`http://${this.serverIp}:8080/api/utilisateurs/${this.userIdConnecte}`)
      .subscribe({
        next: (data: any) => this.user = data,
        error: () => this.toastr.error("Erreur de chargement du profil")
      });
  }

  saveUser() {
    if (!this.userIdConnecte) return;
    this.loading = true;
    const formData = new FormData();
    if (this.selectedFile) formData.append('file', this.selectedFile);
    
    formData.append('nom', this.user.nom || '');
    formData.append('localisation', this.user.localisation || '');
    formData.append('sexe', this.user.sexe || '');
    formData.append('number', this.user.number?.toString() || '0');

    this.http.put(`http://${this.serverIp}:8080/api/utilisateurs/modifier/${this.userIdConnecte}`, formData)
      .subscribe({
        next: (res: any) => {
          this.user = res;
          this.toastr.success("Profil mis à jour !");
          this.closeModal();
          this.loading = false;
        },
        error: () => { this.loading = false; this.toastr.error("Erreur mise à jour profil"); }
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

    // Créer un aperçu temporaire pour l'utilisateur dans la modale
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
      this.toastr.warning("Veuillez vous reconnecter");
      return;
    }
    
    if (!this.newOffre.marque || !this.newOffre.immatriculation) {
      this.toastr.error("Marque et Immatriculation requises");
      return;
    }

    this.isSubmitting = true;

    // Préparation de l'objet de données avec l'ID du transporteur
    const vehiculeData = {
      ...this.newOffre,
      idTransporteur: this.userIdConnecte
    };

    // Appel du service avec les deux arguments : les données et le fichier
    this.vehiculeService.publier(vehiculeData, this.selectedFile!).subscribe({
      next: (res) => {
        this.vehicules.unshift(res); // Ajout immédiat à l'affichage
        this.toastr.success("Véhicule ajouté à votre flotte !");
        this.closeOffreModal();
        this.isSubmitting = false;
        this.resetForm();
      },
      error: (err) => { 
        console.error("Détails erreur:", err);
        this.isSubmitting = false; 
        this.toastr.error("Erreur lors de l'ajout. Vérifiez la connexion au serveur."); 
      }
    });
  }
  // ✅ Correction Erreur Image
  handleImageError(event: any) {
    event.target.src = 'assets/images/default-truck.png'; 
  }

  // ✅ Getter pour les offres producteurs (utilisé dans le HTML)
  get offresFiltrees() {
    return this.offresProducteurs; 
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
    this.http.get(`http://${this.serverIp}:8080/api/offres/toutes`).subscribe({
      next: (data: any) => this.offresProducteurs = data,
      error: () => this.toastr.error("Erreur chargement des offres agricoles")
    });
  }

  chargerDemandes() {
    this.http.get(`http://${this.serverIp}:8080/api/demandes`).subscribe({
      next: (data: any) => this.demandesAcheteurs = data,
      error: () => this.toastr.error("Erreur chargement des demandes")
    });
  }

  get vehiculesFiltres() {
    return this.filterType === 'MES_OFFRES' 
      ? this.vehicules.filter(v => v.proprietaire?.id === this.userIdConnecte)
      : this.vehicules;
  }

  getFiltreLength(): number {
    if (this.viewType === 'VEHICULES') return this.vehiculesFiltres.length;
    if (this.viewType === 'OFFRES') return this.offresProducteurs.length;
    return this.demandesAcheteurs.length;
  }

  // --- SECTION 4 : UTILITAIRES ET UI ---

 onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      
      // Lecture du fichier pour l'aperçu (Base64)
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // ✅ Formate l'URL de l'image pour le Backend
  getPhotoUrl(photo: string | undefined): string {
    if (!photo) return 'assets/images/default-truck.png';
    return photo.startsWith('http') ? photo : `http://${this.serverIp}:8080/uploads/${photo}`;
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
}