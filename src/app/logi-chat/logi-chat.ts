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
import { ToastrService } from 'ngx-toastr';
import { forkJoin, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
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
  previewContact: Contact | null = null;
  searchingPreview: boolean = false;
  emailSearchAttempted: boolean = false;
  private emailSearchDebounce: any;
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

  // ─── Lecture des vocaux ────────────────────────────────────
  playingMsgId: number | string | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  // ─── Pièces jointes ────────────────────────────────────────
  /** Doit rester <= à spring.servlet.multipart.max-file-size côté backend. */
  private readonly MAX_UPLOAD_MB = 50;
  private previewObjectUrl: string | null = null;

  // ─── Clavier mobile (visualViewport) ───────────────────────
  private viewportCleanup: (() => void) | null = null;
  private lastViewportHeight = 0;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private sanitizer:    DomSanitizer,
    private messageApi:   MessageApi,
    private authService:  Auth,
    private zone:         NgZone,
    private route:        ActivatedRoute,
    private router:       Router,
    private http:         HttpClient,
    private toastr:       ToastrService
  ) {}

  // ─── Init ──────────────────────────────────────────────────
  ngOnInit(): void {
    this.initViewportWatcher();
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
    this.stopCurrentAudio();
    this.viewportCleanup?.();
    this.releasePreviewUrl();
  }

  
  // ─── WebSocket ─────────────────────────────────────────────
  initialiserSocket(): void {
    this.zone.runOutsideAngular(() => {
      // Configuration moderne du client STOMP avec SockJS
      this.stompClient = new Client({
        webSocketFactory: () => new SockJS(`${environment.apiUrl}/ws-chat`),
        // Le userId est transmis à la connexion STOMP pour que le backend
        // puisse l'associer à la session WebSocket (nécessaire pour la présence
        // en ligne/hors ligne : voir PresenceWebSocketListener côté serveur).
        connectHeaders: { userId: this.currentUserId.toString() },
        debug: (str) => {
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

          // Présence : le backend publie {userId, online} à chaque connexion/déconnexion.
          this.stompClient.subscribe('/topic/presence', (payload: any) => {
            this.zone.run(() => this.onPresenceUpdate(JSON.parse(payload.body)));
          });

          // Accusé de lecture : quand MON correspondant ouvre la conversation
          // et lit mes messages, le backend publie ici pour que je bascule
          // instantanément mes coches vertes/oranges en rouge.
          this.stompClient.subscribe(`/topic/messages/lu/${this.currentUserId}`, (payload: any) => {
            this.zone.run(() => this.onAccuseDeLecture(JSON.parse(payload.body)));
          });
        },
      });

      this.stompClient.activate();
    });
  }

  /** Un contact vient de se connecter ou de se déconnecter. */
  private onPresenceUpdate(evt: { userId: number; online: boolean }): void {
    const maj = (c: Contact) => { if (c.id === evt.userId) c.online = evt.online; };
    this.contacts.forEach(maj);
    this.filteredContacts.forEach(maj);
    if (this.selectedContact?.id === evt.userId) this.selectedContact.online = evt.online;
  }

  /** Mon correspondant vient de lire mes messages : je passe leurs coches en rouge. */
  private onAccuseDeLecture(evt: { lecteurId: number }): void {
    if (this.selectedContactId === evt.lecteurId) {
      this.messages
        .filter(m => m.isMe && m.statut !== 'LU')
        .forEach(m => { m.statut = 'LU'; m.read = true; });
    }
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
      // ⚠️ Sans résolution, un média reçu EN DIRECT gardait un chemin relatif
      // (/uploads/...) interprété par rapport à Netlify → 404, alors que le
      // même message rechargé depuis l'historique fonctionnait.
      mediaUrl: this.resolveMediaUrl(msg.mediaUrl),
      read:     false,
      statut:   msg.livre ? 'DELIVRE' : 'ENVOYE'
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

        // On attend que TOUS les derniers messages soient chargés avant de trier,
        // pour éviter un tri partiel/instable pendant que les réponses arrivent
        // dans le désordre.
        const chargements = this.contacts.map(contact =>
          this.messageApi.getDernierMessage(this.currentUserId, contact.id).pipe(
            tap((msg) => { contact.dernierMessage = msg; }),
            catchError(() => of(null))
          )
        );

        if (chargements.length === 0) return;

        forkJoin(chargements).subscribe(() => {
          this.trierContactsParDateRecente();
          if (this.searchTerm) this.filterContacts();
        });

        // État initial de présence : les mises à jour suivantes arrivent
        // en temps réel via /topic/presence.
        this.messageApi.getUtilisateursEnLigne().subscribe({
          next: (idsEnLigne) => {
            const idsSet = new Set(idsEnLigne);
            this.contacts.forEach(c => c.online = idsSet.has(c.id));
            this.filteredContacts.forEach(c => c.online = idsSet.has(c.id));
            if (this.selectedContact) this.selectedContact.online = idsSet.has(this.selectedContact.id);
          },
          error: () => {} // Pas bloquant : la présence en temps réel prendra le relais
        });
      },
      error: (err) => console.error('Erreur chargement contacts', err)
    });
  }

  /** Trie contacts (et filteredContacts) par date du dernier message,
   *  du plus récent au plus ancien. Les contacts sans aucun message
   *  passent en fin de liste. */
  private trierContactsParDateRecente(): void {
    const timestamp = (c: Contact): number => {
      const t = c.dernierMessage?.timestamp;
      return t ? new Date(t).getTime() : 0;
    };
    this.contacts.sort((a, b) => timestamp(b) - timestamp(a));
    this.filteredContacts.sort((a, b) => timestamp(b) - timestamp(a));
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
    this.stopCurrentAudio();
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

        // On marque immédiatement comme lus tous les messages reçus de ce
        // contact : le backend enregistre le statut et prévient l'expéditeur
        // en temps réel (topic /topic/messages/lu/{expediteurId}) pour que
        // ses coches passent au rouge instantanément.
        this.messageApi.marquerConversationCommeLue(contact.id, this.currentUserId).subscribe({
          error: (err) => console.warn('Impossible de marquer la conversation comme lue', err)
        });
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
        this.previewContact   = null;
        this.emailSearchAttempted = false;
      },
      error: () => alert('Aucun utilisateur trouvé avec cet email sur AgriConnect.')
    });
  }

  /** Déclenchée à chaque frappe : recherche automatique (debounce 400ms)
   *  dès que le texte ressemble à un email complet. */
  onEmailSearchInput(): void {
    this.previewContact = null;
    this.emailSearchAttempted = false;
    clearTimeout(this.emailSearchDebounce);

    const valeur = this.emailSearch.trim();
    const ressembleAUnEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur);
    if (!ressembleAUnEmail) return;

    this.emailSearchDebounce = setTimeout(() => {
      this.searchingPreview = true;
      this.messageApi.getContactByEmail(valeur).subscribe({
        next: (contact) => {
          this.searchingPreview = false;
          this.emailSearchAttempted = true;
          // On ne propose pas de démarrer une discussion avec soi-même,
          // ni de renvoyer vers un contact déjà présent sans le signaler.
          this.previewContact = (contact.id === this.currentUserId) ? null : contact;
        },
        error: () => {
          this.searchingPreview = false;
          this.emailSearchAttempted = true;
          this.previewContact = null;
        }
      });
    }, 400);
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
      error: (err) => this.onSendError(err)
    });
  }

  /** Message d'erreur précis quand un envoi échoue (surtout pour les pièces jointes). */
  private onSendError(err: any): void {
    console.error('[Envoi message] échec', err);
    // Spring rejette un fichier trop gros AVANT d'atteindre le contrôleur, donc sans
    // en-têtes CORS : le navigateur voit alors un statut 0 ("erreur CORS") au lieu de 413.
    if (this.selectedFile && (err?.status === 0 || err?.status === 413)) {
      this.toastr.error('Envoi impossible : le fichier dépasse sans doute la taille maximale acceptée par le serveur.');
    } else {
      this.toastr.error("Le message n'a pas pu être envoyé.");
    }
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
    const file: File | undefined = event.target.files?.[0];
    if (!file) return;

    if (file.size > this.MAX_UPLOAD_MB * 1024 * 1024) {
      this.toastr.warning(`Fichier trop volumineux (maximum ${this.MAX_UPLOAD_MB} Mo).`);
      event.target.value = '';
      return;
    }

    this.releasePreviewUrl();
    this.selectedFile = file;
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp|avi|mkv)$/i.test(file.name);
    this.previewType = isVideo ? 'VIDEO' : 'IMAGE';

    // URL "blob:" : instantanée et sans copie en mémoire. L'ancien readAsDataURL
    // encodait TOUTE la vidéo en base64 (+33 %) dans une chaîne géante : sur
    // téléphone la mémoire saturait et l'aperçu ne s'affichait jamais.
    this.previewObjectUrl = URL.createObjectURL(file);
    this.mediaPreviewUrl  = this.sanitizer.bypassSecurityTrustUrl(this.previewObjectUrl);
  }

  cancelPreview(): void {
    this.selectedFile    = null;
    this.mediaPreviewUrl = null;
    this.previewType     = null;
    this.releasePreviewUrl();
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  private releasePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }

  async startVoiceRecord(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isRecording ? this.stopRecording() : await this.startRecording();
  }

  /**
   * Meilleur format d'enregistrement disponible sur CET appareil.
   * audio/mp4 (AAC) en premier : c'est le seul format lisible partout, iPhone compris.
   * Avant : seulement webm puis ogg, deux formats que Safari/iOS ne sait pas enregistrer,
   * et le fichier s'appelait toujours "vocal.webm" quel que soit son vrai contenu.
   */
  private pickRecorderMime(): string {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
    return candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? '';
  }

  private async startRecording(): Promise<void> {
    if (typeof MediaRecorder === 'undefined') {
      this.toastr.error("L'enregistrement vocal n'est pas supporté par ce navigateur.");
      return;
    }
    try {
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred    = this.pickRecorderMime();
      this.mediaRecorder = preferred
        ? new MediaRecorder(this.recordingStream, { mimeType: preferred })
        : new MediaRecorder(this.recordingStream);          // le navigateur choisit lui-même
      this.audioChunks   = [];

      // Type RÉEL produit par le navigateur (peut différer de celui demandé)
      const realMime = (this.mediaRecorder.mimeType || preferred || 'audio/webm').split(';')[0];
      const ext = realMime.includes('mp4') ? 'mp4'
                : realMime.includes('ogg') ? 'ogg'
                : realMime.includes('wav') ? 'wav' : 'webm';

      this.mediaRecorder.ondataavailable = (e: any) => { if (e.data?.size) this.audioChunks.push(e.data); };
      this.mediaRecorder.onstop = () => {
        this.recordingStream?.getTracks().forEach(t => t.stop());
        const blob = new Blob(this.audioChunks, { type: realMime });
        this.zone.run(() => {
          if (blob.size < 800) {                              // enregistrement vide / trop court
            this.toastr.warning('Vocal trop court : maintenez un peu plus longtemps.');
            return;
          }
          this.releasePreviewUrl();
          this.selectedFile     = new File([blob], `vocal-${Date.now()}.${ext}`, { type: realMime });
          this.previewType      = 'AUDIO';
          this.previewObjectUrl = URL.createObjectURL(blob);
          this.mediaPreviewUrl  = this.sanitizer.bypassSecurityTrustUrl(this.previewObjectUrl);
        });
      };
      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (e: any) {
      console.error('Erreur microphone', e);
      this.isRecording = false;
      this.toastr.error(e?.name === 'NotAllowedError'
        ? 'Accès au micro refusé : autorisez-le dans les réglages du navigateur.'
        : "Impossible de démarrer l'enregistrement vocal.");
    }
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
    const url  = this.resolveMediaUrl(msg.mediaUrl);
    const mapped: any = {
      id:       msg.id,
      text:     msg.contenu,
      time:     this.formatDate(msg.timestamp || msg.dateEnvoi),
      isMe,
      type:     msg.mediaType || 'TEXT',
      mediaUrl: url,
      read:     msg.lu || false,
      // 3 états : ENVOYE (coche verte) -> DELIVRE (coche orange, destinataire
      // en ligne mais n'a pas encore ouvert la conversation) -> LU (coche rouge).
      statut:   msg.lu ? 'LU' : (msg.livre ? 'DELIVRE' : 'ENVOYE')
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
    const url = this.resolveMediaUrl(msg.mediaUrl);
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

  // ─── Lecture des vocaux ────────────────────────────────────

  playAudio(event: MouseEvent, msg: any): void {
    event.stopPropagation();

    // Re-clic sur le vocal déjà chargé : pause / reprise
    if (this.playingMsgId === msg.id && this.currentAudio) {
      if (this.currentAudio.paused) {
        this.currentAudio.play().catch(() => {});
      } else {
        this.currentAudio.pause();
      }
      return;
    }

    this.stopCurrentAudio();                                  // un seul vocal à la fois

    const url = this.resolveMediaUrl(msg.mediaUrl);
    if (!url) {
      this.toastr.error('Ce message vocal ne contient aucun fichier audio.');
      return;
    }

    const audio = new Audio();
    audio.preload = 'auto';

    // Avant : `.catch(console.error)` → l'utilisateur n'entendait rien et ne voyait rien.
    let failed = false;
    const fail = (err?: any) => {
      if (failed) return;
      failed = true;
      console.error('[Vocal] lecture impossible', { url, mediaErrorCode: audio.error?.code, err });
      this.zone.run(() => {
        if (this.currentAudio === audio) this.stopCurrentAudio();
        this.toastr.error(err?.name === 'NotAllowedError'
          ? 'Le navigateur a bloqué la lecture. Appuyez de nouveau sur lecture.'
          : 'Impossible de lire ce vocal : fichier introuvable sur le serveur ou format non supporté par cet appareil.');
      });
    };

    const majDuree = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        msg.audioDurationLabel = this.formatAudioTime(audio.duration);
      }
    };

    audio.onplay           = () => this.zone.run(() => { msg.isPlaying = true; });
    audio.onpause          = () => this.zone.run(() => { msg.isPlaying = false; });
    audio.onended          = () => this.zone.run(() => this.stopCurrentAudio());
    audio.onerror          = () => fail();
    audio.onloadedmetadata = () => this.zone.run(majDuree);
    audio.ondurationchange = () => this.zone.run(majDuree);
    audio.ontimeupdate     = () => this.zone.run(() => {
      const total = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      msg.audioProgress = total ? audio.currentTime / total : 0;
      msg.audioLabel    = this.formatAudioTime(audio.currentTime);
    });

    this.currentAudio = audio;
    this.playingMsgId = msg.id;
    msg.audioProgress = 0;
    audio.src = url;
    audio.play().catch(err => fail(err));
  }

  private stopCurrentAudio(): void {
    const audio = this.currentAudio;
    if (audio) {
      // On détache les écouteurs AVANT pause()/load() pour éviter des rappels tardifs
      audio.onplay = audio.onpause = audio.onended = audio.onerror = null;
      audio.onloadedmetadata = audio.ondurationchange = audio.ontimeupdate = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    const msg = this.messages.find(m => m.id === this.playingMsgId);
    if (msg) {
      msg.isPlaying     = false;
      msg.audioProgress = 0;
      msg.audioLabel    = msg.audioDurationLabel || '';
    }
    this.currentAudio = null;
    this.playingMsgId = null;
  }

  private formatAudioTime(sec: number): string {
    const s = Math.max(0, Math.floor(sec || 0));
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }

  /**
   * Transforme n'importe quel format d'URL de média renvoyé par le backend en URL
   * absolue exploitable par <img>, <video> et <audio>. Gère :
   *  - "https://…"                  → inchangée
   *  - "http://localhost:8080/…"    → ré-aiguillée vers le backend courant (anciens messages créés en local)
   *  - "http://…" sur page HTTPS    → passée en https (sinon le navigateur bloque : "mixed content")
   *  - "/uploads/x.webm"            → préfixée par environment.apiUrl
   *  - "uploads/x.webm" ou "x.webm" → idem, en ajoutant le "/" ou le dossier /uploads manquant
   */
  private resolveMediaUrl(raw?: string | null): string {
    if (!raw || raw === 'null') return '';
    const base = (this.apiUrl || '').replace(/\/+$/, '');

    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        const urlLocale     = ['localhost', '127.0.0.1', '0.0.0.0'].includes(u.hostname);
        const backendLocal  = /localhost|127\.0\.0\.1/.test(base);
        if (urlLocale && !backendLocal) return `${base}${u.pathname}${u.search}`;
        if (u.protocol === 'http:' && !urlLocale && typeof window !== 'undefined' && window.location.protocol === 'https:') {
          u.protocol = 'https:';
          return u.toString();
        }
      } catch { /* URL invalide : renvoyée telle quelle */ }
      return raw;
    }

    let path = raw.startsWith('/') ? raw : `/${raw}`;
    if (!/^\/uploads\//i.test(path) && !path.includes('/', 1)) path = `/uploads${path}`;   // nom de fichier nu
    return `${base}${path}`;
  }

  // ─── Clavier mobile ────────────────────────────────────────

  /**
   * Sur iOS comme sur Chrome Android récent, le clavier ne redimensionne PAS la page : il se pose
   * par-dessus, et le champ de saisie (collé en bas) disparaît dessous. Ni 100vh ni 100dvh ne
   * tiennent compte du clavier : seul visualViewport donne la zone réellement visible.
   * On expose donc sa hauteur dans --app-vh, utilisée par le CSS du conteneur principal.
   */
  private initViewportWatcher(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const vv = window.visualViewport;
    if (!vv) return;                                          // vieux navigateur : le CSS (dvh/vh) prend le relais

    const root = document.documentElement;
    this.lastViewportHeight = vv.height;
    root.style.setProperty('--app-vh', `${Math.round(vv.height)}px`);

    const update = () => {
      if (vv.scale > 1.01) return;                            // pincer pour zoomer ≠ clavier : on ne touche à rien
      const delta = this.lastViewportHeight - vv.height;      // > 0 : le clavier vient de s'ouvrir
      this.lastViewportHeight = vv.height;
      root.style.setProperty('--app-vh', `${Math.round(vv.height)}px`);

      if (window.scrollY !== 0) window.scrollTo(0, 0);        // iOS décale parfois toute la page vers le haut

      // Si on lisait le bas de la conversation, on y reste quand la zone rétrécit
      const el = this.myScrollContainer?.nativeElement as HTMLElement | undefined;
      if (el && delta > 0) {
        const etaitEnBas = el.scrollHeight - el.scrollTop - el.clientHeight - delta < 160;
        if (etaitEnBas) el.scrollTop = el.scrollHeight;
      }
    };

    this.zone.runOutsideAngular(() => {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    });

    this.viewportCleanup = () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--app-vh');
    };
  }

  /** Focus sur le champ de message : on laisse le clavier s'ouvrir, puis on recale le tout. */
  onInputFocus(event?: FocusEvent): void {
    setTimeout(() => {
      (event?.target as HTMLElement | undefined)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      this.autoScroll();
    }, 350);
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