// src/app/app.module.server.ts
import { NgModule } from '@angular/core';
import { ServerModule } from '@angular/platform-server';
import { AppModule } from './app.module';
import { AppComponent } from './app.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations'; // Importez ceci

@NgModule({
  imports: [
    AppModule,
    ServerModule,
    NoopAnimationsModule, // Ajoutez ceci ici pour neutraliser Toastr sur le serveur
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}