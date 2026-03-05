import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogiChat } from './logi-chat';

describe('LogiChat', () => {
  let component: LogiChat;
  let fixture: ComponentFixture<LogiChat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LogiChat]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LogiChat);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
