import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Offre } from '../services/offre'; 
import { Auth } from '../services/auth'; // Ajout du service d'authentification
import { ToastrService } from 'ngx-toastr';
// 1. Ajoute ces imports en haut
import { Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-openoffer',
  standalone: false,
  templateUrl: './openoffer.html',
  styleUrl: './openoffer.css'
})
export class Openoffer implements OnInit {

  // --- VARIABLES D'ÉTAT ---
  sidebarOpen = false;
  headerOpen = false;
  isNavMenuOpen = false;
  isSubmitting = false;
  isOffreModalOpen = false;
  pub = true;
  filterType: 'TOUS' | 'MES_OFFRES' = 'TOUS';

  // --- DONNÉES ---
  offres: any[] = [];
  selectedFile: File | null = null;
  imagePreview: string | ArrayBuffer | null = null; 
  userIdConnecte: number | null = null; // Initialisé à null pour plus de sécurité

  // Objet de formulaire
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

  @Input() isOpen: boolean = false;
  @Output() closeSidebar = new EventEmitter<void>();

  constructor(
    private router: Router, 
    private offreService: Offre,
    private authService: Auth, // Injection du AuthService
    private toastr: ToastrService ,
    @Inject(PLATFORM_ID) private platformId: Object // <--- MANQUANT : Injection de la plateforme
  ) {}

ngOnInit(): void {
  // ✅ MANQUANT : Vérifier qu'on est sur le navigateur avant d'agir
  if (isPlatformBrowser(this.platformId)) {
    const userId = this.authService.getUserId();

    if (userId) {
      this.userIdConnecte = userId;
      this.chargerToutesLesOffres();
    } else {
      this.toastr.warning('Session expirée, veuillez vous reconnecter');
      this.router.navigate(['/login']);
    }
  }
}
  // --- LOGIQUE DE FILTRES ---
  mesoffres(): void {
    this.pub = false;
    this.setFilter('MES_OFFRES');
  }

  toussoffres(): void {
    this.pub = true;
    this.setFilter('TOUS');
  }

  setFilter(type: 'TOUS' | 'MES_OFFRES') {
    this.filterType = type;
  }

  get offresFiltrees() {
    if (this.filterType === 'MES_OFFRES') {
      return this.offres.filter(o => o.producteur && o.producteur.id === this.userIdConnecte);
    }
    return this.offres;
  }

  // --- GESTION DU FICHIER ET APERÇU ---
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // --- SAUVEGARDE VERS LE BACKEND ---
  saveOffre() {
    if (!this.userIdConnecte) {
      this.toastr.error("Utilisateur non identifié");
      return;
    }
  
    if (!this.newOffre.nproduit || !this.newOffre.prixUnitaire) {
      this.toastr.warning('Veuillez remplir les champs obligatoires');
      return;
    }

    this.isSubmitting = true;
    const formData = new FormData();

    if (this.selectedFile) {
      formData.append('file', this.selectedFile);
    }

    // Mapping vers les @RequestParam du controller Spring Boot
    formData.append('titre', this.newOffre.nproduit); 
    formData.append('nomProduit', this.newOffre.nproduit);
    formData.append('categorie', this.newOffre.type_pro); // Assure-toi que c'est 'categorie' ou 'type_pro' selon ton Java
    formData.append('description', this.newOffre.description || '');
    formData.append('prixUnitaire', this.newOffre.prixUnitaire.toString());
    formData.append('quantiteProduit', this.newOffre.quantiteProduit?.toString() || '0');
    formData.append('lieuProduction', this.newOffre.lieuProduction || '');
    formData.append('statut', this.newOffre.statut);
    formData.append('producteurId', this.userIdConnecte.toString());

    this.offreService.creerOffre(formData).subscribe({
      next: (res) => {
        this.toastr.success('Votre offre est en ligne !');
        this.offres.unshift(res); 
        this.closeOffreModal();
        this.resetForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        this.toastr.error('Erreur lors de la publication');
        this.isSubmitting = false;
        console.error('Erreur Backend :', err);
      }
    });
  }

  // --- GESTION UI ---
  chargerToutesLesOffres() {
    this.offreService.getAllOffres().subscribe({
      next: (data) => this.offres = data,
      error: (err) => console.error('Erreur chargement offres', err)
    });
  }

  resetForm() {
    this.newOffre = {
      titre: '', nproduit: '', type_pro: 'PRODUCTEUR_DIRECT',
      description: '', prixUnitaire: null, quantiteProduit: null,
      uniteMesure: 'Kg', lieuProduction: '', region: 'Littoral',
      statut: 'DISPONIBLE'
    };
    this.selectedFile = null;
    this.imagePreview = null;
  }

  openOffreModal() { this.isOffreModalOpen = true; }

  closeOffreModal() { 
    this.isOffreModalOpen = false; 
    this.imagePreview = null;
  }

  toggleSidebar() { this.sidebarOpen = !this.sidebarOpen; }
  toggleNavMenu() { this.isNavMenuOpen = !this.isNavMenuOpen; }

  navigateTo(path: string): void {
    this.isNavMenuOpen = false;
    this.router.navigate([path]);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  
}