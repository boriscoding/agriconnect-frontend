import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Message {
  id?: number;
  contenu: string;
  expediteurId: number;
  destinataireId: number;
  mediaUrl?: string;
  mediaType: string;
  timestamp?: string;
  isMe?: boolean; 
}

export interface Contact {
  id: number;
  nom: string;
  prenom?: string;
  email?: string;
  photoUrl?: string;
  online?: boolean; 
}

@Injectable({
  providedIn: 'root'
})
export class MessageApi {
  // ✅ ADRESSE IP RÉSEAU (10.177.225.196)
  private readonly serverIp = 'localhost';
  private readonly API_URL = `http://${this.serverIp}:8080/api/messages`;
  private readonly url = `http://${this.serverIp}:8080/api/messages`;

  constructor(private http: HttpClient) { }

  // Envoi via FormData pour gérer texte + fichiers
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

  // Récupérer la liste des contacts avec qui on a discuté
  getContactsActifs(userId: number) {
    return this.http.get<any[]>(`${this.url}/contacts/${userId}`);
  }

  // Récupérer l'historique complet entre deux utilisateurs
  getMessagesEntre(u1: number, u2: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.url}/conversation?u1=${u1}&u2=${u2}`);
  }
}