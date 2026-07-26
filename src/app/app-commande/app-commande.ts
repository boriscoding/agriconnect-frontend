import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ColisService } from '../services/colis-service';
import { Transaction } from '../services/transaction';
import { OffreService } from '../services/offre';
import { Vehicule } from '../services/vehicule';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

@Component({
  selector: 'app-app-commande',
  standalone: false,
  templateUrl: './app-commande.html',
  styleUrl: './app-commande.css',
})
export class AppCommande implements OnInit, OnDestroy {

  @Input() offre: any;
  @Output() close = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  // ─── États UI ────────────────────────────────────────────────
  step: number = 1;   // 1=Détails  2=Transport  3=Date départ  4=Paiement
  loading: boolean = false;

  // ─── Étape 1 ─────────────────────────────────────────────────
  quantiteSaisie: number = 1;
  villeDestination: string = '';
  nomDestinataire: string = '';
  telephoneDestinataire: string = '';
  choixColis: string = 'nouveau';
  selectedColisId: number | null = null;
  nomNouveauColis: string = '';
  mesColisDisponibles: any[] = [];

  // ─── Étape 2 ─────────────────────────────────────────────────
  transactionsTrouvees: any[] = [];
  transactionSelectionnee: any = null;
  modeCreationTransaction: boolean = false;
  tousLesVehicules: any[] = [];
  vehiculeSelectionne: any = null;

  // ─── Étape 3 : date de départ ────────────────────────────────
  dateDepartChoisie: string = '';

  // ─── Étape 4 : paiement ──────────────────────────────────────
  modePaiement: 'ORANGE' | 'MTN' = 'ORANGE';
  numeroPaiement: string = '';
  paiementEnCours: boolean = false;

  // ─── Auth ────────────────────────────────────────────────────
  userIdConnecte: number | null = null;
  acheteurConnecte: any = null;

  constructor(
    private http: HttpClient,
    private colisService: ColisService,
    private transactionService: Transaction,
    private vehiculeService: Vehicule,
    private toastr: ToastrService,
    private offreService: OffreService,
    private router: Router
  ) {}

  // ════════════════════════════════════════════════════════════
  ngOnInit(): void {
    const storedId = localStorage.getItem('userId');
    if (storedId) this.userIdConnecte = Number(storedId.replace(/\D/g, ''));

    const raw = sessionStorage.getItem('userProfile') || sessionStorage.getItem('user');
    if (raw) {
      try {
        this.acheteurConnecte = JSON.parse(raw);
        this.nomDestinataire       = this.acheteurConnecte?.nom    || '';
        this.telephoneDestinataire = this.acheteurConnecte?.number?.toString() || '';
      } catch { /* ignore */ }
    }

    if (!this.acheteurConnecte && this.userIdConnecte) {
      this.http.get(`http://localhost:8080/acheteurs/${this.userIdConnecte}`)
        .pipe(takeUntil(this.destroy$))
        .subscribe({ next: (p: any) => { this.acheteurConnecte = p; }, error: () => {} });
    }

    // Pré-remplir la date de départ : demain 08h00
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    demain.setHours(8, 0, 0, 0);
    this.dateDepartChoisie = demain.toISOString().slice(0, 16);

    this.chargerMesColis();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ════════════════════════════════════════════════════════════
  // CALCULATEURS
  // ════════════════════════════════════════════════════════════

  get totalCalcule(): number {
    const prix = this.offre?.prixUnitaire || this.offre?.prixProduit || 0;
    return (Number(this.quantiteSaisie) || 0) * prix;
  }

  getCapaciteDisponible(t: any): number {
    return Math.max(0, (t?.vehicule?.chargeMax || 0) - (t?.poidsActuel || 0));
  }

  getCapaciteVehicule(v: any): number {
    return v?.chargeMax || v?.capaciteCharge || 0;
  }

  getPhotoVehicule(v: any): string {
    return this.vehiculeService.getPhotoUrl(v?.photo || v?.mediaUrl);
  }

  get transporteurChoisi(): any {
    return this.transactionSelectionnee?.transporteur
        || this.vehiculeSelectionne?.proprietaire
        || null;
  }

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 1 — Détails commande
  // ════════════════════════════════════════════════════════════

  validerEtape1(): void {
    if (!this.villeDestination?.trim() || this.villeDestination.trim().length < 2) {
      this.toastr.warning('Veuillez préciser la ville de livraison'); return;
    }
    if (!this.quantiteSaisie || this.quantiteSaisie <= 0) {
      this.toastr.warning('Quantité invalide'); return;
    }
    if (this.offre?.quantiteProduit && this.quantiteSaisie > this.offre.quantiteProduit) {
      this.toastr.error(`Stock insuffisant. Disponible : ${this.offre.quantiteProduit} kg`); return;
    }
    this.step = 2;
    this.rechercherTransporteurs();
  }

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 2 — Choisir un transporteur
  // ════════════════════════════════════════════════════════════

  rechercherTransporteurs(): void {
    this.loading = true;
    this.transactionsTrouvees = [];
    this.modeCreationTransaction = false;

    this.transactionService.trouverTrajets(this.villeDestination.trim(), this.quantiteSaisie)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any[]) => {
          this.loading = false;
          if (data && data.length > 0) {
            this.transactionsTrouvees = data;
          } else {
            this.modeCreationTransaction = true;
            this.chargerTousLesVehicules();
          }
        },
        error: () => {
          this.loading = false;
          this.modeCreationTransaction = true;
          this.chargerTousLesVehicules();
        }
      });
  }

  choisirCetteTransaction(t: any): void {
    const dispo = this.getCapaciteDisponible(t);
    if (this.quantiteSaisie > dispo) {
      this.toastr.error(`Capacité insuffisante : ${dispo} kg disponibles`); return;
    }
    this.transactionSelectionnee = t;
    this.vehiculeSelectionne = null;
    this.step = 3;   // → étape date départ
  }

  chargerTousLesVehicules(): void {
    this.loading = true;
    this.vehiculeService.getToutes().pipe(takeUntil(this.destroy$)).subscribe({
      next: (v: any[]) => {
        this.loading = false;
        this.tousLesVehicules = (v || []).filter(x => this.getCapaciteVehicule(x) >= this.quantiteSaisie);
      },
      error: () => { this.loading = false; }
    });
  }

  selectionnerVehicule(vehicule: any): void {
    this.vehiculeSelectionne = vehicule;
    this.transactionSelectionnee = null;
    this.step = 3;   // → étape date départ
  }

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 3 — Date de départ prévue
  // ════════════════════════════════════════════════════════════

  validerEtape3(): void {
    if (!this.dateDepartChoisie) {
      this.toastr.warning('Veuillez choisir une date de départ'); return;
    }
    if (new Date(this.dateDepartChoisie) <= new Date()) {
      this.toastr.warning('La date de départ doit être dans le futur'); return;
    }
    this.step = 4;
  }

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 4 — Paiement Monetbil → 672017303
  // ════════════════════════════════════════════════════════════

procederAuPaiement(): void {
  const tel = this.numeroPaiement.replace(/\s/g, '');
  if (!tel || tel.length < 9) {
    this.toastr.warning('Numéro Mobile Money invalide (9 chiffres)'); return;
  }
  if (!this.userIdConnecte) {
    this.router.navigate(['/login']); return;
  }

  this.paiementEnCours = true;

  // ── On envoie TOUT en une seule requête ──────────────────
  this.transactionService.initierPaiement({
    // Paiement
    montant:               this.totalCalcule,
    telephone:             tel,
    operateur:             this.modePaiement,
    description:           `AgriConnect - ${this.quantiteSaisie}kg de "${this.offre?.nproduit}" vers ${this.villeDestination}`,
    nomAcheteur:           this.acheteurConnecte?.nom || this.nomDestinataire,
    emailAcheteur:         this.acheteurConnecte?.email || '',
    // Commande complète
    offreId:               this.offre.id,
    quantite:              this.quantiteSaisie,
    acheteurId:            this.userIdConnecte,
    villeDestination:      this.villeDestination,
    nomDestinataire:       this.nomDestinataire,
    telephoneDestinataire: this.telephoneDestinataire,
    choixColis:            this.choixColis,
    selectedColisId:       this.selectedColisId,
    nomNouveauColis:       this.nomNouveauColis,
    dateDepartChoisie:     this.dateDepartChoisie,
    transactionExistanteId: this.transactionSelectionnee?.id || null,
    vehiculeId:            this.vehiculeSelectionne?.id || null,
    transporteurId:        this.transporteurChoisi?.id || null,
  }).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: any) => {
        this.paiementEnCours = false;

        if (res?.payment_url) {
          // Sauvegarder le transactionId pour le retour
          if (res.transactionId) {
            localStorage.setItem('pendingTransactionId', res.transactionId.toString());
          }
          // Redirection vers Monetbil
          window.location.href = res.payment_url;
        } else {
          this.toastr.error('Impossible d\'obtenir le lien de paiement');
        }
      },
      error: (err: any) => {
        this.paiementEnCours = false;
        const msg = err?.error?.message || 'Erreur lors du paiement';
        this.toastr.error(msg);
      }
    });
}
  // ════════════════════════════════════════════════════════════
  // COLIS
  // ════════════════════════════════════════════════════════════

  chargerMesColis(): void {
    if (!this.userIdConnecte) return;
    this.colisService.getAllColis().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any[]) => {
        const avecId = data.filter((c: any) =>
          c.acheteurId === this.userIdConnecte || c.acheteur?.id === this.userIdConnecte
        );
        this.mesColisDisponibles = (avecId.length > 0 ? avecId : data)
          .filter((c: any) => !c.statut || ['EN_ATTENTE', 'EN_PREPARATION', 'PENDING'].includes(c.statut));
      },
      error: () => {}
    });
  }

  onChoixChange(): void { this.selectedColisId = null; this.nomNouveauColis = ''; }
  fermer(): void { this.close.emit(); }
}