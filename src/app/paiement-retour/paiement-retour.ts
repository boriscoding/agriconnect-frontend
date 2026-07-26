import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Transaction } from '../services/transaction';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-paiement-retour',
  standalone: false,
  template: `
    <div style="display:flex;flex-direction:column;align-items:center;
                justify-content:center;height:100vh;background:#f0f2f5;gap:20px;">
      <div *ngIf="verification" style="text-align:center;">
        <div class="spinner" style="width:48px;height:48px;border:4px solid #e0e0e0;
             border-top-color:#4caf50;border-radius:50%;animation:spin 1s linear infinite;
             margin:0 auto 16px;"></div>
        <p style="color:#555;">Vérification du paiement en cours...</p>
      </div>

      <div *ngIf="succes" style="text-align:center;padding:30px;background:white;
           border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:360px;">
        <div style="font-size:48px;">✅</div>
        <h2 style="color:#2e7d32;margin:12px 0 8px;">Paiement confirmé !</h2>
        <p style="color:#555;">Votre commande est enregistrée. Vous allez être redirigé vers le suivi GPS.</p>
        <p style="font-size:12px;color:#9a9a90;margin-top:8px;">
          Transaction #{{ transactionId }}
        </p>
      </div>

      <div *ngIf="echec" style="text-align:center;padding:30px;background:white;
           border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:360px;">
        <div style="font-size:48px;">❌</div>
        <h2 style="color:#c62828;margin:12px 0 8px;">Paiement échoué</h2>
        <p style="color:#555;">{{ messageErreur }}</p>
        <button (click)="retourCommande()"
                style="margin-top:16px;padding:12px 24px;background:#1b5e20;
                       color:white;border:none;border-radius:10px;cursor:pointer;font-size:14px;">
          Réessayer
        </button>
      </div>
    </div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `
})
export class PaiementRetour implements OnInit {

  verification = true;
  succes       = false;
  echec        = false;
  transactionId: number | null = null;
  messageErreur = '';

  constructor(
    private route:       ActivatedRoute,
    private router:      Router,
    private transactionSvc: Transaction,
    private toastr:      ToastrService
  ) {}

  ngOnInit(): void {
    // Monetbil renvoie ?transaction_id=XXX&status=SUCCESS ou FAILED
    const ref    = this.route.snapshot.queryParamMap.get('transaction_id') || '';
    const status = this.route.snapshot.queryParamMap.get('status') || '';

    if (status === 'FAILED' || status === 'CANCELLED') {
      this.verification = false;
      this.echec        = true;
      this.messageErreur = 'Le paiement a été annulé ou refusé.';
      return;
    }

    // Vérifier et finaliser côté backend
    this.transactionSvc.finaliserApresPaiement(ref).subscribe({
      next: (res: any) => {
        this.verification = false;
        this.succes       = true;
        this.transactionId = res.transactionId;

        this.toastr.success('Commande confirmée !', '✅ Paiement reçu');

        // Redirection vers le suivi GPS après 2 secondes
        setTimeout(() => {
          this.router.navigate(['/localisation'], {
            queryParams: {
              transactionId: res.transactionId,
              role:          'acheteur',
              dateDepart:    res.dateDepart
            }
          });
        }, 2500);
      },
      error: (err: any) => {
        this.verification = false;
        this.echec        = true;
        this.messageErreur = err?.error?.message || 'Erreur de vérification du paiement.';
      }
    });
  }

  retourCommande(): void {
    this.router.navigate(['/open']);
  }
}