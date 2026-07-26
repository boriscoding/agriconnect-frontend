import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  // ✅ REMPLACEMENT PAR L'IP RÉSEAU
 private readonly serverIp = 'localhost'; // À changer par ton IP si tu testes sur mobile
  private apiUrl = `http://${this.serverIp}:8080/api/offres`;
  private colisUrl = `http://${this.serverIp}:8080/api/colis`; // Ajout de l'URL pour les colis

  constructor(private http: HttpClient) {}

  // ... (autres méthodes)

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
    return this.http.post(`${this.apiUrl}/paiement/init`, infosPaiement);
  }
}