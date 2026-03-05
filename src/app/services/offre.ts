import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class Offre {
  // L'URL de base définie dans ton @RequestMapping au niveau du Controller
  private apiUrl = 'http://localhost:8080/api/offres';

  constructor(private http: HttpClient) {}

  // POST : Créer une offre
  // Changement : /creer -> /publier pour correspondre au @PostMapping("/publier")
  creerOffre(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/publier`, formData);
  }

  // GET : Toutes les offres
  // Changement : apiUrl -> apiUrl + /toutes pour correspondre au @GetMapping("/toutes")
  getAllOffres(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/toutes`);
  }

  // DELETE : Supprimer une offre
  supprimerOffre(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // GET : Offres par producteur
  getOffresByProducteur(producteurId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/producteur/${producteurId}`);
  }
}