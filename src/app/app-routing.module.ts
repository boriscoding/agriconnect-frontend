

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Loadingpage1Component } from './loadingpage1/loadingpage1.component';
import { HomepageComponent } from './homepage/homepage.component';
import { Dashbord } from './page/dashbord/dashbord/dashbord';
import { Rejoindre } from './page/rejoindre/rejoindre/rejoindre';
import { Discussion } from './page/discussion/discussion/discussion';
import { Openoffer } from './openoffer/openoffer';
import { FormconnectComponent } from './formconnect/formconnect.component';
import { FormsignupComponent } from './formsignup/formsignup.component';
import { LogiChat } from './logi-chat/logi-chat';
import { ProfilComponent } from './profil/profil';
import { Opentrans } from './opentrans/opentrans';
import { Openachecteur } from './openachecteur/openachecteur';
import { PaiementRetour } from './paiement-retour/paiement-retour';
import { Local } from './local/local'; // Vérifie bien le chemin
import { CreerDemandeTransport } from './creer-demande-transport/creer-demande-transport';
// import { VehicleTrackerComponent } from './vehicle-tracker/vehicle-tracker.component';
const routes: Routes = [
  { path: '', component:Loadingpage1Component },
  { path: 'connection', component:FormconnectComponent },
  { path: 'inscrire', component:FormsignupComponent },
  { path: 'homepage', component: HomepageComponent },
  { path: 'dashbord', component: Dashbord },
  { path: 'creer-demande-transport', component: CreerDemandeTransport },
  { path: 'rejoindre', component: Rejoindre },
  { path: 'discussion', component: Discussion },
  { path: 'open', component: Openoffer },
  {path: 'chat', component: LogiChat},
  {path: 'localisation', component: Local},
  { path: 'opentrans', component: Opentrans },
  { path: 'openacheteur', component: Openachecteur},
  { path: 'paiement-retour', component: PaiementRetour },
  { path: '**', redirectTo: 'homepage' },
  
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }