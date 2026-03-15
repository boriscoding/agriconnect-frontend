import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OffreData {
  id?: number;
  nproduit: string;
  type_pro: string;
  prixUnitaire: number;
  quantiteProduit: number;
  description: string;
  lieuProduction: string;
  photo: string;
  statut: string;     // <-- AJOUTÉ ICI pour corriger l'erreur NG9
  region?: string;    // Optionnel
  uniteMesure?: string; // Optionnel
  producteur?: { 
    id: number; 
    nom: string; 
    photosuser?: string 
  };
}

@Injectable({ providedIn: 'root' })
export class OffreService {
  private apiUrl = 'http://localhost:8080/api/offres';

  constructor(private http: HttpClient) {}

  creerOffre(formData: FormData): Observable<OffreData> {
    return this.http.post<OffreData>(`${this.apiUrl}/publier`, formData);
  }

  getAllOffres(): Observable<OffreData[]> {
    return this.http.get<OffreData[]>(`${this.apiUrl}/toutes`);
  }

  getOffresByProducteur(producteurId: number): Observable<OffreData[]> {
    return this.http.get<OffreData[]>(`${this.apiUrl}/producteur/${producteurId}`);
  }
// --- NOUVELLE MÉTHODE : MODIFIER ---
  modifierOffre(id: number, offre: OffreData): Observable<OffreData> {
    // On envoie une requête PUT à l'URL : http://localhost:8080/api/offres/modifier/ID
    return this.http.put<OffreData>(`${this.apiUrl}/modifier/${id}`, offre);
  }

  // --- NOUVELLE MÉTHODE : SUPPRIMER ---
  supprimerOffre(id: number): Observable<void> {
    // On envoie une requête DELETE à l'URL : http://localhost:8080/api/offres/supprimer/ID
    return this.http.delete<void>(`${this.apiUrl}/supprimer/${id}`);
  }
}