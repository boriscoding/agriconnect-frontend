import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Opentrans } from './opentrans';

describe('Opentrans', () => {
  let component: Opentrans;
  let fixture: ComponentFixture<Opentrans>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Opentrans]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Opentrans);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
