import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment'; // 👈 Import de l'environnement dynamique

@Injectable({
  providedIn: 'root',
})
export class Vehicule {
  
  // 👈 URL dynamique : s'ajuste automatiquement selon l'environnement (Local vs Render)
  private apiUrl = `${environment.apiUrl}/vehicules`;

  constructor(private http: HttpClient) {}

  // --- 1. RÉCUPÉRER TOUS LES VÉHICULES ---
  getToutes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/toutes`);
  }

  // --- 2. RÉCUPÉRER LES VÉHICULES D'UN TRANSPORTEUR ---
  getParTransporteur(transporteurId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/transporteur/${transporteurId}`);
  }

  // --- 3. ENREGISTRER (PUBLIER) UN VÉHICULE ---
  publier(formData: FormData): Observable<any> {
    // On envoie directement le formData reçu du composant
    return this.http.post<any>(`${this.apiUrl}/enregistrer`, formData);
  }

  // --- 4. MODIFIER UN VÉHICULE ---
  modifier(id: number, vehicule: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/modifier/${id}`, vehicule);
  }

  // --- 5. SUPPRIMER UN VÉHICULE ---
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/supprimer/${id}`);
  }

  // --- 6. TROUVER PAR ID ---
  getById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  // --- 7. URL DE LA PHOTO DU VÉHICULE ---
  getPhotoUrl(photoName: string | undefined): string {
    if (!photoName || photoName === 'null') {
      return 'assets/images/default-truck.png';
    }
    if (photoName.startsWith('http')) {
      return photoName;
    }
    
    // Extrait l'URL de base du serveur en supprimant '/api' à la fin de environment.apiUrl
    const serverBaseUrl = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${serverBaseUrl}/uploads/${photoName}`;
  }
}