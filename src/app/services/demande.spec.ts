import { TestBed } from '@angular/core/testing';

import { Demande } from './demande';

describe('Demande', () => {
  let service: Demande;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Demande);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
