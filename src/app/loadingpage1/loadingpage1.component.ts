import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-loadingpage1',
  templateUrl: './loadingpage1.component.html',
  styleUrl: './loadingpage1.component.css'
  
})
export class Loadingpage1Component implements OnInit {
  count: number = 0;
  isSlidingOut: boolean = false;
sidebarOpen: boolean = false;
  constructor(private router: Router) {}

  ngOnInit(): void {
    const interval = setInterval(() => {
      this.count++;

      if (this.count >= 100) {
        clearInterval(interval);

        // Déclenche l'animation de glissement vers la gauche
        this.isSlidingOut = true;

        // Attendre la fin de l’animation avant redirection
        setTimeout(() => {
          this.router.navigate(['/homepage']);
        }, 800); // doit être égal ou supérieur à la durée de l'animation CSS
      }
    }, 40);
  }
}


