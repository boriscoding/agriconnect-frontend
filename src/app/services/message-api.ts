import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
  photosuser?: string;
  online?: boolean;
}

export interface Partage {
  id?: number;
  initiateurId: number;
  beneficiaireId: number;
  tiersId: number;
  dateDebutAcces: string;
}

export interface PartageInvitePayload {
  partageId?: number;
  initiateurId: number;
  initiateurNom: string;
  beneficiaireId: number;
  tiersId: number;
  dateDebutAcces: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessageApi {

  private readonly API_URL = `${environment.apiUrl}/api/messages`;

  constructor(private http: HttpClient) { }

  /** ENVOI DE MESSAGES */

  envoyer(formData: FormData): Observable<any> {
    return this.http.post(`${this.API_URL}/envoyer`, formData);
  }

  transfererMessage(messageId: number, expediteurId: number, destinataireId: number): Observable<Message> {
    const params = new HttpParams()
      .set('messageId', messageId.toString())
      .set('expediteurId', expediteurId.toString())
      .set('destinataireId', destinataireId.toString());

    return this.http.post<Message>(`${this.API_URL}/transferer`, null, { params });
  }

  /** RÉCUPÉRATION DES MESSAGES */

  getMessagesEntre(u1: number, u2: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/conversation?u1=${u1}&u2=${u2}`);
  }

  getDernierMessage(u1: number, u2: number): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/dernier-echange?u1=${u1}&u2=${u2}`);
  }

  getMessagesRecus(destinataireId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/recus/${destinataireId}`);
  }

  /** ACCUSÉS DE LECTURE */

  /** Marque comme lus tous les messages envoyés par `expediteurId` vers
   *  `lecteurId` (l'utilisateur qui vient d'ouvrir la conversation).
   *  Le backend notifie l'expéditeur en temps réel via WebSocket. */
  marquerConversationCommeLue(expediteurId: number, lecteurId: number): Observable<void> {
    const params = new HttpParams()
      .set('expediteurId', expediteurId.toString())
      .set('lecteurId', lecteurId.toString());
    return this.http.put<void>(`${this.API_URL}/conversation/lu`, null, { params });
  }

  /** PRÉSENCE EN LIGNE */

  /** Liste des IDs actuellement connectés, à charger une fois à l'ouverture
   *  du chat (les mises à jour suivantes arrivent via /topic/presence). */
  getUtilisateursEnLigne(): Observable<number[]> {
    return this.http.get<number[]>(`${environment.apiUrl}/api/presence/en-ligne`);
  }

  /** GESTION DES CONTACTS */

  getContactsActifs(userId: number): Observable<Contact[]> {
    return this.http.get<Contact[]>(`${this.API_URL}/contacts/${userId}`);
  }

  /** MODIFICATION ET SUPPRESSION */

  modifierMessage(id: number, contenu: string): Observable<Message> {
    return this.http.put<Message>(`${this.API_URL}/modifier/${id}`, contenu);
  }

  supprimerMessage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  getContactByEmail(email: string): Observable<Contact> {
    const searchUrl = `${environment.apiUrl}/api/utilisateurs/search`;
    const params = new HttpParams().set('email', email);
    return this.http.get<Contact>(searchUrl, { params });
  }

  // 🤝 1. Créer un partage de discussion
  creerPartage(initiateurId: number, beneficiaireId: number, tiersId: number, dateDebut: string): Observable<Partage> {
    const params = new HttpParams()
      .set('initiateurId', initiateurId)
      .set('beneficiaireId', beneficiaireId)
      .set('tiersId', tiersId)
      .set('dateDebut', dateDebut);

    return this.http.post<Partage>(`${this.API_URL}/partage/creer`, null, { params, withCredentials: true });
  }

  // 🕵️‍♂️ 2. Récupérer la conversation partagée et anonymisée
  getConversationPartagee(beneficiaireId: number, initiateurId: number, tiersId: number): Observable<any[]> {
    const params = new HttpParams()
      .set('beneficiaireId', beneficiaireId)
      .set('initiateurId', initiateurId)
      .set('tiersId', tiersId);

    return this.http.get<any[]>(`${this.API_URL}/partage/conversation`, { params, withCredentials: true });
  }

  // ✍️ 3. Envoyer un message en tant que délégué
  envoyerMessageDelegue(beneficiaireId: number, initiateurId: number, destinataireId: number, contenu: string): Observable<Message> {
    const params = new HttpParams()
      .set('beneficiaireId', beneficiaireId)
      .set('initiateurId', initiateurId)
      .set('destinataireId', destinataireId)
      .set('contenu', contenu);

    return this.http.post<Message>(`${this.API_URL}/partage/envoyer`, null, { params, withCredentials: true });
  }
}