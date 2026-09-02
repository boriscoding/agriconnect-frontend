import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, provideHttpClient, withFetch } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { registerLocaleData } from '@angular/common';
import localfr from '@angular/common/locales/fr';
import { ToastrModule } from 'ngx-toastr';

// 1. IMPORT DES COMPOSANTS STANDALONE (Doivent aller dans 'imports')
import { AppCommande } from './app-commande/app-commande';
import { Openachecteur } from './openachecteur/openachecteur';
import { BottomNav } from './bottom-nav/bottom-nav'; // devenu standalone
import { Sidebar } from './core/sidebar/sidebar/sidebar'; // devenu standalone

// 2. IMPORT DES COMPOSANTS CLASSIQUES (Doivent aller dans 'declarations')
import { AppComponent } from './app.component';
import { Loadingpage1Component } from './loadingpage1/loadingpage1.component';
import { HomepageComponent } from './homepage/homepage.component';
import { FormsignupComponent } from './formsignup/formsignup.component';
import { FormconnectComponent } from './formconnect/formconnect.component';
import { Openoffer } from './openoffer/openoffer';
import { Opentrans } from './opentrans/opentrans';
import { Header } from './core/header/header/header';
import { Dashbord } from './page/dashbord/dashbord/dashbord';
import { Discussion } from './page/discussion/discussion/discussion';
import { Rejoindre } from './page/rejoindre/rejoindre/rejoindre';
import { LogiChat } from './logi-chat/logi-chat';
import { Local } from './local/local';
import { CreerDemandeTransport } from './creer-demande-transport/creer-demande-transport';
import { PaiementRetour } from './paiement-retour/paiement-retour';
import { ProfilComponent } from './profil/profil'; // Assurez-vous que le nom de classe correspond

registerLocaleData(localfr, 'fr');

@NgModule({
  declarations: [
    // Uniquement les composants non-standalone (classiques)
    AppComponent,
    Loadingpage1Component,
    HomepageComponent,
    FormsignupComponent,
    FormconnectComponent,
    Openoffer,
    Opentrans, // standalone: false -> doit être déclaré, pas importé
    Header,
    Dashbord,
    Discussion,
    Rejoindre,
    LogiChat,
    Local,
    CreerDemandeTransport,
    PaiementRetour,
    ProfilComponent
  ],
  imports: [
    // Modules Angular globaux
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    ToastrModule.forRoot(),

    // Composants Standalone (interdit de les mettre dans declarations)
    AppCommande,
    Openachecteur, // le compilateur indique qu'il est standalone -> doit être importé, pas déclaré
    BottomNav,     // devenu standalone -> doit être importé, pas déclaré
    Sidebar        // devenu standalone -> doit être importé, pas déclaré
  ],
  providers: [
    provideClientHydration(),
    provideHttpClient(withFetch())
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }