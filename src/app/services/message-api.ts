import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  photosuser?: string; // Ajouté pour correspondre à ton entité Java
  online?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MessageApi {
  // ✅ Configuration de l'adresse du serveur
  private readonly serverIp = 'localhost';
  private readonly API_URL = `http://${this.serverIp}:8080/api/messages`;

  constructor(private http: HttpClient) { }

  /** * ENVOI DE MESSAGES 
   */

  // Envoi via FormData pour gérer texte + fichiers (images, vidéos, audio)
  envoyer(formData: FormData): Observable<any> {
    return this.http.post(`${this.API_URL}/envoyer`, formData);
  }

  // Transférer un message existant vers un nouveau destinataire
  transfererMessage(messageId: number, expediteurId: number, destinataireId: number): Observable<Message> {
    const params = new HttpParams()
      .set('messageId', messageId.toString())
      .set('expediteurId', expediteurId.toString())
      .set('destinataireId', destinataireId.toString());
    
    return this.http.post<Message>(`${this.API_URL}/transferer`, null, { params });
  }

  /** * RÉCUPÉRATION DES MESSAGES 
   */

  // Récupérer l'historique complet entre deux utilisateurs (u1 et u2)
  getMessagesEntre(u1: number, u2: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/conversation?u1=${u1}&u2=${u2}`);
  }

  // Récupérer le tout dernier message échangé entre deux personnes (pour la liste des contacts)
  getDernierMessage(u1: number, u2: number): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/dernier-echange?u1=${u1}&u2=${u2}`);
  }

  // Récupérer les messages reçus par un utilisateur spécifique
  getMessagesRecus(destinataireId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/recus/${destinataireId}`);
  }

  /** * GESTION DES CONTACTS 
   */

  // Récupérer la liste des contacts avec qui l'utilisateur a déjà discuté
  getContactsActifs(userId: number): Observable<Contact[]> {
    return this.http.get<Contact[]>(`${this.API_URL}/contacts/${userId}`);
  }

  /** * MODIFICATION ET SUPPRESSION 
   */

  modifierMessage(id: number, contenu: string): Observable<Message> {
    // On envoie le contenu directement si ton backend l'attend en tant que String simple
    return this.http.put<Message>(`${this.API_URL}/modifier/${id}`, contenu);
  }

  supprimerMessage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }
  // Dans ton fichier message-api.ts
getContactByEmail(email: string): Observable<Contact> {
  // On change l'URL pour pointer vers le UtilisateurController (/api/utilisateurs/search)
  const searchUrl = `http://${this.serverIp}:8080/api/utilisateurs/search`;
  const params = new HttpParams().set('email', email);
  
  return this.http.get<Contact>(searchUrl, { params });
}
}