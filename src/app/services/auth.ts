import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common'; // Requis pour ne pas crasher
import { User } from '../services/user';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly STORAGE_KEY = 'currentUser';

  // On injecte l'identifiant de la plateforme
  constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

  getUserConnected(): User | null {
    // On ne touche au localStorage QUE si on est sur le navigateur
    if (isPlatformBrowser(this.platformId)) {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? (JSON.parse(data) as User) : null;
    }
    return null; // Sur le serveur, on renvoie null sans crasher
  }

  getUserId(): number | null {
    const user = this.getUserConnected();
    return user ? user.id : null;
  }

  saveUser(user: User): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    }
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}