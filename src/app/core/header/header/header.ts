import { Component, OnInit, EventEmitter, Output, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common'; // Important pour le SSR
import { environment } from '../../../../environments/environment'; // 👈 chemin corrigé : core/header/header/ = 3 niveaux sous src/app

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
  selectedFile: File | null = null;
  photoPreview: string | ArrayBuffer | null = null;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object // Injecte l'ID de la plateforme
  ) {}

  ngOnInit() {
    // On vérifie si on est dans le navigateur avant d'utiliser localStorage
    if (isPlatformBrowser(this.platformId)) {
      const storedId = sessionStorage.getItem('userId');
      
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

    this.http.get(`${environment.apiUrl}/api/utilisateurs/${this.userId}`)
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

    // UtilisateurController.modifierProfil() attend du multipart/form-data
    // avec des @RequestParam individuels (nom, localisation, sexe, number tous requis),
    // pas un body JSON.
    const formData = new FormData();
    if (this.selectedFile) formData.append('file', this.selectedFile);
    formData.append('nom', this.user.nom || '');
    formData.append('localisation', this.user.localisation || '');
    formData.append('sexe', this.user.sexe || 'M'); // requis, jamais vide
    formData.append('number', (this.user.number || 0).toString()); // jamais '', sinon 400 côté Spring

    this.http.put(`${environment.apiUrl}/api/utilisateurs/modifier/${this.userId}`, formData)
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

  openEditModal() { 
    this.isModalOpen = true; 
  }
  
  closeModal() { 
    this.isModalOpen = false; 
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => this.photoPreview = e.target.result;
      reader.readAsDataURL(file);
    }
  }

  // Construit l'URL affichable de la photo, qu'il s'agisse d'un aperçu local
  // ou d'un fichier déjà stocké côté serveur (nom de fichier / chemin relatif).
  getUserPhotoUrl(): string | null {
    if (this.photoPreview) return this.photoPreview as string;
    if (!this.user?.photosuser) return null;
    if (this.user.photosuser.startsWith('http')) return this.user.photosuser;
    return `${environment.apiUrl}${this.user.photosuser}`;
  }
}