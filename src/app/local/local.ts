import { Component, AfterViewInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { GpsService } from '../services/gps';
import { Transaction } from '../services/transaction';
import { Subject, Subscription } from 'rxjs';

// ────────────────────────────────────────────────────────────
// Algorithme de Dijkstra — calcul du chemin optimal sur la carte
// ────────────────────────────────────────────────────────────
interface GraphNode { id: string; lat: number; lng: number; voisins: { id: string; poids: number }[]; }

function dijkstra(graph: Map<string, GraphNode>, departId: string, arriveeId: string): string[] {
  const dist    = new Map<string, number>();
  const prev    = new Map<string, string | null>();
  const visited = new Set<string>();

  graph.forEach((_, id) => { dist.set(id, Infinity); prev.set(id, null); });
  dist.set(departId, 0);

  while (true) {
    // Nœud non visité avec la distance minimale
    let u: string | null = null;
    let minD = Infinity;
    dist.forEach((d, id) => {
      if (!visited.has(id) && d < minD) { minD = d; u = id; }
    });
    if (!u || u === arriveeId) break;

    visited.add(u);
    const node = graph.get(u)!;
    node.voisins.forEach(v => {
      const alt = dist.get(u!)! + v.poids;
      if (alt < dist.get(v.id)!) { dist.set(v.id, alt); prev.set(v.id, u); }
    });
  }

  // Reconstruction du chemin
  const path: string[] = [];
  let cur: string | null = arriveeId;
  while (cur) { path.unshift(cur); cur = prev.get(cur) || null; }
  return path[0] === departId ? path : [];
}

// ────────────────────────────────────────────────────────────
@Component({
  selector: 'app-local',
  templateUrl: './local.html',
  styleUrls: ['./local.css'],
  standalone: false
})
export class Local implements AfterViewInit, OnDestroy {

  // ── Config modes ──────────────────────────────────────────
  public modes    = ['Auto', 'Marche', 'Conduite', 'Cyclisme'];
  public activeMode = 'Auto';

  // ── État GPS ──────────────────────────────────────────────
  public debut       = false;    // true = tracking actif
  public transactionId: number | null = null;
  public dateDepart: string | null = null;

  // ── Rôle de l'utilisateur connecté ────────────────────────
  // 'transporteur' : voit le bouton DÉMARRER
  // 'acheteur' ou 'producteur' : lecture seule
  public roleUtilisateur: 'transporteur' | 'acheteur' | 'producteur' = 'acheteur';

  // ── Carte Leaflet ─────────────────────────────────────────
  private map: any;
  private markerTransporteur: any;
  private markerDepart: any;
  private markerArrivee: any;
  private routePolyline: any;
  private isFirstPosition = true;
  private positionInterval: any;

  // ── Dijkstra ──────────────────────────────────────────────
  private graphVilles = new Map<string, GraphNode>();
  public  cheminOptimal: string[] = [];

  // ── Subscriptions ─────────────────────────────────────────
  private destroy$  = new Subject<void>();
  private gpsSub!:  Subscription;
  private posSub!:  Subscription;

  constructor(
    public  gps:              GpsService,
    private transactionSvc:   Transaction,
    private route:            ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // ────────────────────────────────────────────────────────
  // INIT
  // ────────────────────────────────────────────────────────
  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Lire les paramètres de l'URL
    // ex: /localisation?transactionId=12&role=transporteur
    this.route.queryParams.subscribe(params => {
      this.transactionId  = params['transactionId'] ? Number(params['transactionId']) : null;
      this.dateDepart     = params['dateDepart']    || null;
      this.roleUtilisateur = (params['role'] as any) || 'acheteur';
    });

    // Lire le rôle depuis le storage si absent dans l'URL
    if (!this.route.snapshot.queryParamMap.has('role')) {
      const userRaw = sessionStorage.getItem('userProfile') || sessionStorage.getItem('user');
      if (userRaw) {
        try {
          const u = JSON.parse(userRaw);
          this.roleUtilisateur = u.type?.toLowerCase() || 'acheteur';
        } catch { /* ignore */ }
      }
    }

    window.addEventListener('resize', () => { if (this.map) this.map.invalidateSize(); });

    const L = await import('leaflet');
    this.construireGrapheVilles();
    this.initMap(L);

    this.gpsSub = this.gps.position$.subscribe((pos: any) => {
      if (pos?.coords && this.map) {
        this.updateMapPosition(pos.coords.latitude, pos.coords.longitude);

        // Transporteur : envoyer la position au backend
        if (this.debut && this.roleUtilisateur === 'transporteur' && this.transactionId) {
          this.transactionSvc.envoyerPosition(
            this.transactionId,
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0
          ).subscribe({ error: () => {} });
        }
      }
    });

    // Acheteur/Producteur : polling de la position du transporteur toutes les 5s
    if (this.roleUtilisateur !== 'transporteur' && this.transactionId) {
      this.posSub = this.transactionSvc
        .suivrePositionEnTempsReel(this.transactionId, this.destroy$)
        .subscribe({
          next: (pos: any) => {
            if (pos?.latitude && pos?.longitude) {
              this.updateMapPosition(pos.latitude, pos.longitude);
              this.gps.speed$.next(pos.vitesse || 0);
            }
          },
          error: () => {}
        });
    }
  }

  // ────────────────────────────────────────────────────────
  // GRAPHE VILLES CAMEROUN (Dijkstra)
  // ────────────────────────────────────────────────────────
  private construireGrapheVilles(): void {
    const villes: GraphNode[] = [
      { id: 'douala',    lat: 4.051,  lng: 9.768,  voisins: [{ id: 'bafoussam', poids: 240 }, { id: 'yaounde', poids: 250 }] },
      { id: 'yaounde',   lat: 3.848,  lng: 11.502, voisins: [{ id: 'douala', poids: 250 }, { id: 'ebolowa', poids: 160 }, { id: 'bertoua', poids: 350 }] },
      { id: 'bafoussam', lat: 5.476,  lng: 10.417, voisins: [{ id: 'douala', poids: 240 }, { id: 'bamenda', poids: 90 }] },
      { id: 'bamenda',   lat: 5.960,  lng: 10.160, voisins: [{ id: 'bafoussam', poids: 90 } ] },
      { id: 'garoua',    lat: 9.301,  lng: 13.397, voisins: [{ id: 'ngaoundere', poids: 220 }] },
      { id: 'ngaoundere',lat: 7.322,  lng: 13.584, voisins: [{ id: 'garoua', poids: 220 }, { id: 'bertoua', poids: 400 }] },
      { id: 'bertoua',   lat: 4.586,  lng: 13.685, voisins: [{ id: 'yaounde', poids: 350 }, { id: 'ngaoundere', poids: 400 }] },
      { id: 'ebolowa',   lat: 2.900,  lng: 11.150, voisins: [{ id: 'yaounde', poids: 160 }] },
    ];
    villes.forEach(v => this.graphVilles.set(v.id, v));
  }

  /** Calcule et affiche le chemin Dijkstra entre deux villes */
  calculerChemin(departNom: string, arriveeNom: string): void {
    const depId  = departNom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const arrId  = arriveeNom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (!this.graphVilles.has(depId) || !this.graphVilles.has(arrId)) {
      console.warn(`Villes non trouvées dans le graphe: ${depId} → ${arrId}`);
      return;
    }

    this.cheminOptimal = dijkstra(this.graphVilles, depId, arrId);
    console.log('Chemin Dijkstra:', this.cheminOptimal.join(' → '));
    this.dessinerChemin();
  }

  private dessinerChemin(): void {
    if (!this.map || this.cheminOptimal.length < 2) return;

    const coords = this.cheminOptimal
      .map(id => this.graphVilles.get(id))
      .filter(Boolean)
      .map(n => [n!.lat, n!.lng]);

    if (this.routePolyline) this.map.removeLayer(this.routePolyline);

    import('leaflet').then(L => {
      this.routePolyline = L.polyline(coords as any, {
        color: '#00c853',
        weight: 5,
        opacity: 0.8,
        dashArray: '10 6'
      }).addTo(this.map);

      this.map.fitBounds(this.routePolyline.getBounds(), { padding: [30, 30] });
    });
  }

  // ────────────────────────────────────────────────────────
  // CARTE LEAFLET
  // ────────────────────────────────────────────────────────
  private initMap(L: any): void {
    const cameroun: [number, number] = [3.848, 11.502];
    this.map = L.map('map', { zoomControl: false }).setView(cameroun, 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Icône transporteur (camion vert)
    const iconTransporteur = L.divIcon({
      html: `<div style="background:#00c853;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
               <i class="fas fa-truck" style="color:white;font-size:14px;"></i>
             </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      className: ''
    });

    this.markerTransporteur = L.marker(cameroun, { icon: iconTransporteur }).addTo(this.map);

    setTimeout(() => this.map.invalidateSize(), 200);
  }

  private updateMapPosition(lat: number, lng: number): void {
    if (!this.map || !this.markerTransporteur) return;
    this.markerTransporteur.setLatLng([lat, lng]);
    if (this.isFirstPosition) {
      this.map.setView([lat, lng], 14);
      this.isFirstPosition = false;
    } else {
      this.map.panTo([lat, lng]);
    }
  }

  // ────────────────────────────────────────────────────────
  // CONTRÔLES TRANSPORTEUR
  // ────────────────────────────────────────────────────────

  /** Bouton DÉMARRER — uniquement transporteur + date atteinte */
  get peutDemarrer(): boolean {
    if (this.roleUtilisateur !== 'transporteur') return false;
    return this.transactionSvc.estDateDepartAtteinte(this.dateDepart);
  }

  /** Vrai si le suivi est visible côté acheteur/producteur */
  get enLecture(): boolean {
    return this.roleUtilisateur !== 'transporteur';
  }

  demarrerTrajet(): void {
    if (!this.peutDemarrer) return;
    this.debut = true;
    this.gps.startTracking();

    if (this.transactionId) {
      this.transactionSvc.demarrerSuivi(this.transactionId).subscribe({
        next: () => console.log('✅ Suivi démarré sur le serveur'),
        error: () => {}
      });
    }
  }

  arreterTrajet(): void {
    this.debut = false;
    this.gps.stopTracking();
  }

  terminerLivraison(): void {
    if (!this.transactionId) return;
    this.transactionSvc.terminerLivraison(this.transactionId).subscribe({
      next: () => {
        this.debut = false;
        this.gps.stopTracking();
        console.log('✅ Livraison terminée');
      },
      error: () => {}
    });
  }

  setMode(mode: string): void { this.activeMode = mode; }

  ngOnDestroy(): void {
    if (this.gpsSub) this.gpsSub.unsubscribe();
    if (this.posSub) this.posSub.unsubscribe();
    if (this.positionInterval) clearInterval(this.positionInterval);
    if (this.map) this.map.remove();
    this.destroy$.next();
    this.destroy$.complete();
    this.gps.stopTracking();
  }
}