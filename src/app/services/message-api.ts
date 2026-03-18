  import { Injectable } from '@angular/core';
  import { HttpClient , HttpParams } from '@angular/common/http';
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
    // Dans message-api.ts
  supprimerMessage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  modifierMessage(id: number, contenu: string): Observable<Message> {
    return this.http.put<Message>(`${this.API_URL}/modifier/${id}`, contenu);
  }
  // --- NOUVELLE MÉTHODE : TRANSFERER ---
  transfererMessage(messageId: number, expediteurId: number, destinataireId: number): Observable<Message> {
    const params = new HttpParams()
      .set('messageId', messageId.toString())
      .set('expediteurId', expediteurId.toString())
      .set('destinataireId', destinataireId.toString());
    
    return this.http.post<Message>(`${this.API_URL}/transferer`, null, { params });
  }
  getDernierMessage(u1: number, u2: number) {
  return this.http.get<any>(`${this.API_URL}/dernier-echange?u1=${u1}&u2=${u2}`);
}
  }