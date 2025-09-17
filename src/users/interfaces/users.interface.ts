export interface User {
  id?: number;
  firstName: string;
  lastName: string;
  password: string;
  email: string;
  phoneNumber: string;
  status?: 'active' | 'blocked';
}
