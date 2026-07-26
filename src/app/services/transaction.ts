import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, interval, Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class Transaction {

  private apiUrl   = 'http://localhost:8080/api/transactions';
  private paiemUrl = 'http://localhost:8080/api/paiement';

  readonly NUMERO_MARCHAND = '672017303';

  constructor(private http: HttpClient) {}

  // ── RECHERCHE ────────────────────────────────────────────────
  trouverTrajets(ville: string, poids: number): Observable<any[]> {
    const params = new HttpParams()
      .set('ville', ville)
      .set('poids', poids.toString());
    return this.http.get<any[]>(`${this.apiUrl}/trouver-trajets`, { params });
  }

  create(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  getById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  // ── PAIEMENT MONETBIL ────────────────────────────────────────
  /**
   * Initie un paiement Monetbil.
   * Le backend crée la commande en PENDING,
   * retourne { payment_url, transactionId }
   */
  initierPaiement(donnees: {
    montant:                number;
    telephone:              string;
    operateur:              'ORANGE' | 'MTN';
    description:            string;
    nomAcheteur?:           string;
    emailAcheteur?:         string;
    // ── Infos commande complètes ──
    offreId:                number;
    quantite:               number;
    acheteurId:             number;
    villeDestination:       string;
    nomDestinataire:        string;
    telephoneDestinataire:  string;
    choixColis:             string;
    selectedColisId?:       number | null;
    nomNouveauColis?:       string;
    dateDepartChoisie:      string;
    transactionExistanteId?: number | null;
    vehiculeId?:            number | null;
    transporteurId?:        number | null;
  }): Observable<any> {
    return this.http.post<any>(`${this.paiemUrl}/initier`, {
      ...donnees,
      numeroMarchand: this.NUMERO_MARCHAND
    });
  }

  verifierPaiement(reference: string): Observable<any> {
    return this.http.get<any>(`${this.paiemUrl}/verifier/${reference}`);
  }

  /**
   * Appelé au retour de Monetbil pour finaliser la commande.
   * Le backend vérifie le paiement et crée la transaction complète.
   */
  finaliserApresPaiement(reference: string): Observable<any> {
    return this.http.post<any>(`${this.paiemUrl}/finaliser`, { reference });
  }

  // ── SUIVI GPS ────────────────────────────────────────────────
  demarrerSuivi(transactionId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${transactionId}/demarrer`, {});
  }

  envoyerPosition(transactionId: number, lat: number, lng: number, vitesse: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${transactionId}/position`, {
      latitude:  lat,
      longitude: lng,
      vitesse,
      timestamp: new Date().toISOString()
    });
  }

  getPositionTransporteur(transactionId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${transactionId}/position`);
  }

  suivrePositionEnTempsReel(transactionId: number, destroy$: Subject<void>): Observable<any> {
    return interval(5000).pipe(
      takeUntil(destroy$),
      switchMap(() => this.getPositionTransporteur(transactionId))
    );
  }

  terminerLivraison(transactionId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${transactionId}/terminer`, {});
  }

  estDateDepartAtteinte(dateDepart: string | null): boolean {
    if (!dateDepart) return false;
    const margeMs = 30 * 60 * 1000;
    return new Date().getTime() >= (new Date(dateDepart).getTime() - margeMs);
  }
}