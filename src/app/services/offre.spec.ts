import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing'; // ✅ Nécessaire pour tester les services avec HttpClient
import { OffreService } from './offre'; // ✅ Vérifie bien que le nom du fichier est offre.service.ts

describe('OffreService', () => {
  let service: OffreService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule], // ✅ Ajoute ceci pour éviter l'erreur "No provider for HttpClient"
      providers: [OffreService]
    });
    service = TestBed.inject(OffreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});