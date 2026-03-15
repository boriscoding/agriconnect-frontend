import { Component, AfterViewInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GpsService } from '../services/gps';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-local',
  templateUrl: './local.html',
  styleUrls: ['./local.css'],
  standalone: false
})
export class Local implements AfterViewInit, OnDestroy {
  public modes = ['auto', 'Marche', 'Conduite', 'Le cyclisme'];
  public activeMode = 'auto';
  public debut = false;
  
  private map: any;
  private marker: any;
  private gpsSub!: Subscription;
  private isFirstPosition = true;

  constructor(
    public gps: GpsService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // Utilise l'import dynamique pour Leaflet uniquement dans le navigateur
  async ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Gestion du redimensionnement
      window.addEventListener('resize', () => {
        if (this.map) this.map.invalidateSize();
      });

      const L = await import('leaflet');
      this.initMap(L);
      
      // On s'abonne au flux GPS
      this.gpsSub = this.gps.position$.subscribe((pos: any) => {
        // AFFICHAGE EN CONSOLE
        console.log("Données GPS reçues dans le composant :", pos);

        if (pos && pos.coords && this.map) {
          console.log(`📍 Localisation détectée : Lat ${pos.coords.latitude}, Lng ${pos.coords.longitude}`);
          this.updateMapPosition(pos.coords.latitude, pos.coords.longitude);
        } else {
          console.warn("⚠️ En attente d'un signal GPS valide...");
        }
      });

      // Lancement automatique du tracking au démarrage
      this.debute();
    }
  }

  private initMap(L: any) {
    // Coordonnées par défaut (Centre du Cameroun : Yaoundé)
    const camerounCenter: [number, number] = [3.848, 11.502]; 
    
    this.map = L.map('map', { zoomControl: false }).setView(camerounCenter, 6);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    const iconDefault = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });

    this.marker = L.marker(camerounCenter, { icon: iconDefault }).addTo(this.map);
    
    // Correction pour s'assurer que la carte occupe tout l'espace
    setTimeout(() => this.map.invalidateSize(), 200);
  }

  private updateMapPosition(lat: number, lng: number) {
    if (this.map && this.marker) {
      this.marker.setLatLng([lat, lng]);

      if (this.isFirstPosition) {
        // Zoom précis au premier signal reçu
        this.map.setView([lat, lng], 16); 
        this.isFirstPosition = false;
        console.log("🎯 Premier repérage effectué sur la carte.");
      } else {
        // Déplacement fluide pour les suivants
        this.map.panTo([lat, lng]); 
      }
    }
  }

  debute(): void {
    this.debut = true;
    console.log("🚀 Activation du tracking GPS...");
    this.gps.startTracking();
  }

  arrete(): void {
    this.debut = false;
    console.log("🛑 Arrêt du tracking GPS.");
    this.gps.stopTracking();
  }

  setMode(mode: string) {
    this.activeMode = mode;
  }

  getModeIcon(mode: string): string {
    const icons: any = { 
      'auto': 'fa-car', 
      'Marche': 'fa-walking', 
      'Conduite': 'fa-steering-wheel', 
      'Le cyclisme': 'fa-bicycle' 
    };
    return icons[mode] || 'fa-map-marker-alt';
  }

  ngOnDestroy() {
    if (this.gpsSub) this.gpsSub.unsubscribe();
    if (this.map) this.map.remove();
  }
}