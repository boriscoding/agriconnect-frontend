import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profil',
  templateUrl: './profil.html', // 👈 Remplacez './profil.component.html' par './profil.html'
  styleUrls: ['./profil.css']
})
export class ProfilComponent implements OnInit {
  
  user: any = {
    nom: '',
    number: '',
    sexe: 'M',
    localisation: '',
    photosuser: ''
  };

  loading: boolean = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadUserData();
  }

  loadUserData(): void {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('userProfile');
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);
      } catch (e) {
        console.error('Erreur lors du chargement des données utilisateur:', e);
      }
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.user.photosuser = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  saveUser(): void {
    this.loading = true;
    
    // Simuler la sauvegarde locale
    setTimeout(() => {
      this.loading = false;
      localStorage.setItem('user', JSON.stringify(this.user));
      this.router.navigate(['/']);
    }, 1000);
  }
}