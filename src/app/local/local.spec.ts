import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Local } from './local';

describe('Local', () => {
  let component: Local;
  let fixture: ComponentFixture<Local>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Local]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Local);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
