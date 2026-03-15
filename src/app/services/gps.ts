import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GpsService {
  public position$ = new BehaviorSubject<GeolocationPosition | null>(null);
  public status$ = new BehaviorSubject<string>('Prêt');
  public speed$ = new BehaviorSubject<number>(0);
  public distance$ = new BehaviorSubject<number>(0);
  public altitude$ = new BehaviorSubject<number>(0);
  
  private watchId: number | null = null;
  private lastCoords: { lat: number, lng: number } | null = null;
  private totalDistance = 0;

  startTracking() {
    if ('geolocation' in navigator) {
      this.status$.next('Recherche...');

      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.status$.next('Actif');
          this.position$.next(pos);
          
          const currentLat = pos.coords.latitude;
          const currentLng = pos.coords.longitude;

          // Calcul de la distance parcourue
          if (this.lastCoords) {
            const d = this.calculateDistance(
              this.lastCoords.lat, this.lastCoords.lng,
              currentLat, currentLng
            );
            // On n'ajoute la distance que si la précision est bonne (ex: > 5 mètres)
            if (d > 0.005) { 
              this.totalDistance += d;
              this.distance$.next(this.totalDistance);
            }
          }
          this.lastCoords = { lat: currentLat, lng: currentLng };

          // Vitesse en km/h (conversion m/s -> km/h)
          this.speed$.next(pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0);
          this.altitude$.next(pos.coords.altitude || 0);
        },
        (err) => {
          this.handleError(err);
        },
        { 
          enableHighAccuracy: true, // INDISPENSABLE pour le GPS
          timeout: 10000,           // Attend 10s max pour un signal
          maximumAge: 0             // Ne pas utiliser de position en cache
        }
      );
    } else {
      this.status$.next('Non supporté');
    }
  }

  // Formule de Haversine pour calculer la distance entre deux points GPS
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private handleError(err: GeolocationPositionError) {
    switch(err.code) {
      case err.PERMISSION_DENIED:
        this.status$.next('Permission refusée');
        break;
      case err.TIMEOUT:
        this.status$.next('Signal trop faible');
        break;
      default:
        this.status$.next('Erreur GPS');
    }
  }

  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.lastCoords = null;
      this.status$.next('Arrêté');
    }
  }
  
}