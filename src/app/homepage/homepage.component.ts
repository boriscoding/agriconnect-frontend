import { Component ,ChangeDetectorRef} from '@angular/core';

import { trigger, transition, style, animate, query, group } from '@angular/animations';
import { Router } from '@angular/router';
@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.css',
   animations: [
    trigger('pageAnimations', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.9)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(50px)' }),
        animate('500ms cubic-bezier(0.35, 0, 0.25, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'scale(0.95)' }))
      ])
    ])
  ]
})
export class HomepageComponent {
   
 currentState: 'welcome' | 'signup' | 'connect' = 'welcome';

  constructor(private cdr: ChangeDetectorRef) {}
navigateTo(page: 'welcome' | 'signup' | 'connect' = 'welcome'){
this.currentState = page;
}
 
}