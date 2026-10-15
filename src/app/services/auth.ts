import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User } from '../services/user';
import { HttpClient } from '@angular/common/http'; // 👈 1. Import de HttpClient
import { Observable } from 'rxjs'; // 👈 2. Import de Observable
import { environment } from '../../environments/environment'; // 👈 3. Import de l'environnement (ajustez les ".." si besoin)

@Injectable({ providedIn: 'root' })
export class Auth {

  private readonly STORAGE_KEY = 'currentUser';

  constructor(@Inject(PLATFORM_ID) private platformId: Object ,private http: HttpClient) {}

  getUserConnected(): User | null {
    if (isPlatformBrowser(this.platformId)) {
      // Le profil complet reste en sessionStorage (ton chat en a besoin par onglet)
      const data = sessionStorage.getItem(this.STORAGE_KEY);
      return data ? (JSON.parse(data) as User) : null;
    }
    return null;
  }

  getUserId(): number | null {
    if (isPlatformBrowser(this.platformId)) {
      // ✅ sessionStorage : isolé par onglet (contrairement à localStorage,
      // partagé entre tous les onglets, ce qui causait des "écrasements"
      // de session quand plusieurs comptes étaient testés en parallèle).
      // Survit très bien à router.navigate() (uniquement effacé à la fermeture
      // de l'onglet), donc aucun compromis par rapport à l'ancien comportement.
      const directId = sessionStorage.getItem('userId');
      if (directId) return parseInt(directId, 10);

      // Fallback : depuis le profil sessionStorage si disponible
      const user = this.getUserConnected();
      if (!user) return null;
      return typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
    }
    return null;
  }

  saveUser(user: User): void {
    if (isPlatformBrowser(this.platformId)) {
      // Profil complet → sessionStorage (isolé par onglet, préservé pour le chat)
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));

      // ✅ userId seul → sessionStorage également (isolé par onglet, persiste
      // après router.navigate() puisque ce n'est qu'une navigation SPA, pas
      // un rechargement de page).
      sessionStorage.setItem('userId', user.id.toString());
    }
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(this.STORAGE_KEY);
      sessionStorage.removeItem('userId');
    }
  }
  // ✅ Bonne pratique
login(credentials: any): Observable<any> {
  return this.http.post(`${environment.apiUrl}/auth/login`, credentials); 
  // Ou simplement `${environment.apiUrl}/utilisateurs/login` selon votre backend
}
}