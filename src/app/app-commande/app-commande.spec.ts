import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppCommande } from './app-commande';

describe('AppCommande', () => {
  let component: AppCommande;
  let fixture: ComponentFixture<AppCommande>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppCommande]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppCommande);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
