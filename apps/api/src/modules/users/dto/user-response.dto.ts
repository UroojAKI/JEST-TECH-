export class UserResponseDto {
  id: string;

  firstName: string;

  lastName: string;

  email: string;

  phone?: string | null;

  collectContacts: boolean;

  employeeCode?: string | null;

  agentCode?: string | null;

  clientCodes?: Array<{
    id: string;
    value: string;
    codeSystem: string;
    verificationStatus: string;
    isPrimary: boolean;
  }>;

  agentProfile?: { id: string } | null;

  designation?: string | null;

  department?: string | null;

  branchId?: string | null;

  branchName?: string | null;

  teamName?: string | null;

  status: string;

  role: {
    id: string;
    name: string;
    code: string;
  };

  lastLoginAt?: string | null;

  createdAt: Date;
}
