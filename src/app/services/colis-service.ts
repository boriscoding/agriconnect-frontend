import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Interface CommandeOffreDTO
 * Elle doit correspondre exactement aux noms des champs de ta classe Java
 * pour que la sérialisation JSON fonctionne correctement.
 */
export interface CommandeOffreDTO {
  offreId: number;
  producteurId: number;
  
  // Gestion du Colis
  colisId?: number | null;           // Si existant
  nomNouveauColis?: string | null;   // Si création
  villeDepart?: string;
  villeArrivee?: string;

  // Gestion de la Transaction (Voyage)
  transactionId?: number | null;
  dateDepart?: string | null;
  
  // Logistique
  vehiculeId?: number | null;
  transporteurId?: number | null;
  poidsTotalOffre?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ColisService {
  
  // URL de ton API Spring Boot (ajuste le port si nécessaire, ex: 8080)
  private apiUrl = 'http://localhost:8080/api/colis'; 

  constructor(private http: HttpClient) { }

  /**
   * Récupère la liste de tous les colis.
   * Utile pour afficher les colis existants du producteur dans la modale.
   */
  getAllColis(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  /**
   * MÉTHODE CRUCIALE : Envoie la commande finalisée au Backend.
   * @param dto L'objet contenant toutes les infos (Offre + Colis + Transaction)
   */
  traiterCommande(dto: CommandeOffreDTO): Observable<any> {
    console.log("Données envoyées au serveur (DTO) :", dto);
    // On appelle l'endpoint @PostMapping("/commander") de ton contrôleur Java
    return this.http.post<any>(`${this.apiUrl}/commander`, dto);
  }

  /**
   * Récupère les détails d'un colis spécifique.
   */
  getColisById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  /**
   * Supprime un colis (en cas d'annulation par exemple).
   */
  deleteColis(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}