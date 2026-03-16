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
  private readonly serverIp = 'localhost';
  private apiUrl = `http://${this.serverIp}:8080/api/offres`;

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

  // --- MODIFIER ---
  modifierOffre(id: number, offre: OffreData): Observable<OffreData> {
    return this.http.put<OffreData>(`${this.apiUrl}/modifier/${id}`, offre);
  }

  // --- SUPPRIMER ---
  supprimerOffre(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/supprimer/${id}`);
  }
}