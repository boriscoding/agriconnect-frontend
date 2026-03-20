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
  publier(vehiculeData: any, photo: File): Observable<any> {
    const formData = new FormData();
    
    // Mapping exact avec tes colonnes Hibernate : charge_max, voiture_type, id_transporteur
    formData.append('marque', vehiculeData.marque);
    formData.append('model', vehiculeData.model);
    formData.append('immatriculation', vehiculeData.immatriculation);
    formData.append('charge_max', vehiculeData.chargeMax.toString());
    formData.append('voiture_type', vehiculeData.voitureType);
    formData.append('id_transporteur', vehiculeData.idTransporteur.toString());
    
    if (photo) {
      formData.append('photo', photo);
    }

    // Note : Vérifie si ton endpoint est /publier ou /enregistrer dans ton Controller Java
    return this.http.post<any>(`${this.apiUrl}/enregistrer`, formData);you
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

}