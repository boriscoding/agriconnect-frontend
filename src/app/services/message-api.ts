import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MessageApi {
  private readonly API_URL = 'http://localhost:8080/api/messages';

  constructor(private http: HttpClient) {}

  // Envoi via FormData pour gérer texte + fichiers (images/audio)
  envoyer(formData: FormData): Observable<any> {
    return this.http.post(`${this.API_URL}/envoyer`, formData);
  }

  // Récupérer les messages reçus par un utilisateur
  getMessagesRecus(destinataireId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/recus/${destinataireId}`);
  }

  // Récupérer les messages envoyés par un utilisateur
  getMessagesEnvoyes(expediteurId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/envoyes/${expediteurId}`);
  }
}