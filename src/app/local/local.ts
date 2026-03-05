import { Component, OnInit, AfterViewInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GpsService } from '../services/gps';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-local',
  templateUrl: './local.html',
  styleUrls: ['./local.css'],
  standalone: false
})
export class Local implements OnInit, AfterViewInit, OnDestroy {
  // Déclarations nécessaires pour éviter les erreurs NG9
  public modes = ['auto', 'walking', 'driving', 'bicycling'];
  public activeMode = 'auto';
  debut = true;
  private map: any; 
  private marker: any;
  private gpsSub!: Subscription; 

  constructor(
    public gps: GpsService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}
  
  arrete() : void {
    this.debut = false ;
  }
  debute() : void {
    this.debut = true ;
  }
  ngOnInit() {}

  async ngAfterViewInit() {
    // On n'exécute ce code QUE dans le navigateur
    if (isPlatformBrowser(this.platformId)) {
      
      // Chargement dynamique de Leaflet pour éviter "window is not defined"
      const L = await import('leaflet');

      this.initMap(L);
      
      this.gpsSub = this.gps.position$.subscribe((pos: any) => {
        if (pos && pos.coords && this.map) {
          this.updateMapPosition(pos.coords.latitude, pos.coords.longitude);
        }
      });
    }
  }

  private initMap(L: any) {
    const defaultCoords: [number, number] = [48.8566, 2.3522];
    
    this.map = L.map('map').setView(defaultCoords, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.map);
    
    // Configuration manuelle de l'icône pour éviter les erreurs d'images
    const iconDefault = L.icon({
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      iconUrl: 'assets/marker-icon.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });
    
    this.marker = L.marker(defaultCoords, { icon: iconDefault }).addTo(this.map);

    setTimeout(() => {
      this.map.invalidateSize();
    }, 200);
  }

  private updateMapPosition(lat: number, lng: number) {
    if (this.map && this.marker) {
      this.map.setView([lat, lng], this.map.getZoom());
      this.marker.setLatLng([lat, lng]);
    }
  }

  setMode(mode: string) {
    this.activeMode = mode;
  }

  ngOnDestroy() {
    if (this.gpsSub) this.gpsSub.unsubscribe();
    if (this.map) this.map.remove();
  }
}