import { NgModule } from '@angular/core';
import { ServerModule } from '@angular/platform-server';

import { AppModule } from './app.module'; // <-- LIGNE CRITIQUE
import { AppComponent } from './app.component';

@NgModule({
  imports: [
    AppModule, // C'est cet import qui déclenche TS-996002 si AppModule est invalide
    ServerModule,
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}