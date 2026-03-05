import { Component , Input ,Output, EventEmitter } from '@angular/core';


@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
@Input() isOpen = false;
@Output() closeSidebar = new EventEmitter<void>();

  onNavigate() {
    this.closeSidebar.emit();
  }
}
