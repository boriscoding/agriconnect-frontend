import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment'; // 👈 Import de l'environnement dynamique

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

/** Un partage de discussion actif : A (initiateur) donne accès à B (bénéficiaire)
 *  à sa discussion avec C (tiers), à partir d'une date donnée. */
export interface Partage {
  id?: number;
  initiateurId: number;
  beneficiaireId: number;
  tiersId: number;
  dateDebutAcces: string; // format LocalDateTime ISO, ex: "2026-09-01T10:30:00"
}

/** Charge utile embarquée dans le message d'invitation (mediaType = PARTAGE_INVITE)
 *  envoyé au bénéficiaire pour qu'il découvre le partage. Ne contient JAMAIS
 *  l'identité du tiers : c'est justement ce qui doit rester caché. */
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
  
  // 👈 URL dynamique basée sur environment.apiUrl (Local vs Render)
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

  getContactByEmail(email: string): Observable<Contact> {
    // 👈 URL dynamique pointant vers le UtilisateurController (/api/utilisateurs/search)
    const searchUrl = `${environment.apiUrl}/utilisateurs/search`;
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

  // ✍️ 3. Envoyer un message en tant que délégué (au nom de l'initiateur, vers le tiers)
  envoyerMessageDelegue(beneficiaireId: number, initiateurId: number, destinataireId: number, contenu: string): Observable<Message> {
    const params = new HttpParams()
      .set('beneficiaireId', beneficiaireId)
      .set('initiateurId', initiateurId)
      .set('destinataireId', destinataireId)
      .set('contenu', contenu);

    return this.http.post<Message>(`${this.API_URL}/partage/envoyer`, null, { params, withCredentials: true });
  }
}