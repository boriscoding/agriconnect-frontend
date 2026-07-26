import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { OffreService, OffreData } from '../services/offre'; 
import { Auth } from '../services/auth';
import { Vehicule } from '../services/vehicule';
import { ColisService } from '../services/colis-service'; 


@Component({
  selector: 'app-openoffer',
  standalone: false,
  templateUrl: './openoffer.html',
  styleUrl: './openoffer.css'
})
export class Openoffer implements OnInit {

  // ✅ CONFIGURATION SERVEUR
  private serverIp = 'localhost';
  serverI: string = 'localhost'; // Pour la cohérence avec certains de tes anciens scripts

  // ✅ ÉTATS UI
  sidebarOpen = false;
  isModalOpen = false;      // Modale Profil
  isOffreModalOpen = false; // Modale Ajout Offre
  isSubmitting = false;
  loading = false;
  pub = true;               // Contrôle l'affichage du titre "Publications" vs "Mes Publications"
  
  viewType: 'OFFRES' | 'VEHICULES' | 'DEMANDES' = 'OFFRES';
  filterType: 'TOUS' | 'MES_OFFRES' = 'TOUS';
  hasImageError: boolean = false;

  // ✅ DONNÉES
  user: any = {};
  userIdConnecte: number | null = null;
  offres: OffreData[] = [];         // Liste principale des offres
  offresProducteurs: any[] = [];    // Utilisé pour le rafraîchissement
  vehicules: any[] = [];            // Liste des véhicules transporteurs
  demandesAcheteurs: any[] = [];    // Liste des demandes clients

  // ✅ SÉLECTION ET IMAGES
  selectedFile: File | null = null;
  imagePreview: string | ArrayBuffer | null = null;
  offreSelectionnee: any = null;
  showGererModal = false;
  showModifierModal = false;

  // ✅ MODÈLE NOUVELLE OFFRE
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
    private colisService: ColisService,
    private router: Router, 
    private http: HttpClient,
    private offreService: OffreService, 
    private authService: Auth,
    private toastr: ToastrService,
    private vehiculeService: Vehicule,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

 ngOnInit(): void {
  if (isPlatformBrowser(this.platformId)) {
    // On essaie de récupérer l'ID de l'AuthService ou du localStorage
    const storedId = this.authService.getUserId()?.toString() || localStorage.getItem('userId');
    
    if (storedId) {
      const cleanId = storedId.replace(/\D/g, ''); 
      this.userIdConnecte = +cleanId;
      
      // Une fois l'ID récupéré, on charge les données
      this.loadUserProfile();
      this.chargerToutesLesOffres();
    } else {
      // Si pas d'ID, on redirige (sauf si l'utilisateur est en train de s'inscrire)
      this.router.navigate(['/login']);
    }
  }
}
  // --- SECTION 1 : PROFIL UTILISATEUR ---

  loadUserProfile() {
    if (!this.userIdConnecte) return;
    this.http.get(`http://${this.serverIp}:8080/api/utilisateurs/${this.userIdConnecte}`)
      .subscribe({
        next: (data: any) => this.user = data,
        error: (err: any) => console.error('Erreur profil', err)
      });
  }

  onPhotoSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => this.imagePreview = reader.result as string;
      reader.readAsDataURL(file);
    }
  }

saveUser() {
  if (!this.userIdConnecte) {
    this.toastr.error("Utilisateur non identifié");
    return;
  }

  this.loading = true;
  const formData = new FormData();

  if (this.selectedFile) {
    formData.append('file', this.selectedFile);
  }

  // On envoie uniquement ce que le Java attend maintenant
  formData.append('nom', this.user.nom || ''); 
  formData.append('email', this.user.email || '');
  formData.append('localisation', this.user.localisation || '');
  formData.append('sexe', this.user.sexe || '');
  formData.append('number', (this.user.number || 0).toString());
  formData.append('typeProduit', this.user.typeProduit || '');
  formData.append('surfaceExploitation', (this.user.surfaceExploitation || 0).toString());

  // URL sans /api comme tu le souhaites
  const url = `http://localhost:8080/producteurs/modifier/${this.userIdConnecte}`;

  this.http.put(url, formData).subscribe({
    next: (res: any) => {
      this.user = res;
      this.loading = false;
      this.toastr.success("Profil mis à jour !");
      this.closeModal();
    },
    error: (err) => {
      this.loading = false;
      console.error("Erreur :", err);
      this.toastr.error("Erreur lors de la modification");
    }
  });
}

  // --- SECTION 2 : GESTION DES OFFRES (CRUD) ---

  chargerToutesLesOffres() {
    this.loading = true;
    this.offreService.getAllOffres().subscribe({
      next: (data: OffreData[]) => {
        this.offres = data;
        this.offresProducteurs = data; // Synchronisation des deux listes
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Erreur chargement offres', err);
        this.loading = false;
      }
    });
  }

  // Utilisé par le bouton "Actualiser" de l'Empty State
  chargerOffres() {
    this.chargerToutesLesOffres();
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

    // On fait correspondre EXACTEMENT avec les @RequestParam du Java
    formData.append('titre', this.newOffre.nproduit); 
    formData.append('nomProduit', this.newOffre.nproduit);
    formData.append('categorie', this.newOffre.type_pro);
    formData.append('description', this.newOffre.description || '');
    formData.append('prixUnitaire', this.newOffre.prixUnitaire.toString());
    formData.append('quantiteProduit', this.newOffre.quantiteProduit?.toString() || '0');
    
    // 👇 ICI : On envoie "lieuProduction" car le Java l'exige
    formData.append('lieuProduction', this.newOffre.localisation || this.newOffre.lieuProduction || ''); 
    
    formData.append('statut', this.newOffre.statut);
    formData.append('producteurId', this.userIdConnecte.toString());

    // 👇 ICI : L'URL exacte qui correspond à ton contrôleur
    const url = `http://${this.serverIp}:8080/api/offres/publier`;

    // Comme tu n'utilises pas directement creerOffre du service ici, on utilise this.http.post
    this.http.post(url, formData).subscribe({
      next: (res: any) => {
        this.toastr.success('Votre offre est en ligne !');
        this.offres.unshift(res); 
        this.closeOffreModal();
        this.resetForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error("Erreur backend:", err);
        this.toastr.error('Erreur lors de la publication');
        this.isSubmitting = false;
      }
    });
  }
  confirmerSuppression() {
    if (this.offreSelectionnee && confirm('Voulez-vous vraiment supprimer cette offre ?')) {
      this.offreService.supprimerOffre(this.offreSelectionnee.id).subscribe({
        next: () => {
          this.offres = this.offres.filter(o => o.id !== this.offreSelectionnee.id);
          this.showGererModal = false;
          this.toastr.success('Offre supprimée');
        },
        error: () => this.toastr.error('Erreur suppression')
      });
    }
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

  // --- SECTION 3 : NAVIGATION ET FILTRES ---

  switchView(type: 'OFFRES' | 'VEHICULES' | 'DEMANDES') {
    this.viewType = type;
    this.pub = (type === 'OFFRES');
    if (type === 'VEHICULES' && this.vehicules.length === 0) this.chargerVehicules();
    if (type === 'DEMANDES' && this.demandesAcheteurs.length === 0) this.chargerDemandes();
  }

  chargerVehicules() {
    this.loading = true;
    this.vehiculeService.getToutes().subscribe({
      next: (data: any[]) => {
        this.vehicules = data;
        this.loading = false;
      },
      error: () => {
        this.toastr.error("Erreur chargement transporteurs");
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
      error: () => {
        this.toastr.error("Erreur chargement demandes");
        this.loading = false;
      }
    });
  }

  // ✅ Getters pour le HTML
  get offresFiltrees() {
    return this.filterType === 'MES_OFFRES' 
      ? this.offres.filter(o => o.producteur?.id === this.userIdConnecte)
      : this.offres;
  }

  get vehiculesFiltres() {
    return this.filterType === 'MES_OFFRES' 
      ? this.vehicules.filter(v => v.proprietaire?.id === this.userIdConnecte)
      : this.vehicules;
  }

  getFiltreLength(): number {
    if (this.viewType === 'OFFRES') return this.offresFiltrees.length;
    if (this.viewType === 'VEHICULES') return this.vehiculesFiltres.length;
    if (this.viewType === 'DEMANDES') return this.demandesAcheteurs.length;
    return 0;
  }

  // --- SECTION 4 : UTILITAIRES ET UI ---

  getDisplayPhoto(photoName: string | undefined, type: 'PRODUIT' | 'VEHICULE' | 'USER' = 'PRODUIT'): string {
    if (!photoName || photoName === 'null') {
      if (type === 'USER') return 'assets/images/default-user.png';
      if (type === 'VEHICULE') return 'assets/images/default-truck.png';
      return 'assets/images/default-produit.png';
    }
    return photoName.startsWith('http') ? photoName : `http://${this.serverIp}:8080/uploads/${photoName}`;
  }

  getPhotoUrl(photo: string | undefined): string {
    return this.getDisplayPhoto(photo, 'PRODUIT');
  }

  getVehiculePhoto(photoName: string | undefined): string {
    return this.getDisplayPhoto(photoName, 'VEHICULE');
  }

  handleImageError(event: any) {
    event.target.src = 'assets/images/lop.png';
  }

  resetForm() {
    this.newOffre = {
      titre: '', nproduit: '', type_pro: 'PRODUCTEUR_DIRECT',
      description: '', prixUnitaire: null, quantiteProduit: null,
      uniteMesure: 'Kg', lieuProduction: '', region: 'Littoral',
      statut: 'DISPONIBLE'
    };
    this.imagePreview = null;
    this.selectedFile = null;
  }

  ouvrirGerer(offre: any) { this.offreSelectionnee = { ...offre }; this.showGererModal = true; }
  ouvrirModifier() { this.showGererModal = false; setTimeout(() => this.showModifierModal = true, 150); }
  openEditModal() { this.isModalOpen = true; }
  closeModal() { this.isModalOpen = false; }
  openOffreModal() { this.isOffreModalOpen = true; }
  closeOffreModal() { this.isOffreModalOpen = false; this.resetForm(); }
  toggleSidebar() { this.sidebarOpen = !this.sidebarOpen; }
  mesoffres() { this.pub = false; this.filterType = 'MES_OFFRES'; }
  toussoffres() { this.pub = true; this.filterType = 'TOUS'; }
  navigateTo(path: string) { this.router.navigate([path]); }
  logout() { this.authService.logout(); this.router.navigate(['/login']); }
  // ✅ Gère la sélection de fichier pour le profil et les offres
onFileSelected(event: any) {
  const file = event.target.files[0];
  if (file) {
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      // Si la modale de profil est ouverte, on met à jour la photo profil
      if (this.isModalOpen) {
        this.user.photosuser = e.target.result;
      } else {
        // Sinon, c'est l'aperçu pour une nouvelle offre
        this.imagePreview = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  }
}
// ✅ Importer Router en haut du fichier si ce n'est pas fait
// import { Router } from '@angular/router';

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

  // On prépare le message automatique
  const messageAuto = `Bonjour, je suis intéressé par votre offre : "${titreProduit}". Est-elle toujours disponible ?`;

  // Redirection vers le chat avec les paramètres
  this.router.navigate(['/chat'], { 
    queryParams: { 
      contactId: destinataireId,
      message: messageAuto 
    } 
  });
}

// Méthode appelée quand on clique sur le bouton "Commander"
  ouvrirCommande(offre: any) {
    this.offreSelectionnee = offre;
  }

  // Méthode appelée quand la modale émet l'événement 'close'
  fermerCommande() {
    this.offreSelectionnee = null;
  }
  // Dans ton app-commande.ts
// Dans app-commande.ts, à l'intérieur de ta classe
// À mettre dans app-commande.ts (et non openoffer.ts)

}