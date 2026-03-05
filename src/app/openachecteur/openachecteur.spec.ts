import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Openachecteur } from './openachecteur';

describe('Openachecteur', () => {
  let component: Openachecteur;
  let fixture: ComponentFixture<Openachecteur>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Openachecteur]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Openachecteur);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
