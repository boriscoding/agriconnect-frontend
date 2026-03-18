import { TestBed } from '@angular/core/testing';

import { Vehicule } from './vehicule';

describe('Vehicule', () => {
  let service: Vehicule;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Vehicule);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
