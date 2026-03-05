import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http'; // Ajouté pour les appels API

@Component({
  selector: 'app-opentrans',
  standalone: false,
  templateUrl: './opentrans.html',
  styleUrl: './opentrans.css',
})
export class Opentrans {
  sidebarOpen = false;
  headerOpen = false;
  isOffreModalOpen = false;
  // Voici la variable manquante pour ton menu flottant
  isNavMenuOpen: boolean = false;

  // Objet adapté pour un Transporteur (basé sur ton nouveau formulaire)
  newOffre: any = {
    vehicule: '',       // Ex: Camion 10T
    capacite: null,     // En tonnes
    prixKilo: null,     // Tarif au km
    trajet: '',         // Ex: Douala - Yaoundé
    description: '',
    statut: 'DISPONIBLE',
    datePublication: new Date().toISOString().split('T')[0]
  };

  @Input() isOpen: boolean = false; 
  @Output() closeSidebar = new EventEmitter<void>();

  constructor(private router: Router, private http: HttpClient) {}

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
  }

  // Fonction pour enregistrer l'offre de transport
  saveOffre() {
    // Récupération de l'ID du transporteur connecté (ex: ID 10)
    const userId = localStorage.getItem('userId');
    
    const offreAEnvoyer = {
      ...this.newOffre,
      transporteur: { id: userId } // On lie l'offre au transporteur connecté
    };

    console.log('Publication de l\'offre transporteur :', offreAEnvoyer);

    // Appel à ton API Spring Boot
    this.http.post('http://localhost:8080/offres-transport/add', offreAEnvoyer).subscribe({
      next: (response) => {
        console.log('Succès !', response);
        this.closeOffreModal();
        // Réinitialiser le formulaire
        this.resetForm();
      },
      error: (err) => {
        console.error('Erreur lors de la publication', err);
        alert("Erreur lors de l'enregistrement de l'offre.");
      }
    });
  }
  // Dans ton opentrans.ts pour le menu flottant  
toggleNavMenu() {
  this.isNavMenuOpen = !this.isNavMenuOpen;
  if (navigator.vibrate) {
    navigator.vibrate(50); // Petite vibration de 50ms
  }
}
// --- MÉTHODES DE NAVIGATION ---
  
  navigateTo(path: string): void {
    this.isNavMenuOpen = false; // On ferme le menu après le clic
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

  // Button retour au homepage
  goToHome() {
    this.router.navigate(['/homepage']);
  }
}