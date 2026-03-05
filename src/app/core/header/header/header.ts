import { Component, OnInit, EventEmitter, Output, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common'; // Important pour le SSR

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  @Output() sidebarToggle = new EventEmitter<boolean>();
  isSidebarOpen = false;
  isModalOpen = false;
  
  user: any = {};
  userId: number | null = null;
  loading = false;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object // Injecte l'ID de la plateforme
  ) {}

  ngOnInit() {
    // On vérifie si on est dans le navigateur avant d'utiliser localStorage
    if (isPlatformBrowser(this.platformId)) {
      const storedId = localStorage.getItem('userId');
      
      if (storedId) {
        // Nettoyage de sécurité : transforme "8:1" en "8"
        const cleanId = storedId.replace(/\D/g, ''); 
        this.userId = +cleanId;
        
        if (this.userId) {
          this.loadUserProfile();
        }
      }
    }
  }

loadUserProfile() {
  if (!this.userId) return;

  // Maintenant, cette URL retournera bien les données du Producteur
  this.http.get(`http://localhost:8080/api/utilisateurs/${this.userId}`)
    .subscribe({
      next: (data) => {
        this.user = data; // 'user' contient maintenant 'surfaceExploitation', etc.
        console.log('Profil récupéré avec succès !');
      },
      error: (err) => {
        console.error('Le backend ne trouve toujours pas l\'ID', err);
      }
    });
}
  saveUser() {
    if (!this.userId) {
      alert("Erreur : ID utilisateur introuvable.");
      return;
    }
    
    this.loading = true;

    this.http.put(`http://localhost:8080/api/utilisateurs/modifier/${this.userId}`, this.user)
      .subscribe({
        next: (res) => {
          console.log('Mise à jour réussie sur le serveur', res);
          this.user = res; 
          this.closeModal();
          this.loading = false;
          alert("Profil mis à jour avec succès !");
        },
        error: (err) => {
          console.error('Erreur de sauvegarde', err);
          this.loading = false;
          alert("Erreur lors de la mise à jour.");
        }
      });
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
    this.sidebarToggle.emit(this.isSidebarOpen);
  }

  openEditModal() { this.isModalOpen = true; }
  closeModal() { this.isModalOpen = false; }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => this.user.photosuser = e.target.result;
      reader.readAsDataURL(file);
    }
  }
}