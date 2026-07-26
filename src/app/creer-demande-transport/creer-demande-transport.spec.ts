import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreerDemandeTransport } from './creer-demande-transport';

describe('CreerDemandeTransport', () => {
  let component: CreerDemandeTransport;
  let fixture: ComponentFixture<CreerDemandeTransport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CreerDemandeTransport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreerDemandeTransport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
