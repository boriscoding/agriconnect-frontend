import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-creer-demande-transport',
  standalone: false,
  templateUrl: './creer-demande-transport.html',
  styleUrl: './creer-demande-transport.css',
})
export class CreerDemandeTransport {

  isSubmitting = false;

  // ⚠️ Noms de champs devinés à partir de ColisController — à ajuster
  // si votre entité Colis.java utilise d'autres noms.
  demande: any = {
    produit: '',
    quantite: null,
    villeDepart: '',
    villeArrivee: ''
  };

  constructor(
    private router: Router,
    private http: HttpClient,
    private toastr: ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  onSubmit(): void {
    if (!this.demande.produit || !this.demande.villeArrivee) {
      this.toastr.warning('Veuillez renseigner au moins le produit et la destination.');
      return;
    }

    let expediteurId: number | null = null;
    if (isPlatformBrowser(this.platformId)) {
      const storedId = sessionStorage.getItem('userId');
      if (storedId) expediteurId = +storedId.replace(/\D/g, '');
    }

    if (!expediteurId) {
      this.toastr.error('Veuillez vous connecter avant de publier une demande de transport.');
      this.router.navigate(['/login']);
      return;
    }

    this.isSubmitting = true;

    // ⚠️ ColisController est mappé sur /api/colis (POST simple, @RequestBody Colis)
    const payload = {
      produit: this.demande.produit,
      quantite: this.demande.quantite,
      villeDepart: this.demande.villeDepart,
      villeArrivee: this.demande.villeArrivee,
      expediteurId: expediteurId,
      statut: 'EN_ATTENTE'
    };

    this.http.post(`${environment.apiUrl}/api/colis`, payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.toastr.success('Votre demande de transport a été publiée !');
        this.resetForm();
        this.router.navigate(['/opentrans']);
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Erreur publication demande de transport:', err);
        this.toastr.error('Erreur lors de la publication de la demande.');
      }
    });
  }

  private resetForm(): void {
    this.demande = { produit: '', quantite: null, villeDepart: '', villeArrivee: '' };
  }
}