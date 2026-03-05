import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Loadingpage1Component } from './loadingpage1.component';

describe('Loadingpage1Component', () => {
  let component: Loadingpage1Component;
  let fixture: ComponentFixture<Loadingpage1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Loadingpage1Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Loadingpage1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
