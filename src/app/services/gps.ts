  import { Injectable } from '@angular/core';
  import { BehaviorSubject } from 'rxjs';

  @Injectable({ providedIn: 'root' })
  export class GpsService {
    // Déclaration des Observables (ceux qui étaient soulignés)
    public position$ = new BehaviorSubject<GeolocationPosition | null>(null);
    public status$ = new BehaviorSubject<string>('Prêt');
    
    public speed$ = new BehaviorSubject<number>(0);
    public distance$ = new BehaviorSubject<number>(0);
    public altitude$ = new BehaviorSubject<number>(0);
    
    private watchId: number | null = null;

    startTracking() {
      if ('geolocation' in navigator) {
        this.status$.next('Recherche...'); // Mise à jour du statut

        this.watchId = navigator.geolocation.watchPosition(
          (pos) => {
            this.status$.next('Actif'); // Mise à jour du statut
            this.position$.next(pos);   // Envoie la position complète (pour la carte)
            
            this.speed$.next(pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0);
            this.altitude$.next(pos.coords.altitude || 0);
          },
          (err) => {
            console.error(err);
            this.status$.next('Erreur');
          },
          { enableHighAccuracy: true }
        );
      } else {
        this.status$.next('Non supporté');
      }
    }

    stopTracking() {
      if (this.watchId !== null) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
        this.status$.next('Arrêté');
      }
    }
  }