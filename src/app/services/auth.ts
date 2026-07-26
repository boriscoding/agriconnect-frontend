import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User } from '../services/user';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly STORAGE_KEY = 'currentUser';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

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
      // ✅ On lit d'abord 'userId' depuis localStorage (survit à router.navigate)
      const directId = localStorage.getItem('userId');
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

      // ✅ userId seul → localStorage (persiste après router.navigate)
      // openacheteur.ts fait localStorage.getItem('userId') en fallback
      localStorage.setItem('userId', user.id.toString());
    }
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem('userId');
    }
  }
}