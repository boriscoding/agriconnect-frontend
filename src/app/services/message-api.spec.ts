import { TestBed } from '@angular/core/testing';

import { MessageApi } from './message-api';

describe('MessageApi', () => {
  let service: MessageApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MessageApi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
