import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, provideHttpClient, withFetch } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { registerLocaleData } from '@angular/common';
import localfr from '@angular/common/locales/fr';
import { ToastrModule } from 'ngx-toastr'; // Import important
// Import des Composants
import { AppComponent } from './app.component';
import { Loadingpage1Component } from './loadingpage1/loadingpage1.component';
import { HomepageComponent } from './homepage/homepage.component';
import { FormsignupComponent } from './formsignup/formsignup.component';
import { FormconnectComponent } from './formconnect/formconnect.component';
import { Openoffer } from './openoffer/openoffer';
import { Header } from './core/header/header/header';
import { Sidebar } from './core/sidebar/sidebar/sidebar';
import { Dashbord } from './page/dashbord/dashbord/dashbord';
import { Discussion } from './page/discussion/discussion/discussion';
import { Rejoindre } from './page/rejoindre/rejoindre/rejoindre';
import { LogiChat } from './logi-chat/logi-chat';
import { Local } from './local/local';
import { Opentrans } from './opentrans/opentrans';
import { Openachecteur } from './openachecteur/openachecteur';
import { AppCommande } from './app-commande/app-commande';
import { CreerDemandeTransport } from './creer-demande-transport/creer-demande-transport';
import { BottomNav } from './bottom-nav/bottom-nav';
import { PaiementRetour } from './paiement-retour/paiement-retour';

registerLocaleData(localfr, 'fr');

@NgModule({
  declarations: [
    AppComponent,
    Loadingpage1Component,
    HomepageComponent,
    FormsignupComponent,
    FormconnectComponent,
    Openoffer,
    Header,
    Sidebar,
    Dashbord,
    Discussion,
    Rejoindre,
    LogiChat,
    Local,
    Opentrans,
    Openachecteur,
    AppCommande,
    CreerDemandeTransport,
    BottomNav,
    PaiementRetour
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,     // Gère le <router-outlet>
    FormsModule,          // Gère le [(ngModel)]
    ReactiveFormsModule,  // Gère le [formGroup]
    HttpClientModule, 
        ToastrModule.forRoot(),
    // Pour tes appels API (Producteur/Transporteur)
    BrowserAnimationsModule,
  ],
  providers: [
    provideClientHydration(),
    provideHttpClient(withFetch()) // Indispensable pour éviter l'erreur NG02801
    
    
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }