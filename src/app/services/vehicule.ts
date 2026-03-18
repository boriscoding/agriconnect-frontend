import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Vehicule {
  // ✅ Remplace par l'IP de ton serveur si tu testes sur mobile
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
  // On utilise FormData car le backend attend un MultipartFile (photo)
  publier(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/publier`, formData);
  }

  // --- 4. MODIFIER UN VÉHICULE ---
  // On envoie un objet JSON simple ici pour correspondre au @RequestBody Java
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

}