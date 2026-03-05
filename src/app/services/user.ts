export interface User {
    id: number;
  nom: string;
  email: string;
  role?: string;
  token?: string; // Très utile pour plus tard quand on passera au JWT
  type: string; // <-- Vérifie que cette ligne existe bien
}
