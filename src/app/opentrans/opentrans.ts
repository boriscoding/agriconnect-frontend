import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-opentrans',
  standalone: false,
  templateUrl: './opentrans.html',
  styleUrl: './opentrans.css',
})
export class Opentrans implements OnInit {
  sidebarOpen = false;
  headerOpen = false;
  isOffreModalOpen = false;
  isNavMenuOpen: boolean = false;
  isSubmitting: boolean = false; // Pour gérer l'état du bouton pendant l'envoi

  // Objet adapté pour un Transporteur
  newOffre: any = {
    vehicule: '',       
    capacite: null,     
    prixKilo: null,     
    trajet: '',         
    description: '',
    statut: 'DISPONIBLE',
    datePublication: new Date().toISOString().split('T')[0]
  };

  @Input() isOpen: boolean = false; 
  @Output() closeSidebar = new EventEmitter<void>();

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    // Vérification de la session au chargement
    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.warn("Utilisateur non connecté");
      // Optionnel : this.router.navigate(['/login']);
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleHeader() {
    this.headerOpen = !this.headerOpen;
  }

  openOffreModal() {
    this.isOffreModalOpen = true;
  }

  closeOffreModal() {
    this.isOffreModalOpen = false;
    this.isSubmitting = false;
  }

  // Fonction pour enregistrer l'offre de transport
  saveOffre() {
    const storedId = localStorage.getItem('userId');
    if (!storedId) {
      alert("Erreur : session expirée. Veuillez vous reconnecter.");
      return;
    }

    // Nettoyage de l'ID (au cas où il contient des caractères non numériques)
    const userId = +storedId.replace(/\D/g, '');

    this.isSubmitting = true;
    
    const offreAEnvoyer = {
      ...this.newOffre,
      transporteur: { id: userId } 
    };

    console.log('Publication de l\'offre transporteur :', offreAEnvoyer);

    this.http.post('http://localhost:8080/offres-transport/add', offreAEnvoyer).subscribe({
      next: (response: any) => {
        console.log('Succès !', response);
        this.closeOffreModal();
        this.resetForm();
        this.isSubmitting = false;
        alert("Offre de transport publiée avec succès !");
      },
      error: (err: any) => {
        console.error('Erreur lors de la publication', err);
        this.isSubmitting = false;
        alert("Erreur lors de l'enregistrement de l'offre.");
      }
    });
  }

  toggleNavMenu() {
    this.isNavMenuOpen = !this.isNavMenuOpen;
    // Utilisation de facultative chaining pour éviter les erreurs sur certains navigateurs
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  navigateTo(path: string): void {
    this.isNavMenuOpen = false; 
    this.router.navigate([path]);
  }

  resetForm() {
    this.newOffre = {
      vehicule: '',
      capacite: null,
      prixKilo: null,
      trajet: '',
      description: '',
      statut: 'DISPONIBLE',
      datePublication: new Date().toISOString().split('T')[0]
    };
  }

  onClose() {
    this.closeSidebar.emit();
  }

  goToHome() {
    this.router.navigate(['/homepage']);
  }
  
}