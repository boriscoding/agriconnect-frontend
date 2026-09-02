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
import { CommonModule } from '@angular/common'; // Import indispensable pour le pipe 'number'
import { FormsModule } from '@angular/forms';   // Import indispensable pour [(ngModel)]
import { environment } from '../../environments/environment'; // 👈 Import de l'environnement

@Component({
  selector: 'app-commande',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule
  ],
  templateUrl: './app-commande.html',
  styleUrls: ['./app-commande.css']
})
export class AppCommande implements OnInit, OnDestroy {

  @Input() offre: any;
  @Output() close = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  // ─── États UI ────────────────────────────────────────────────
  step: number = 1;
  loading: boolean = false;

  // ─── Étape 1 ─────────────────────────────────────────────────
  quantiteSaisie: number = 1;
  villeDestination: string = '';
  nomDestinataire: string = '';       // prérempli avec nom acheteur
  telephoneDestinataire: string = '';  // prérempli avec tel acheteur

  // ─── Colis ───────────────────────────────────────────────────
  choixColis: string = 'nouveau';
  selectedColisId: number | null = null;
  nomNouveauColis: string = '';
  mesColisDisponibles: any[] = [];

  // ─── Étape 2A : trajets existants ────────────────────────────
  transactionsTrouvees: any[] = [];
  transactionSelectionnee: any = null;

  // ─── Étape 2B : pas de trajet → véhicules ────────────────────
  modeCreationTransaction: boolean = false;
  tousLesVehicules: any[] = [];
  vehiculeSelectionne: any = null;

  // ─── Étape 3 : paiement ──────────────────────────────────────
  modePaiement: 'ORANGE' | 'MTN' = 'ORANGE';
  numeroPaiement: string = '';

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
  // CYCLE DE VIE
  // ════════════════════════════════════════════════════════════

  ngOnInit(): void {
    // 1. Récupérer l'ID utilisateur
    const storedId = localStorage.getItem('userId');
    if (storedId) {
      this.userIdConnecte = Number(storedId.replace(/\D/g, ''));
    }

    // 2. Préremplir nom/tel depuis sessionStorage (stocké par Auth.saveUser() au login)
    const profileRaw = sessionStorage.getItem('userProfile')
                    || sessionStorage.getItem('user')
                    || localStorage.getItem('userProfile');

    if (profileRaw) {
      try {
        this.acheteurConnecte = JSON.parse(profileRaw);
        this.nomDestinataire = this.acheteurConnecte?.nom || '';
        this.telephoneDestinataire =
          this.acheteurConnecte?.number?.toString() ||
          this.acheteurConnecte?.telephone?.toString() || '';
      } catch {
        console.warn('Profil non parseable depuis le storage');
      }
    }

    // 3. Si profil absent du storage → le charger depuis l'API
    if (!this.acheteurConnecte && this.userIdConnecte) {
      this.chargerProfilAcheteur();
    }

    // 4. Charger les colis disponibles
    this.chargerMesColis();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Charge le profil acheteur depuis l'API si pas en storage
  private chargerProfilAcheteur(): void {
    this.http.get(`${environment.apiUrl}/acheteurs/${this.userIdConnecte}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profil: any) => {
          this.acheteurConnecte = profil;
          if (!this.nomDestinataire) {
            this.nomDestinataire = profil?.nom || '';
          }
          if (!this.telephoneDestinataire) {
            this.telephoneDestinataire = profil?.number?.toString()
                                     || profil?.telephone?.toString() || '';
          }
        },
        error: () => console.warn('Profil acheteur non chargé depuis API')
      });
  }

  // ════════════════════════════════════════════════════════════
  // CALCULATEURS
  // ════════════════════════════════════════════════════════════

  get totalCalcule(): number {
    const prix = this.offre?.prixUnitaire || this.offre?.prixProduit || 0;
    return (Number(this.quantiteSaisie) || 0) * prix;
  }

  getCapaciteDisponible(t: any): number {
    const chargeMax   = t?.vehicule?.chargeMax || t?.chargeMax || 0;
    const poidsActuel = t?.poidsActuel || 0;
    return Math.max(0, chargeMax - poidsActuel);
  }

  getCapaciteVehicule(v: any): number {
    return v?.chargeMax || v?.capaciteCharge || 0;
  }

  getPhotoVehicule(v: any): string {
    return this.vehiculeService.getPhotoUrl(v?.photo || v?.mediaUrl);
  }

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 1
  // ════════════════════════════════════════════════════════════

  validerEtape1(): void {
    if (!this.villeDestination || this.villeDestination.trim().length < 2) {
      this.toastr.warning('Veuillez préciser la ville de livraison', 'Champ requis');
      return;
    }
    if (!this.quantiteSaisie || this.quantiteSaisie <= 0) {
      this.toastr.warning('Quantité invalide', 'Champ requis');
      return;
    }
    if (this.offre?.quantiteProduit && this.quantiteSaisie > this.offre.quantiteProduit) {
      this.toastr.error(`Stock insuffisant. Disponible : ${this.offre.quantiteProduit} kg`);
      return;
    }
    if (this.choixColis === 'existant' && !this.selectedColisId) {
      this.toastr.warning('Veuillez sélectionner un colis existant');
      return;
    }
    this.step = 2;
    this.rechercherTransporteurs();
  }

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 2A — Trajets existants
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
      this.toastr.error(`Capacité insuffisante : ${dispo} kg disponibles`);
      return;
    }
    this.transactionSelectionnee = t;
    this.vehiculeSelectionne = null;
    this.step = 3;
  }

  selectionnerEtPasserEtape3(t: any): void {
    this.choisirCetteTransaction(t);
  }

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 2B — Aucun trajet → tous les véhicules disponibles
  // ════════════════════════════════════════════════════════════

  chargerTousLesVehicules(): void {
    this.loading = true;
    this.tousLesVehicules = [];

    this.vehiculeService.getToutes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vehicules: any[]) => {
          this.loading = false;
          // Garder seulement les véhicules dont capacité >= quantité commandée
          this.tousLesVehicules = (vehicules || []).filter(v =>
            this.getCapaciteVehicule(v) >= this.quantiteSaisie
          );
          if (this.tousLesVehicules.length === 0) {
            this.toastr.warning(`Aucun véhicule disponible pour ${this.quantiteSaisie} kg`);
          }
        },
        error: () => {
          this.loading = false;
          this.toastr.error('Impossible de charger les véhicules');
        }
      });
  }

  selectionnerVehicule(vehicule: any): void {
    if (this.getCapaciteVehicule(vehicule) < this.quantiteSaisie) {
      this.toastr.error(`Capacité insuffisante : ${this.getCapaciteVehicule(vehicule)} kg max`);
      return;
    }
    this.vehiculeSelectionne = vehicule;
    this.transactionSelectionnee = null;
    this.step = 3;
  }

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 3 — Paiement
  // ════════════════════════════════════════════════════════════

  procederAuPaiement(): void {
    if (!this.numeroPaiement || this.numeroPaiement.replace(/\s/g, '').length < 9) {
      this.toastr.warning('Veuillez saisir un numéro Mobile Money valide (9 chiffres)');
      return;
    }
    if (!this.userIdConnecte) {
      this.toastr.error('Session expirée, veuillez vous reconnecter');
      this.router.navigate(['/login']);
      return;
    }
    this.loading = true;

    if (this.modeCreationTransaction && this.vehiculeSelectionne) {
      this.creerTransactionPuisCommander();
    } else if (this.transactionSelectionnee) {
      this.envoyerCommande(this.transactionSelectionnee.id);
    } else {
      this.loading = false;
      this.toastr.error('Aucun transporteur sélectionné');
    }
  }

  private creerTransactionPuisCommander(): void {
    const transporteurId = this.vehiculeSelectionne?.proprietaire?.id
                        || this.vehiculeSelectionne?.transporteurId
                        || this.vehiculeSelectionne?.transporteur?.id;

    if (!transporteurId) {
      this.loading = false;
      this.toastr.error('Impossible d\'identifier le transporteur de ce véhicule');
      return;
    }

    const transactionPayload = {
      vehiculeId:    this.vehiculeSelectionne.id,
      transporteurId: transporteurId,
      villeDepart:    this.offre?.lieuProduction || '',
      villeArrivee:   this.villeDestination,
      poidsActuel:    0,
      statut:         'PENDING',
      montantTotal:   0
    };

    this.transactionService.create(transactionPayload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tr: any) => this.envoyerCommande(tr.id),
        error: () => {
          this.loading = false;
          this.toastr.error('Impossible de créer la transaction de transport');
        }
      });
  }

  private envoyerCommande(transactionId: number): void {
    const payload = {
      offreId:                this.offre.id,
      quantite:               this.quantiteSaisie,
      acheteurId:             this.userIdConnecte,
      transactionTransportId: transactionId,
      nomDestinataire:        this.nomDestinataire,
      telephoneDestinataire:  this.telephoneDestinataire,
      destination:            this.villeDestination,
      modeColis:              this.choixColis,
      colisId:                this.selectedColisId,
      nomNouveauColis:        this.nomNouveauColis,
      modePaiement:           this.modePaiement,
      numeroPaiement:         this.numeroPaiement.replace(/\s/g, ''),
      montantTotal:           this.totalCalcule,
      statutPaiement:         'PAYE'
    };

    this.http.post(`${environment.apiUrl}/colis/commander`, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.toastr.success(`Commande confirmée ! Livraison vers ${this.villeDestination}.`);
          this.fermer();
        },
        error: (err: any) => {
          this.loading = false;
          const msg = err?.error?.message || err?.error || 'Erreur lors de la commande';
          this.toastr.error(msg, '❌ Échec de la commande');
        }
      });
  }

  // ════════════════════════════════════════════════════════════
  // FIX COLIS — Filtre corrigé pour les colis sans acheteurId direct
  // ════════════════════════════════════════════════════════════

  chargerMesColis(): void {
    if (!this.userIdConnecte) return;

    this.colisService.getAllColis()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any[]) => {

          // Tentative 1 : colis avec acheteurId direct
          const avecId = data.filter((c: any) =>
            c.acheteurId === this.userIdConnecte ||
            c.acheteur?.id === this.userIdConnecte ||
            c.demandesAcheteur?.acheteur?.id === this.userIdConnecte
          );

          if (avecId.length > 0) {
            // Filtrer par statut compatible
            this.mesColisDisponibles = avecId.filter((c: any) =>
              !c.statut ||
              ['EN_ATTENTE', 'EN_PREPARATION', 'PENDING'].includes(c.statut)
            );
          } else {
            // Fallback : les colis en BD n'ont pas de FK acheteur directe
            // → on prend tous ceux dont le statut est compatible
            this.mesColisDisponibles = data.filter((c: any) =>
              !c.statut ||
              ['EN_ATTENTE', 'EN_PREPARATION', 'PENDING'].includes(c.statut)
            );
          }

          console.log(`📦 ${this.mesColisDisponibles.length} colis disponibles chargés`);
        },
        error: () => console.warn('Impossible de charger les colis')
      });
  }

  onChoixChange(): void {
    this.selectedColisId = null;
    this.nomNouveauColis = '';
  }

  // ════════════════════════════════════════════════════════════
  // UTILITAIRES
  // ════════════════════════════════════════════════════════════

  contacterAssistance(): void {
    this.router.navigate(['/chat'], {
      queryParams: {
        contactId: 'admin',
        message: `Aide pour commande de ${this.quantiteSaisie}kg de "${this.offre?.nproduit}" vers ${this.villeDestination}`
      }
    });
  }

  fermer(): void {
    this.close.emit();
  }
}