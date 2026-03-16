import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common'; 
import { User } from '../services/user';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly STORAGE_KEY = 'currentUser';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

  getUserConnected(): User | null {
    if (isPlatformBrowser(this.platformId)) {
      // ✅ Utilisation de sessionStorage pour isoler l'utilisateur par onglet
      const data = sessionStorage.getItem(this.STORAGE_KEY);
      return data ? (JSON.parse(data) as User) : null;
    }
    return null;
  }

  getUserId(): number | null {
    const user = this.getUserConnected();
    return user ? user.id : null;
  }

  saveUser(user: User): void {
    if (isPlatformBrowser(this.platformId)) {
      // ✅ Sauvegarde dans la session de l'onglet uniquement
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    }
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      // ✅ Nettoyage de la session de l'onglet
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }
}