import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment'; // 👈 Import de l'environnement dynamique

// --- INTERFACE OFFREDATA ---
export interface OffreData {
  id?: number;
  nproduit: string;
  type_pro: string;
  prixUnitaire: number;
  quantiteProduit: number;
  description: string;
  lieuProduction: string;
  photo: string;
  statut: string; 
  region?: string; 
  uniteMesure?: string; 
  producteur?: { 
    id: number; 
    nom: string; 
    photosuser?: string 
  };
}

@Injectable({ providedIn: 'root' })
export class OffreService {
  
  // 👈 URLs dynamiques : s'ajustent automatiquement selon l'environnement (Local vs Render)
  private apiUrl = `${environment.apiUrl}/api/offres`;
  private colisUrl = `${environment.apiUrl}/api/colis`;
  private paiementUrl = `${environment.apiUrl}/api/paiement`;

  constructor(private http: HttpClient) {}

  // Utilise cette méthode centralisée pour tes appels
  finaliserCommande(donnees: any): Observable<any> {
    return this.http.post<any>(`${this.colisUrl}/commander`, donnees);
  }

  creerOffre(formData: FormData): Observable<OffreData> {
    return this.http.post<OffreData>(`${this.apiUrl}/publier`, formData);
  }

  getAllOffres(): Observable<OffreData[]> {
    return this.http.get<OffreData[]>(`${this.apiUrl}/toutes`);
  }

  getOffresByProducteur(producteurId: number): Observable<OffreData[]> {
    return this.http.get<OffreData[]>(`${this.apiUrl}/producteur/${producteurId}`);
  }

  // --- MODIFIER ---
  modifierOffre(id: number, offre: OffreData): Observable<OffreData> {
    return this.http.put<OffreData>(`${this.apiUrl}/modifier/${id}`, offre);
  }

  // --- SUPPRIMER ---
  supprimerOffre(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/supprimer/${id}`);
  }

  // ✅ Alias conservé pour compatibilité avec app-commande.ts ancien
  enregistrerTransactionFinale(commandeComplete: any): Observable<any> {
    return this.finaliserCommande(commandeComplete);
  }

  initierPaiement(infosPaiement: any): Observable<any> {
    // ⚠️ Cette méthode fait doublon avec Transaction.initierPaiement() qui construit
    // déjà un body complet aligné sur PaiementController. Préférez celle-ci si possible.
    return this.http.post(`${this.paiementUrl}/initier`, infosPaiement);
  }
}