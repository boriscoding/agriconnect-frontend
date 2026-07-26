import {
  Component, OnInit, Inject, PLATFORM_ID,
  ViewChild, ElementRef, OnDestroy, HostListener
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { MessageApi } from '../services/message-api';
import { Auth } from '../services/auth';
import { NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import * as Stomp from 'stompjs';
import SockJS from 'sockjs-client';
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
    ])
  ]
})
export class LogiChat implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  // ─── Données ──────────────────────────────────────────────
  serverI: string       = 'localhost';
  searchTerm: string    = '';
  contacts: Contact[]   = [];
  filteredContacts: Contact[] = [];
  newMessage: string    = '';
  messages: any[]       = [];
  currentUserId: number = 0;
  selectedContactId: number | null = null;
  selectedContact: Contact | null  = null;
  isChatActive: boolean = false;

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

  // ─── WebSocket ─────────────────────────────────────────────
  private stompClient: any;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private sanitizer:    DomSanitizer,
    private messageApi:   MessageApi,
    private authService:  Auth,
    private zone:         NgZone,
    private route:        ActivatedRoute,
    private router:       Router
  ) {}

  // ─── Init ──────────────────────────────────────────────────
  ngOnInit(): void {
    const userId = this.authService.getUserId();
    if (userId && userId > 0) {
      this.currentUserId = Number(userId);
      this.chargerListeContacts();

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
    if (this.stompClient?.connected) {
      this.stompClient.disconnect();
    }
  }

  // ─── WebSocket ─────────────────────────────────────────────
  initialiserSocket(): void {
    this.zone.runOutsideAngular(() => {
      const socket = new SockJS('http://localhost:8080/ws-chat');
      this.stompClient = Stomp.over(socket);
      this.stompClient.debug = null; // Supprime les logs STOMP en console

      this.stompClient.connect({}, () => {
        this.stompClient.subscribe('/topic/messages', (payload: any) => {
          this.zone.run(() => this.onMessageReceived(JSON.parse(payload.body)));
        });
      });
    });
  }

  onMessageReceived(msg: any): void {
    const isPourMoi = Number(msg.destinataire) === this.currentUserId;
    const isDeMoi   = Number(msg.expediteur)   === this.currentUserId;

    if (!isPourMoi && !isDeMoi) return;

    const interlocuteurId = isDeMoi ? Number(msg.destinataire) : Number(msg.expediteur);

    if (interlocuteurId === this.selectedContactId) {
      const existeDeja = this.messages.find(m => m.id === msg.id);
      if (!existeDeja) {
        this.messages.push({
          id:       msg.id,
          text:     msg.contenu,
          time:     this.formatDate(msg.timestamp),
          isMe:     isDeMoi,
          type:     msg.mediaType || 'TEXT',
          mediaUrl: msg.mediaUrl,
          read:     false
        });
        this.autoScroll();
      }
    }
    this.chargerListeContacts();
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
    this.selectedContactId = contact.id;
    this.selectedContact   = contact;
    this.isChatActive      = true;
    this.messages          = [];
    this.activeMenuIndex   = -1;

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
    if ((!this.newMessage.trim() && !this.selectedFile) || !this.selectedContactId) return;

    const formData = new FormData();
    formData.append('contenu',         this.newMessage);
    formData.append('expediteurId',    this.currentUserId.toString());
    formData.append('destinataireId',  this.selectedContactId.toString());
    formData.append('mediaType',       this.selectedFile ? this.previewType! : 'TEXT');
    if (this.selectedFile) formData.append('file', this.selectedFile);

    this.messageApi.envoyer(formData).subscribe({
      next: (res) => {
        if (this.stompClient?.connected) {
          this.stompClient.send('/app/chat.sendMessage', {}, JSON.stringify(res));
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

  // ─── Utilitaires ───────────────────────────────────────────
  getActiveContact(): Contact | undefined {
    return this.contacts.find(c => c.id === this.selectedContactId);
  }

  openChat():  void { this.isChatActive = true; }
  closeChat(): void { this.isChatActive = false; }

  private mapSingleMessage(msg: any) {
    const isMe = Number(msg.expediteurId || msg.expediteur) === this.currentUserId;
    let url    = msg.mediaUrl;
    if (url && !url.startsWith('http')) url = `http://${this.serverI}:8080${url}`;
    return {
      id:       msg.id,
      text:     msg.contenu,
      time:     this.formatDate(msg.timestamp || msg.dateEnvoi),
      isMe,
      type:     msg.mediaType || 'TEXT',
      mediaUrl: url,
      read:     msg.lu || false
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
      this.stompClient.send('/app/chat.typing', {}, JSON.stringify({
        senderId: this.currentUserId,
        receiverId: this.selectedContactId
      }));
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
}