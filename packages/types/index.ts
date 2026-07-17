export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'BRANCH_MANAGER' | 'TEAM_LEADER' | 'SALES_AGENT' | 'OPERATIONS' | 'UNDERWRITER' | 'CLAIMS_OFFICER' | 'FINANCE' | 'SUPPORT' | 'CUSTOMER';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}
