import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment'; // 👈 Import de l'environnement

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
  // ✅ Utilisation de environment.apiUrl pour s'affranchir de localhost en production/mobile
  private readonly API_URL = `${environment.apiUrl}/messages`;

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

  // Recherche d'un contact par e-mail
  getContactByEmail(email: string): Observable<Contact> {
    // ✅ URL mise à jour avec environment.apiUrl
    const searchUrl = `${environment.apiUrl}/utilisateurs/search`;
    const params = new HttpParams().set('email', email);
    
    return this.http.get<Contact>(searchUrl, { params });
  }
}