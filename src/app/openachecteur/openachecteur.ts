import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';


@Component({
  selector: 'app-openachecteur',
  standalone: false,
  templateUrl: './openachecteur.html',
  styleUrl: './openachecteur.css',
})
export class Openachecteur {


  constructor(private router: Router) {}
   sidebarOpen = false;
Open = false
  // Voici la variable manquante pour ton menu flottant
  isNavMenuOpen: boolean = false;
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    }
    headerOpen = false;

    toggleHeader() {
      this.headerOpen = !this.headerOpen;
    }// Contrôle de la modale
  isOffreModalOpen = false;

  // Objet basé sur ton entité Java
 newOffre: any = {
  produit: '',
  quantiteProduit: null,
  prixUnitaire: null,
  description: '',
  statut: 'DISPONIBLE', // Doit correspondre à la "value" de l'option HTML
  datePublication: new Date().toISOString().split('T')[0]
};

  openOffreModal() {
    this.isOffreModalOpen = true;
  }

  closeOffreModal() {
    this.isOffreModalOpen = false;
  }

  saveOffre() {
    console.log('Offre à publier :', this.newOffre);
    // Ici tu feras ton appel au service : this.offreService.create(this.newOffre)...
    this.closeOffreModal();
  }
@Input() isOpen: boolean = false; // Reçoit l'état depuis le parent
  @Output() closeSidebar = new EventEmitter<void>(); // Permet de fermer depuis la sidebar

  onClose() {
    this.closeSidebar.emit();
  }
  
//  Button retour au homepage 

ngOnInit() {
  const prenom = localStorage.getItem('userFirstName');
  const role = localStorage.getItem('userRole');
  console.log(`Bienvenue ${prenom}, tu es connecté en tant que ${role}`);
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

}
