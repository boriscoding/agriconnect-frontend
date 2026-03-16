import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser'; 
import { MessageApi } from '../services/message-api';
import { Auth } from '../services/auth';
import { NgZone } from '@angular/core';

// ✅ Imports pour le temps réel
import * as Stomp from 'stompjs';
import SockJS from 'sockjs-client';

import { 
  trigger, 
  transition, 
  style, 
  animate, 
  query, 
  stagger 
} from '@angular/animations';

export interface Contact {
  id: number;
  nom: string;
  prenom?: string;
  email?: string;
  photoUrl?: string;
  online?: boolean;
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
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger('100ms', [
            animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('bubbleIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8) translateY(10px)' }),
        animate('200ms cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
        style({ opacity: 1, transform: 'scale(1) translateY(0)' }))
      ])
    ])
  ]
})
export class LogiChat implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  // --- VARIABLES DE RECHERCHE & LISTE ---
  searchTerm: string = '';
  contacts: Contact[] = [];
  filteredContacts: Contact[] = []; // Liste réellement affichée

  // --- VARIABLES DE CHAT ---
  newMessage: string = '';
  isChatActive: boolean = false;
  messages: any[] = [];
  currentUserId: number = 0;
  selectedContactId: number | null = null;
  private stompClient: any;

  // --- VARIABLES MÉDIAS ---
  selectedFile: File | null = null;
  mediaPreviewUrl: any = null;
  previewType: 'IMAGE' | 'VIDEO' | 'AUDIO' | null = null;
  mediaRecorder: any;
  audioChunks: any[] = [];
  isRecording: boolean = false;
  recordingStream?: MediaStream;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private sanitizer: DomSanitizer,
    private messageApi: MessageApi,
    private authService: Auth, 
    private zone: NgZone,
  ) {}

  ngOnInit(): void {
    // ✅ Utilisation de sessionStorage via Auth pour éviter d'écraser les IDs
    const userId = this.authService.getUserId();

    if (userId && userId > 0) {
      this.currentUserId = Number(userId);
      console.log("🚀 Session technique isolée active. ID :", this.currentUserId);
      
      this.chargerListeContacts();
      
      if (isPlatformBrowser(this.platformId)) {
        this.initialiserSocket();
      }
    } else {
      console.warn("⚠️ Aucune session trouvée.");
    }
  }

  ngOnDestroy(): void {
    if (this.stompClient) {
      this.stompClient.disconnect();
    }
  }

  // --- LOGIQUE SOCKET ---
  initialiserSocket() {
    this.zone.runOutsideAngular(() => {
      const socket = new SockJS('http://localhost:8080/ws-chat'); 
      this.stompClient = Stomp.over(socket);
      
      this.stompClient.connect({}, () => {
        this.stompClient.subscribe('/topic/messages', (payload: any) => {
          this.zone.run(() => {
            this.onMessageReceived(JSON.parse(payload.body));
          });
        });
      });
    });
  }

  onMessageReceived(msg: any) {
    const isPourMoi = Number(msg.destinataire) === this.currentUserId;
    const isDeMoi = Number(msg.expediteur) === this.currentUserId;

    if (isPourMoi || isDeMoi) {
      const interlocuteurId = isDeMoi ? Number(msg.destinataire) : Number(msg.expediteur);
      
      if (interlocuteurId === this.selectedContactId) {
        const existeDeja = this.messages.find(m => m.id === msg.id);
        if (!existeDeja) {
          this.messages.push({
            id: msg.id,
            sender: isDeMoi ? 'Vous' : 'Contact',
            text: msg.contenu,
            time: this.formatDate(msg.timestamp),
            isMe: isDeMoi,
            type: msg.mediaType || 'TEXT',
            mediaUrl: msg.mediaUrl
          });
          this.autoScroll();
        }
      }
      this.chargerListeContacts();
    }
  }
chargerListeContacts() {
  this.messageApi.getContactsActifs(this.currentUserId).subscribe({
    next: (data) => {
      this.contacts = data;           // L'originale (ne bouge plus)
      this.filteredContacts = [...data]; // La copie affichée (celle qui sera filtrée)
    },
    error: (err) => console.error("Erreur de chargement", err)
  });
}
filterContacts() {
  // 1. On récupère la saisie proprement
  const search = this.searchTerm ? this.searchTerm.toLowerCase().trim() : '';

  // 2. Si rien n'est saisi, on réaffiche la liste complète des contacts
  if (!search) {
    this.filteredContacts = [...this.contacts];
    return;
  }

  // 3. On filtre SANS modifier l'original (this.contacts)
  // On affecte le résultat à filteredContacts pour que le HTML se mette à jour
  this.filteredContacts = this.contacts.filter(contact => {
    const nom = contact.nom ? contact.nom.toLowerCase() : '';
    const prenom = contact.prenom ? contact.prenom.toLowerCase() : '';
    
    // On vérifie si la saisie est contenue dans le nom OU le prénom
    return nom.includes(search) || prenom.includes(search);
  });
}
  selectContact(contact: Contact) {
    this.selectedContactId = contact.id;
    this.isChatActive = true; 
    
    this.messageApi.getMessagesEntre(this.currentUserId, contact.id).subscribe({
      next: (data) => {
        this.messages = (data || []).map(msg => ({
          id: msg.id,
          sender: Number(msg.expediteur) === this.currentUserId ? 'Vous' : (contact.prenom || 'Contact'),
          text: msg.contenu || '',
          time: this.formatDate(msg.timestamp),
          isMe: Number(msg.expediteur) === this.currentUserId,
          type: msg.mediaType || 'TEXT',
          mediaUrl: msg.mediaUrl
        }));
        this.autoScroll();
      }
    });
  }

  // --- ENVOI DE MESSAGE ---
  sendMessage() {
    if ((!this.newMessage.trim() && !this.selectedFile) || !this.selectedContactId) return;

    // ✅ Affichage local instantané pour la fluidité
    const messageLocal = {
      id: Date.now(), 
      sender: 'Vous',
      text: this.newMessage,
      time: this.formatDate(''),
      isMe: true,
      type: this.selectedFile ? this.previewType! : 'TEXT',
      mediaUrl: this.mediaPreviewUrl
    };

    this.messages.push(messageLocal);
    this.autoScroll();

    const formData = new FormData();
    formData.append('contenu', this.newMessage); 
    formData.append('expediteurId', this.currentUserId.toString());
    formData.append('destinataireId', this.selectedContactId.toString());
    formData.append('mediaType', this.selectedFile ? this.previewType! : 'TEXT');
    if (this.selectedFile) formData.append('file', this.selectedFile);

    this.messageApi.envoyer(formData).subscribe(res => {
      if (this.stompClient && this.stompClient.connected) {
        this.stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(res));
      }
      this.newMessage = '';
      this.cancelPreview();
    });
  }

  // --- MÉDIAS & UTILITAIRES ---
  triggerImageUpload() { this.fileInput.nativeElement.click(); }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.selectedFile = file;
    this.previewType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.mediaPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  cancelPreview() {
    this.selectedFile = null;
    this.mediaPreviewUrl = null;
    this.previewType = null;
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  async startVoiceRecord() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isRecording ? this.stopRecording() : this.startRecording();
  }

  private async startRecording() {
    try {
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      this.mediaRecorder = new MediaRecorder(this.recordingStream, { mimeType });
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (e: any) => this.audioChunks.push(e.data);
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.selectedFile = new File([audioBlob], "vocal.webm", { type: mimeType });
        this.previewType = 'AUDIO';
        this.mediaPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(audioBlob));
        this.recordingStream?.getTracks().forEach(t => t.stop());
      };
      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (e) { console.error(e); }
  }

  private stopRecording() {
    if (this.mediaRecorder) { this.mediaRecorder.stop(); this.isRecording = false; }
  }

  private autoScroll() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if(this.myScrollContainer) 
          this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      }, 100);
    }
  }

  private formatDate(dateStr: string) {
    if(!dateStr) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  openChat() { this.isChatActive = true; }
  closeChat() { this.isChatActive = false; }
  
  getActiveContact(): Contact | undefined {
    return this.contacts.find(c => c.id === this.selectedContactId);
  }
  // ✅ Ajoute cet alias pour que le HTML reconnaisse les deux noms
onSearchChange() {
  this.filterContacts();
}
}