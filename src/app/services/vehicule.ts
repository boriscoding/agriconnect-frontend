import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Vehicule {
  private apiUrl = 'http://localhost:8080/api/vehicules';

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
  // CORRECTION : On s'assure que le FormData utilise les clés SQL vues dans tes logs
// vehicule.ts
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
  // services/vehicule.ts
getPhotoUrl(photoName: string | undefined): string {
  const serverIp = 'localhost'; // Assure-toi que c'est le même partout
  if (!photoName || photoName === 'null') {
    return 'assets/images/default-truck.png';
  }
  if (photoName.startsWith('http')) {
    return photoName;
  }
  return `http://${serverIp}:8080/uploads/${photoName}`;
}

}