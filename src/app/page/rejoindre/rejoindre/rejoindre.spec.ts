import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Rejoindre } from './rejoindre';

describe('Rejoindre', () => {
  let component: Rejoindre;
  let fixture: ComponentFixture<Rejoindre>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Rejoindre]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Rejoindre);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
