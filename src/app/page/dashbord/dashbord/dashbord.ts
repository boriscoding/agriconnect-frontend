import { Component } from '@angular/core';

@Component({
  selector: 'app-dashbord',
  standalone: false,
  templateUrl: './dashbord.html',
  styleUrl: './dashbord.css',
})
export class Dashbord {
images = [
    'assets/img1.jpg',
    'assets/img2.jpg',
    'assets/img3.jpg',
    'assets/img4.jpg'
  ];
}
