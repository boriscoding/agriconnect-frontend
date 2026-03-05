import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormconnectComponent } from './formconnect.component';
 


describe('FormconnectComponent', () => {
  let component: FormconnectComponent;
  let fixture: ComponentFixture<FormconnectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FormconnectComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FormconnectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
