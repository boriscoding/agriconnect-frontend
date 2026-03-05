import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Openoffer } from './openoffer';

describe('Openoffer', () => {
  let component: Openoffer;
  let fixture: ComponentFixture<Openoffer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Openoffer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Openoffer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
