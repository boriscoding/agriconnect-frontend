import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment'; // 👈 Import de l'environnement dynamique

// Interface alignée sur ton entité Java 'DemandesAcheteur'
export interface DemandeData {
  id?: number;
  libeller: string;   // Correspond à setLibeller() côté Java
  quantite_c: number; // Correspond à setQuantite_c() côté Java
  statut?: string;
  acheteurId?: number;
  offreId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class Demande{ // ✅ Nom de classe mis à jour proprement

  // 👈 URL dynamique : s'ajuste automatiquement selon l'environnement (Local vs Render)
  private apiUrl = `${environment.apiUrl}/demandes`; 

  constructor(private http: HttpClient) { }

  /**
   * Récupérer les demandes d'un acheteur spécifique
   * Appelé par : this.demandeService.getMesDemandes(id)
   */
  getMesDemandes(acheteurId: number): Observable<DemandeData[]> {
    return this.http.get<DemandeData[]>(`${this.apiUrl}/acheteur/${acheteurId}`);
  }

  /**
   * Publier une demande (Achat direct depuis une offre)
   * Utilise HttpParams car ton Java utilise @RequestParam
   */
  publierDemande(libelle: string, quantite: number, acheteurId: number, offreId: number): Observable<DemandeData> {
    const params = new HttpParams()
      .set('libelle', libelle)
      .set('quantite', quantite.toString())
      .set('acheteurId', acheteurId.toString())
      .set('offreId', offreId.toString());

    // Le deuxième argument {} est le corps (body) de la requête, ici vide.
    return this.http.post<DemandeData>(`${this.apiUrl}/creer`, {}, { params });
  }

  /**
   * Récupérer toutes les demandes (pour le marché global)
   */
  getToutes(): Observable<DemandeData[]> {
    return this.http.get<DemandeData[]>(this.apiUrl);
  }

  /**
   * Modifier une demande existante
   */
  modifier(id: number, data: DemandeData): Observable<DemandeData> {
    return this.http.put<DemandeData>(`${this.apiUrl}/modifier/${id}`, data);
  }

  /**
   * Supprimer une demande
   */
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/supprimer/${id}`);
  }
}