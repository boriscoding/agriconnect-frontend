import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser'; 
import { 
  trigger, 
  transition, 
  style, 
  animate, 
  query, 
  stagger 
} from '@angular/animations';

interface Message {
  sender: string;
  text: string;
  time: string;
  isMe: boolean;
  image?: any; 
  audio?: any; 
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
export class LogiChat implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  newMessage: string = '';
  showContactsMobile: boolean = false;
  mediaRecorder: any;
  audioChunks: any[] = [];
  isRecording: boolean = false;
  recordingStream?: MediaStream;

  messages: Message[] = [
    { sender: 'Borimaru', text: 'Encore vous ?', time: '11:45', isMe: false },
    { sender: 'Moi', text: 'Oui encore', time: '11:46', isMe: true }
  ];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private sanitizer: DomSanitizer 
  ) {}

  ngOnInit(): void {
    this.autoScroll();
  }

  // --- LOGIQUE D'ENVOI TEXTE ---
  sendMessage() {
    if (this.newMessage.trim()) {
      this.messages.push({
        sender: 'Moi',
        text: this.newMessage,
        time: this.getCurrentTime(),
        isMe: true
      });
      this.newMessage = ''; 
      this.autoScroll();    
    }
  }

  // --- LOGIQUE D'ENVOI IMAGE ---
  triggerImageUpload() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.messages.push({
          sender: 'Moi',
          text: '', 
          image: e.target.result,
          time: this.getCurrentTime(),
          isMe: true
        });
        this.autoScroll();
      };
      reader.readAsDataURL(file);
    }
  }

  // --- LOGIQUE D'ENVOI VOCAL ---
  async startVoiceRecord() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  private async startRecording() {
    try {
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Détecter le format supporté
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
                       ? 'audio/webm' 
                       : 'audio/ogg';

      this.mediaRecorder = new MediaRecorder(this.recordingStream, { mimeType });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event: any) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        this.messages.push({
          sender: 'Moi',
          text: '',
          audio: this.sanitizer.bypassSecurityTrustUrl(audioUrl),
          time: this.getCurrentTime(),
          isMe: true
        });
        this.autoScroll();
        
        // Arrêter proprement toutes les pistes du micro
        this.recordingStream?.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (err) {
      console.error("Accès micro refusé :", err);
      alert("Impossible d'accéder au micro. Vérifiez les permissions.");
    }
  }

  private stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  // --- UTILITAIRES ---
  private autoScroll() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        try {
          this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
        } catch(err) { }
      }, 100);
    }
  }

  private getCurrentTime(): string {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + 
           now.getMinutes().toString().padStart(2, '0');
  }

 toggleContacts() {
  this.showContactsMobile = !this.showContactsMobile;
}


isChatActive: boolean = false;

openChat() {
  this.isChatActive = true;
}

// Revient à la liste des contacts
closeChat() {
  this.isChatActive = false;
}
}