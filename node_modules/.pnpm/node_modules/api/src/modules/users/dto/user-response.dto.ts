export class UserResponseDto {
  id: string;

  firstName: string;

  lastName: string;

  email: string;

  phone?: string | null;

  employeeCode?: string | null;

  designation?: string | null;

  department?: string | null;

  status: string;

  role: {
    id: string;
    name: string;
    code: string;
  };

  createdAt: Date;
}
