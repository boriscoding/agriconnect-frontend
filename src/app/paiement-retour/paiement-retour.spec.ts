import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaiementRetour } from './paiement-retour';

describe('PaiementRetour', () => {
  let component: PaiementRetour;
  let fixture: ComponentFixture<PaiementRetour>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PaiementRetour]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaiementRetour);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
