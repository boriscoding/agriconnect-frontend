import {
  Component, OnInit, Inject, PLATFORM_ID,
  ViewChild, ElementRef, OnDestroy, HostListener
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { MessageApi, Partage, PartageInvitePayload } from '../services/message-api';
import { Auth } from '../services/auth';
import { NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { environment } from '../../environments/environment';
import {
  trigger, transition, style, animate, query, stagger
} from '@angular/animations';
export interface Contact {
  id: number;
  nom: string;
  prenom?: string;
  email?: string;
  photosuser?: string;
  online?: boolean;
  dernierMessage?: any;
}

/** État de l'appel audio en cours. */
type CallState = 'idle' | 'outgoing' | 'incoming' | 'active';

/** Message de signalisation WebRTC transporté sur le canal STOMP. */
interface CallSignal {
  type: 'OFFER' | 'ANSWER' | 'ICE' | 'END' | 'BUSY' | 'DECLINE';
  fromId: number;
  toId: number;
  fromNom?: string;
  fromPrenom?: string;
  fromPhoto?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

@Component({
  selector: 'app-logi-chat',
  standalone: false,
  templateUrl: './logi-chat.html',
  styleUrl: './logi-chat.css',
  animations: [
    trigger('listAnimation', [
      transition('* <=> *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(16px)' }),
          stagger('60ms', [
            animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('bubbleIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.82) translateY(8px)' }),
        animate('180ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          style({ opacity: 1, transform: 'scale(1) translateY(0)' }))
      ])
    ]),
    trigger('drawerSlide', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0.4 }),
        animate('220ms cubic-bezier(0.16, 1, 0.3, 1)', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('180ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class LogiChat implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;
  @ViewChild('remoteAudio') private remoteAudioRef!: ElementRef<HTMLAudioElement>;
  @ViewChild('profilePhotoInput') private profilePhotoInput!: ElementRef;

  // ─── Données ──────────────────────────────────────────────
serverUrl: string = environment.apiUrl;
  searchTerm: string    = '';
  contacts: Contact[]   = [];
  filteredContacts: Contact[] = [];
  newMessage: string    = '';
  messages: any[]       = [];
  currentUserId: number = 0;
  selectedContactId: number | null = null;
  selectedContact: Contact | null  = null;
  isChatActive: boolean = false;
// --- VARIABLES POUR LA DÉLÉGATION / PARTAGE DE DISCUSSION ---
  showShareModal: boolean = false;
  beneficiaireSelectionne: number | null = null;
  dateDebutPartage: string = '';
  partageEnCours: boolean = false;
  // Liste déroulante du modal de partage (recalculée à l'ouverture, cf. ouvrirModalePartage())
  mesContacts: Contact[] = [];

  /**
   * Représente la conversation actuellement affichée quand elle est consultée
   * PAR DÉLÉGATION (l'utilisateur courant est le bénéficiaire d'un partage).
   * null = conversation normale (l'utilisateur courant est l'un des deux interlocuteurs).
   */
  activePartage: Partage | null = null;
  // ─── État UI ───────────────────────────────────────────────
  showNewChatModal: boolean = false;
  emailSearch: string       = '';
  activeMenuIndex: number   = -1;
  showTransferModal         = false;
  messageToTransfer: any    = null;

  // ─── Typing indicator ──────────────────────────────────────
  isContactTyping: boolean  = false;
  private typingTimeout: any;

  // ─── Médias ────────────────────────────────────────────────
  selectedFile: File | null    = null;
  mediaPreviewUrl: any         = null;
  previewType: 'IMAGE' | 'VIDEO' | 'AUDIO' | null = null;
  mediaRecorder: any;
  audioChunks: any[]    = [];
  isRecording: boolean  = false;
  recordingStream?: MediaStream;

  // ─── Modale zoom ───────────────────────────────────────────
  selectedMedia: any   = null;
  zoomLevel: number    = 1;
  recentMedias: any[]  = [];

  // ─── Panneau "Infos du contact" ─────────────────────────────
  showContactPanel: boolean = false;

  // ─── Gestion du profil (utilisateur connecté) ───────────────
  showProfileDrawer: boolean = false;
  profileUser: any            = {};
  profileLoading              = false;
  profileSaving                = false;
  profilePhotoFile: File | null = null;
  profilePhotoPreview: string | ArrayBuffer | null = null;

  // ─── Appel audio (WebRTC + signalisation STOMP) ─────────────
  callState: CallState = 'idle';
  callContact: Contact | null = null;
  isMuted: boolean       = false;
  isSpeakerOn: boolean   = false;
  callDurationSec: number = 0;
  callDurationLabel: string = '00:00';
  private apiUrl = environment.apiUrl;
  private callTimer: any;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // ─── WebSocket ─────────────────────────────────────────────
  private stompClient: any;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private sanitizer:    DomSanitizer,
    private messageApi:   MessageApi,
    private authService:  Auth,
    private zone:         NgZone,
    private route:        ActivatedRoute,
    private router:       Router,
    private http:         HttpClient
  ) {}

  // ─── Init ──────────────────────────────────────────────────
  ngOnInit(): void {
    const userId = this.authService.getUserId();
    if (userId && userId > 0) {
      this.currentUserId = Number(userId);
      this.chargerListeContacts();
      this.chargerMonProfil();

      if (isPlatformBrowser(this.platformId)) {
        this.initialiserSocket();
      }

      // Deep linking depuis une offre
      this.route.queryParams.subscribe(params => {
        const contactId  = params['contactId'];
        const messageAuto = params['message'];
        if (contactId) {
          const contactTemp: Contact = { id: +contactId, nom: 'Chargement...', online: false };
          this.selectContact(contactTemp);
          if (messageAuto) this.newMessage = messageAuto;
          this.router.navigate([], { relativeTo: this.route, queryParams: {} });
        }
      });

    } else {
      console.warn('Aucune session trouvée — redirection vers login');
      this.router.navigate(['/login']);
    }
  }

ngOnDestroy(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
    }
    this.teardownCall();
  }

  
  // ─── WebSocket ─────────────────────────────────────────────
  initialiserSocket(): void {
    this.zone.runOutsideAngular(() => {
      // Configuration moderne du client STOMP avec SockJS
      this.stompClient = new Client({
        webSocketFactory: () => new SockJS(`${environment.apiUrl}/ws-chat`),        debug: (str) => {
          // Décommentez la ligne suivante si vous souhaitez voir les logs en dev
          // console.log(str);
        },
        reconnectDelay: 5000,
        onConnect: (frame) => {
          this.stompClient.subscribe('/topic/messages', (payload: any) => {
            this.zone.run(() => this.onMessageReceived(JSON.parse(payload.body)));
          });

          // Canal personnel de signalisation d'appel (offre/réponse/ICE/fin).
          // Convention : le backend relaie tout message publié sur
          // /app/call.signal vers /topic/call.{toId}.
          this.stompClient.subscribe(`/topic/call.${this.currentUserId}`, (payload: any) => {
            this.zone.run(() => this.onCallSignal(JSON.parse(payload.body)));
          });
        },
      });

      this.stompClient.activate();
    });
  }

  onMessageReceived(msg: any): void {
    // Message d'invitation à un partage de discussion, destiné à moi : je le laisse
    // passer dans la conversation normale avec l'initiateur, il sera affiché comme
    // une carte spéciale (cf. mapSingleMessage / accepterPartage).
    const expediteurId   = Number(msg.expediteur);
    const destinataireId = Number(msg.destinataire);

    if (this.activePartage) {
      // ─── Je consulte une conversation par délégation ───
      // Les messages de CE fil concernent l'initiateur et le tiers, jamais moi.
      const concerneCeFil =
        (expediteurId === this.activePartage.initiateurId && destinataireId === this.activePartage.tiersId) ||
        (expediteurId === this.activePartage.tiersId && destinataireId === this.activePartage.initiateurId);

      if (concerneCeFil) {
        const existeDeja = this.messages.find(m => m.id === msg.id);
        if (!existeDeja) {
          // "isMe" = affiché côté droit = écrit par/pour le compte de l'initiateur
          // (c'est ce compte que j'incarne pendant la délégation).
          this.messages.push(this.buildDisplayMessage(msg, expediteurId === this.activePartage.initiateurId));
          this.autoScroll();
        }
      }
      return;
    }

    // ─── Conversation normale (je suis l'un des deux interlocuteurs) ───
    const isPourMoi = destinataireId === this.currentUserId;
    const isDeMoi    = expediteurId   === this.currentUserId;

    if (!isPourMoi && !isDeMoi) return;

    const interlocuteurId = isDeMoi ? destinataireId : expediteurId;

    if (interlocuteurId === this.selectedContactId) {
      const existeDeja = this.messages.find(m => m.id === msg.id);
      if (!existeDeja) {
        this.messages.push(this.buildDisplayMessage(msg, isDeMoi));
        this.autoScroll();
      }
    }
    this.chargerListeContacts();
  }

  /** Construit l'objet d'affichage d'un message reçu en direct (WebSocket),
   *  en gérant le cas spécial de l'invitation de partage. */
  private buildDisplayMessage(msg: any, isMe: boolean): any {
    const base: any = {
      id:       msg.id,
      text:     msg.contenu,
      time:     this.formatDate(msg.timestamp),
      isMe,
      type:     msg.mediaType || 'TEXT',
      mediaUrl: msg.mediaUrl,
      read:     false
    };
    if (base.type === 'PARTAGE_INVITE') {
      base.sharePayload = this.parseSharePayload(msg.contenu);
    }
    return base;
  }

  private parseSharePayload(contenu: string): PartageInvitePayload | null {
    try {
      return JSON.parse(contenu);
    } catch {
      return null;
    }
  }

  // ─── Contacts ──────────────────────────────────────────────
  chargerListeContacts(): void {
    this.messageApi.getContactsActifs(this.currentUserId).subscribe({
      next: (data: Contact[]) => {
        this.contacts         = data;
        this.filteredContacts = [...this.contacts];

        this.contacts.forEach(contact => {
          this.messageApi.getDernierMessage(this.currentUserId, contact.id).subscribe({
            next: (msg) => {
              contact.dernierMessage = msg;
              if (this.searchTerm) this.filterContacts();
            }
          });
        });
      },
      error: (err) => console.error('Erreur chargement contacts', err)
    });
  }

  filterContacts(): void {
    const search = this.searchTerm?.toLowerCase().trim() || '';
    if (!search) { this.filteredContacts = [...this.contacts]; return; }
    this.filteredContacts = this.contacts.filter(c => {
      const nom    = (c.nom    || '').toLowerCase();
      const prenom = (c.prenom || '').toLowerCase();
      return nom.includes(search) || prenom.includes(search);
    });
  }

  selectContact(contact: Contact): void {
    // On quitte toute vue déléguée : c'est une conversation normale, où l'utilisateur
    // courant est bien l'un des deux interlocuteurs.
    this.activePartage     = null;

    this.selectedContactId = contact.id;
    this.selectedContact   = contact;
    this.isChatActive      = true;
    this.messages          = [];
    this.activeMenuIndex   = -1;
    this.showContactPanel  = false;

    this.messageApi.getMessagesEntre(this.currentUserId, contact.id).subscribe({
      next: (data) => {
        this.messages = (data || []).map(msg => this.mapSingleMessage(msg));
        this.autoScroll();
      }
    });
  }

  creerNouvelleDiscussion(): void {
    if (!this.emailSearch.trim()) return;
    this.messageApi.getContactByEmail(this.emailSearch.trim()).subscribe({
      next: (contact) => {
        if (!this.contacts.find(c => c.id === contact.id)) {
          this.contacts.unshift(contact);
          this.filterContacts();
        }
        this.selectContact(contact);
        this.showNewChatModal = false;
        this.emailSearch      = '';
      },
      error: () => alert('Aucun utilisateur trouvé avec cet email sur AgriConnect.')
    });
  }

  // ─── Messages ──────────────────────────────────────────────
  sendMessage(): void {
    if (!this.newMessage.trim() && !this.selectedFile) return;

    // ─── Envoi en tant que délégué (partage de discussion actif) ───
    if (this.activePartage) {
      if (this.selectedFile) {
        alert("L'envoi de photos/vidéos/vocaux n'est pas disponible dans une discussion déléguée.");
        return;
      }
      if (!this.newMessage.trim()) return;

      const texte = this.newMessage;
      this.messageApi.envoyerMessageDelegue(
        this.activePartage.beneficiaireId,
        this.activePartage.initiateurId,
        this.activePartage.tiersId,
        texte
      ).subscribe({
        next: (res: any) => {
          const existeDeja = this.messages.find(m => m.id === res.id);
          if (!existeDeja) {
            this.messages.push({
              id: res.id,
              text: res.contenu ?? texte,
              time: this.formatDate(res.timestamp),
              isMe: true,
              type: 'TEXT',
              mediaUrl: null,
              read: false
            });
            this.autoScroll();
          }
          this.newMessage = '';
        },
        error: () => alert("Le message n'a pas pu être envoyé (le partage a peut-être expiré).")
      });
      return;
    }

    // ─── Envoi normal ───
    if (!this.selectedContactId) return;

    const formData = new FormData();
    formData.append('contenu',         this.newMessage);
    formData.append('expediteurId',    this.currentUserId.toString());
    formData.append('destinataireId',  this.selectedContactId.toString());
    formData.append('mediaType',       this.selectedFile ? this.previewType! : 'TEXT');
    if (this.selectedFile) formData.append('file', this.selectedFile);

    this.messageApi.envoyer(formData).subscribe({
      next: (res) => {
        if (this.stompClient?.connected) {
          this.stompClient.publish({
            destination: '/app/chat.sendMessage',
            body: JSON.stringify(res)
          });
        }
        this.newMessage = '';
        this.cancelPreview();
      },
      error: () => alert("Le message n'a pas pu être envoyé.")
    });
  }

  modifierMessage(msg: any): void {
    const nouveauTexte = prompt('Modifier le message :', msg.text || msg.contenu);
    if (!nouveauTexte?.trim()) return;
    this.messageApi.modifierMessage(msg.id, nouveauTexte).subscribe({
      next: () => {
        const idx = this.messages.findIndex(m => m.id === msg.id);
        if (idx !== -1) { this.messages[idx].text = nouveauTexte; }
        this.activeMenuIndex = -1;
      }
    });
  }

  supprimerMessage(id: number, index: number): void {
    if (!confirm('Supprimer ce message ?')) return;
    this.messageApi.supprimerMessage(id).subscribe({
      next: () => { this.messages.splice(index, 1); this.activeMenuIndex = -1; }
    });
  }

  transfererMessage(msg: any): void {
    this.messageToTransfer = msg;
    this.showTransferModal  = true;
    this.activeMenuIndex    = -1;
  }

  confirmTransfer(contactId: number): void {
    // ✅ CORRECTION : utilise this.currentUserId au lieu du hardcodé 1
    this.messageApi.transfererMessage(this.messageToTransfer.id, this.currentUserId, contactId)
      .subscribe({
        next: () => {
          this.showTransferModal  = false;
          this.messageToTransfer  = null;
        }
      });
  }

  toggleMessageMenu(index: number): void {
    this.activeMenuIndex = (this.activeMenuIndex === index) ? -1 : index;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.message-options-trigger')) {
      this.activeMenuIndex = -1;
    }
  }

  // ─── Médias ────────────────────────────────────────────────
  triggerImageUpload(): void { this.fileInput.nativeElement.click(); }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    this.selectedFile  = file;
    this.previewType   = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
    const reader       = new FileReader();
    reader.onload      = (e: any) => {
      this.mediaPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  cancelPreview(): void {
    this.selectedFile    = null;
    this.mediaPreviewUrl = null;
    this.previewType     = null;
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  async startVoiceRecord(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isRecording ? this.stopRecording() : await this.startRecording();
  }

  private async startRecording(): Promise<void> {
    try {
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType       = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      this.mediaRecorder   = new MediaRecorder(this.recordingStream, { mimeType });
      this.audioChunks     = [];
      this.mediaRecorder.ondataavailable = (e: any) => this.audioChunks.push(e.data);
      this.mediaRecorder.onstop = () => {
        const blob         = new Blob(this.audioChunks, { type: mimeType });
        this.selectedFile  = new File([blob], 'vocal.webm', { type: mimeType });
        this.previewType   = 'AUDIO';
        this.mediaPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blob));
        this.recordingStream?.getTracks().forEach(t => t.stop());
      };
      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (e) { console.error('Erreur microphone', e); }
  }

  private stopRecording(): void {
    if (this.mediaRecorder) { this.mediaRecorder.stop(); this.isRecording = false; }
  }

  // ─── Modale zoom ───────────────────────────────────────────
  openMediaModal(msg: any): void {
    this.selectedMedia = msg;
    this.zoomLevel     = 1;
    this.recentMedias  = this.messages.filter(m => m.type === 'IMAGE' || m.type === 'VIDEO');
  }

  closeMediaModal(): void { this.selectedMedia = null; this.zoomLevel = 1; }

  zoomIn(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.zoomLevel < 3) this.zoomLevel = Math.round((this.zoomLevel + 0.2) * 10) / 10;
  }

  zoomOut(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.zoomLevel > 0.4) this.zoomLevel = Math.round((this.zoomLevel - 0.2) * 10) / 10;
  }

  downloadMedia(media: any, event?: MouseEvent): void {
    event?.stopPropagation();
    const link    = document.createElement('a');
    link.href     = media.mediaUrl;
    link.download = `media_${media.id || Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ─── Panneau "Infos du contact" ─────────────────────────────
  openContactPanel(): void {
    if (!this.selectedContact) return;
    this.showContactPanel = true;
  }

  closeContactPanel(): void {
    this.showContactPanel = false;
  }

  getContactPhotoUrl(contact?: Contact | null): string {
    if (!contact) return '';
    if (contact.photosuser) return `${this.apiUrl}${contact.photosuser}`;
    const label = `${contact.prenom || ''}+${contact.nom || ''}`;
    return `https://ui-avatars.com/api/?name=${label}&background=25a244&color=fff&size=200`;
  }

  // ─── Gestion du profil (utilisateur connecté) ───────────────
  chargerMonProfil(): void {
    if (!this.currentUserId) return;
    this.profileLoading = true;
    // ⚠️ Adaptez cette route à votre contrôleur si nécessaire.
    this.http.get(`${this.apiUrl}/api/utilisateurs/${this.currentUserId}`)
      .subscribe({
        next: (data: any) => { this.profileUser = data || {}; this.profileLoading = false; },
        error: (err) => { console.error('Erreur chargement profil', err); this.profileLoading = false; }
      });
  }

  openMyProfile(): void {
    this.profilePhotoFile    = null;
    this.profilePhotoPreview = null;
    this.showProfileDrawer   = true;
    if (!this.profileUser?.id) this.chargerMonProfil();
  }

  closeMyProfile(): void {
    this.showProfileDrawer = false;
  }

  triggerProfilePhotoUpload(): void {
    this.profilePhotoInput?.nativeElement.click();
  }

  onProfilePhotoSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    this.profilePhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => this.profilePhotoPreview = e.target.result;
    reader.readAsDataURL(file);
  }

  getProfilePhotoUrl(): string {
    if (this.profilePhotoPreview) return this.profilePhotoPreview as string;
    if (this.profileUser?.photosuser) return `${this.apiUrl}${this.profileUser.photosuser}`;
    const label = `${this.profileUser?.prenom || ''}+${this.profileUser?.nom || ''}`;
    return `https://ui-avatars.com/api/?name=${label}&background=25a244&color=fff&size=200`;
  }

  saveMyProfile(): void {
    if (!this.currentUserId) return;
    this.profileSaving = true;

    const formData = new FormData();
    if (this.profilePhotoFile) formData.append('file', this.profilePhotoFile);
    formData.append('nom',   this.profileUser.nom   || '');
    formData.append('localisation', this.profileUser.localisation || '');
    formData.append('sexe', this.profileUser.sexe || 'M'); // requis par UtilisateurController, jamais omis
    formData.append('number', (this.profileUser.number || 0).toString()); // jamais '', sinon 400 côté Spring
    // ⚠️ 'prenom' et 'email' ne sont PAS acceptés par UtilisateurController.modifierProfil()
    // (seuls nom, localisation, sexe, number, file sont lus côté serveur) : les envoyer ici
    // ne fait rien et n'est pas une erreur, mais ne les modifie pas non plus.

    // UtilisateurController est mappé sur /api/utilisateurs
    const url = `${this.apiUrl}/api/utilisateurs/modifier/${this.currentUserId}`;

    this.http.put(url, formData).subscribe({
      next: (res: any) => {
        this.profileUser         = res || this.profileUser;
        this.profileSaving       = false;
        this.profilePhotoFile    = null;
        this.profilePhotoPreview = null;
        this.showProfileDrawer   = false;
      },
      error: (err) => {
        console.error('Erreur mise à jour profil', err);
        this.profileSaving = false;
        alert("La mise à jour du profil a échoué.");
      }
    });
  }

  // ─── Appel audio (WebRTC) ────────────────────────────────────
  /** Démarre un appel sortant vers le contact actuellement sélectionné. */
  async startAudioCall(): Promise<void> {
    if (!this.selectedContact || this.callState !== 'idle') return;
    if (!isPlatformBrowser(this.platformId)) return;

    this.callContact = this.selectedContact;
    this.callState    = 'outgoing';

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.createPeerConnection();
      this.localStream.getTracks().forEach(track => this.peerConnection!.addTrack(track, this.localStream!));

      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);

      this.sendCallSignal({
        type: 'OFFER',
        fromId: this.currentUserId,
        toId: this.callContact.id,
        fromNom: this.profileUser?.nom,
        fromPrenom: this.profileUser?.prenom,
        fromPhoto: this.profileUser?.photosuser,
        sdp: offer,
      });
    } catch (e) {
      console.error('Erreur démarrage appel', e);
      this.teardownCall();
      alert("Impossible d'accéder au microphone.");
    }
  }

  /** Accepte un appel entrant. */
  async acceptCall(): Promise<void> {
    if (this.callState !== 'incoming' || !this.callContact) return;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.localStream.getTracks().forEach(track => this.peerConnection!.addTrack(track, this.localStream!));

      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);

      this.sendCallSignal({
        type: 'ANSWER',
        fromId: this.currentUserId,
        toId: this.callContact.id,
        sdp: answer,
      });

      this.flushPendingIceCandidates();
      this.callState = 'active';
      this.startCallTimer();
    } catch (e) {
      console.error('Erreur acceptation appel', e);
      this.declineCall();
    }
  }

  /** Refuse un appel entrant. */
  declineCall(): void {
    if (this.callContact) {
      this.sendCallSignal({ type: 'DECLINE', fromId: this.currentUserId, toId: this.callContact.id });
    }
    this.teardownCall();
  }

  /** Termine un appel en cours (sortant, entrant ou actif). */
  endCall(): void {
    if (this.callContact) {
      this.sendCallSignal({ type: 'END', fromId: this.currentUserId, toId: this.callContact.id });
    }
    this.teardownCall();
  }

  toggleMute(): void {
    if (!this.localStream) return;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(track => (track.enabled = !this.isMuted));
  }

  /** Bascule le rendu audio (haut-parleur) via l'API setSinkId lorsqu'elle est disponible. */
  async toggleSpeaker(): Promise<void> {
    const audioEl = this.remoteAudioRef?.nativeElement as any;
    if (!audioEl?.setSinkId) {
      // Non supporté par ce navigateur : on inverse juste l'état visuel du bouton.
      this.isSpeakerOn = !this.isSpeakerOn;
      return;
    }
    try {
      this.isSpeakerOn = !this.isSpeakerOn;
      await audioEl.setSinkId(this.isSpeakerOn ? 'default' : 'communications');
    } catch (e) {
      console.warn('Changement de sortie audio non supporté', e);
    }
  }

  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (this.remoteAudioRef?.nativeElement) {
        this.remoteAudioRef.nativeElement.srcObject = remoteStream;
        this.remoteAudioRef.nativeElement.play().catch(() => {});
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.callContact) {
        this.sendCallSignal({
          type: 'ICE',
          fromId: this.currentUserId,
          toId: this.callContact.id,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.zone.run(() => this.teardownCall());
      }
    };
  }

  private sendCallSignal(signal: CallSignal): void {
    if (!this.stompClient?.connected) {
      console.warn('Signalisation impossible : WebSocket non connecté');
      return;
    }
    this.stompClient.publish({
      destination: '/app/call.signal',
      body: JSON.stringify(signal),
    });
  }

  /** Traite un signal d'appel reçu du serveur. */
  private async onCallSignal(signal: CallSignal): Promise<void> {
    if (Number(signal.toId) !== this.currentUserId) return;

    switch (signal.type) {
      case 'OFFER': {
        if (this.callState !== 'idle') {
          // Déjà en communication : on signale l'occupation à l'appelant.
          this.stompClient?.publish({
            destination: '/app/call.signal',
            body: JSON.stringify({ type: 'BUSY', fromId: this.currentUserId, toId: signal.fromId }),
          });
          return;
        }

        this.callContact = this.contacts.find(c => c.id === signal.fromId) || {
          id: signal.fromId,
          nom: signal.fromNom || 'Contact',
          prenom: signal.fromPrenom || '',
          photosuser: signal.fromPhoto,
        };
        this.callState = 'incoming';

        this.createPeerConnection();
        if (signal.sdp) {
          await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
        break;
      }

      case 'ANSWER': {
        if (signal.sdp && this.peerConnection) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          this.flushPendingIceCandidates();
          this.callState = 'active';
          this.startCallTimer();
        }
        break;
      }

      case 'ICE': {
        if (!signal.candidate) return;
        if (this.peerConnection?.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          this.pendingIceCandidates.push(signal.candidate);
        }
        break;
      }

      case 'DECLINE':
      case 'BUSY':
      case 'END': {
        this.teardownCall();
        break;
      }
    }
  }

  private async flushPendingIceCandidates(): Promise<void> {
    if (!this.peerConnection) return;
    for (const candidate of this.pendingIceCandidates) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
    this.pendingIceCandidates = [];
  }

  private startCallTimer(): void {
    this.callDurationSec = 0;
    this.callDurationLabel = '00:00';
    this.callTimer = setInterval(() => {
      this.zone.run(() => {
        this.callDurationSec++;
        const m = Math.floor(this.callDurationSec / 60).toString().padStart(2, '0');
        const s = (this.callDurationSec % 60).toString().padStart(2, '0');
        this.callDurationLabel = `${m}:${s}`;
      });
    }, 1000);
  }

  /** Réinitialise complètement l'état d'appel et libère les ressources. */
  private teardownCall(): void {
    if (this.callTimer) { clearInterval(this.callTimer); this.callTimer = null; }

    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;

    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.remoteAudioRef?.nativeElement) {
      this.remoteAudioRef.nativeElement.srcObject = null;
    }

    this.pendingIceCandidates = [];
    this.callState       = 'idle';
    this.callContact     = null;
    this.isMuted          = false;
    this.isSpeakerOn      = false;
    this.callDurationSec  = 0;
    this.callDurationLabel = '00:00';
  }

  // ─── Utilitaires ───────────────────────────────────────────
  getActiveContact(): Contact | undefined {
    return this.contacts.find(c => c.id === this.selectedContactId);
  }

  openChat():  void { this.isChatActive = true; }
  closeChat(): void { this.isChatActive = false; }

  private mapSingleMessage(msg: any) {
    const isMe = Number(msg.expediteurId || msg.expediteur) === this.currentUserId;
    let url    = msg.mediaUrl;
    if (url && !url.startsWith('http')) url = `${this.apiUrl}${url}`;
    const mapped: any = {
      id:       msg.id,
      text:     msg.contenu,
      time:     this.formatDate(msg.timestamp || msg.dateEnvoi),
      isMe,
      type:     msg.mediaType || 'TEXT',
      mediaUrl: url,
      read:     msg.lu || false
    };
    if (mapped.type === 'PARTAGE_INVITE') {
      mapped.sharePayload = this.parseSharePayload(msg.contenu);
    }
    return mapped;
  }

  /** Mappe un message renvoyé par /partage/conversation (déjà anonymisé côté serveur). */
  private mapPartageMessage(msg: any) {
    const expediteurId = Number(msg.expediteur?.id ?? msg.expediteur);
    const isMe = !!this.activePartage && expediteurId === this.activePartage.initiateurId;
    let url = msg.mediaUrl;
    if (url && !url.startsWith('http')) url = `${this.apiUrl}${url}`;
    return {
      id:       msg.id,
      text:     msg.contenu,
      time:     this.formatDate(msg.timestamp),
      isMe,
      type:     msg.mediaType || 'TEXT',
      mediaUrl: url,
      read:     false
    };
  }

  private autoScroll(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if (this.myScrollContainer) {
          this.myScrollContainer.nativeElement.scrollTop =
            this.myScrollContainer.nativeElement.scrollHeight;
        }
      }, 80);
    }
  }
  // Émet l'événement "en train d'écrire" via WebSocket
 onMessageInput(): void {
    if (this.stompClient?.connected && this.selectedContactId) {
      this.stompClient.publish({
        destination: '/app/chat.typing',
        body: JSON.stringify({
          senderId: this.currentUserId,
          receiverId: this.selectedContactId
        })
      });
    }
  }

  // Gère la réception de l'indicateur typing
  onTypingReceived(data: { senderId: number }): void {
    if (data.senderId === this.selectedContactId) {
      this.isContactTyping = true;
      if (this.typingTimeout) clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => {
        this.isContactTyping = false;
      }, 3000);
    }
  }

  playAudio(event: MouseEvent, msg: any): void {
  event.stopPropagation();
  const audio = new Audio(msg.mediaUrl);
  audio.play().catch(e => console.error('Erreur lecture audio', e));
}

  private formatDate(dateStr: string): string {
    if (!dateStr) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  // ─── Partage de discussion ───────────────────────────────────
  /** Vrai si la conversation affichée est consultée par délégation. */
  isDelegatedView(): boolean {
    return !!this.activePartage;
  }

  /** Contacts proposables comme bénéficiaires : ni moi, ni le tiers de la discussion actuelle. */
  getBeneficiairesDisponibles(): Contact[] {
    const tiersId = this.getActiveContact()?.id;
    return (this.contacts || []).filter(c => c.id !== this.currentUserId && c.id !== tiersId);
  }

  /**
   * Ouvre la modale de partage et initialise la date et la liste des bénéficiaires possibles.
   */
  ouvrirModalePartage(): void {
    if (this.isDelegatedView()) return; // on ne repartage pas une discussion déjà déléguée
    if (!this.getActiveContact()) return;

    this.showShareModal = true;
    this.beneficiaireSelectionne = null;

    // Initialise l'heure actuelle par défaut pour le début de l'accès
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    this.dateDebutPartage = now.toISOString().slice(0, 16);

    this.mesContacts = this.getBeneficiairesDisponibles();
  }

  /**
   * Envoie la requête de partage au backend, puis notifie le bénéficiaire par un
   * message spécial (mediaType "PARTAGE_INVITE") dans SA discussion avec moi.
   * L'identité du tiers n'est jamais incluse dans cette invitation.
   */
  validerPartage(): void {
    const activeContact = this.getActiveContact();
    if (!this.beneficiaireSelectionne || !this.dateDebutPartage || !activeContact || !this.currentUserId) {
      return;
    }

    const initiateurId   = this.currentUserId;
    const beneficiaireId = this.beneficiaireSelectionne;
    const tiersId         = activeContact.id;
    const dateDebut        = this.dateDebutPartage + ':00'; // ajoute les secondes pour LocalDateTime

    this.partageEnCours = true;

    this.messageApi.creerPartage(initiateurId, beneficiaireId, tiersId, dateDebut).subscribe({
      next: (partage) => {
        this.envoyerInvitationPartage({
          partageId:      partage?.id,
          initiateurId,
          initiateurNom:  `${this.profileUser?.prenom || ''} ${this.profileUser?.nom || ''}`.trim() || 'Un collègue',
          beneficiaireId,
          tiersId,
          dateDebutAcces: dateDebut
        });
      },
      error: (err) => {
        console.error('Erreur lors du partage :', err);
        this.partageEnCours = false;
        alert("Une erreur est survenue lors de la délégation de l'accès.");
      }
    });
  }

  /** Envoie le message d'invitation qui permettra au bénéficiaire de découvrir le partage. */
  private envoyerInvitationPartage(payload: PartageInvitePayload): void {
    const formData = new FormData();
    formData.append('contenu',        JSON.stringify(payload));
    formData.append('expediteurId',   payload.initiateurId.toString());
    formData.append('destinataireId', payload.beneficiaireId.toString());
    formData.append('mediaType',      'PARTAGE_INVITE');

    this.messageApi.envoyer(formData).subscribe({
      next: () => {
        this.partageEnCours          = false;
        this.showShareModal          = false;
        this.beneficiaireSelectionne = null;
        alert('Accès délégué avec succès à ce collègue !');
      },
      error: (err) => {
        console.error("Le partage a été créé mais l'invitation n'a pas pu être envoyée :", err);
        this.partageEnCours = false;
        this.showShareModal = false;
        alert("L'accès a été créé, mais la notification à votre collègue a échoué. Prévenez-le manuellement.");
      }
    });
  }

  /**
   * Appelé quand le bénéficiaire clique sur la carte d'invitation reçue dans le chat.
   * Bascule l'écran vers la conversation déléguée : contact affiché "masqué",
   * messages chargés via l'endpoint anonymisé.
   */
  accepterPartage(msg: any): void {
    const payload: PartageInvitePayload | null = msg?.sharePayload;
    if (!payload) return;
    this.ouvrirConversationPartagee(payload);
  }

  private ouvrirConversationPartagee(payload: PartageInvitePayload): void {
    this.activePartage = {
      id: payload.partageId,
      initiateurId: payload.initiateurId,
      beneficiaireId: this.currentUserId,
      tiersId: payload.tiersId,
      dateDebutAcces: payload.dateDebutAcces
    };

    // Le tiers reste anonyme pour moi : aucune info personnelle ne doit apparaître ici.
    this.selectedContact = {
      id: payload.tiersId,
      nom: 'Masqué',
      prenom: 'Contact',
      online: false
    };
    this.selectedContactId = payload.tiersId;
    this.isChatActive      = true;
    this.messages          = [];
    this.showContactPanel  = false;

    this.chargerConversationPartagee();
  }

  /** Recharge la conversation déléguée en cours (messages filtrés et anonymisés côté serveur). */
  chargerConversationPartagee(): void {
    if (!this.activePartage) return;
    const { beneficiaireId, initiateurId, tiersId } = this.activePartage;

    this.messageApi.getConversationPartagee(beneficiaireId, initiateurId, tiersId).subscribe({
      next: (messages) => {
        this.messages = (messages || []).map(m => this.mapPartageMessage(m));
        this.autoScroll();
      },
      error: (err) => {
        this.messages = [];
        if (err.status === 403) {
          alert("Accès refusé : ce partage de discussion est expiré ou inexistant.");
        } else {
          console.error('Erreur chargement conversation partagée', err);
        }
        this.quitterPartage();
      }
    });
  }

  /** Quitte la vue déléguée et revient à la liste des discussions normales. */
  quitterPartage(): void {
    this.activePartage     = null;
    this.selectedContact   = null;
    this.selectedContactId = null;
    this.messages          = [];
    this.isChatActive      = false;
  }
}