# Role & Workspace Permission Matrix

## Accessible Workspaces by Role
- **ADMIN**: Access to ALL workspaces (Admin, Back Office, Agent/Sales).
- **BACK_OFFICE**: Access to Back Office and Agent/Sales workspaces.
- **AGENT**: Access to Agent/Sales workspaces only.

## Permissions by Role

| Resource | Action | ADMIN | BACK_OFFICE | AGENT | Scope |
|----------|--------|-------|-------------|-------|-------|
| CONTACT | CREATE | YES | YES | YES | All / Own |
| CONTACT | READ | YES | YES | YES | All / Assigned |
| CONTACT | UPDATE | YES | YES | YES | All / Own |
| CONTACT | DELETE | YES | NO | NO | All |
| LEAD | CREATE | YES | YES | YES | All / Own |
| LEAD | READ | YES | YES | YES | All / Assigned |
| LEAD | UPDATE | YES | YES | YES | All / Assigned |
| LEAD | DELETE | YES | NO | NO | All |
| QUOTE | CREATE | YES | YES | YES | All / Own |
| QUOTE | READ | YES | YES | YES | All / Assigned |
| QUOTE | UPDATE | YES | YES | YES | All / Assigned |
| QUOTE | DELETE | YES | NO | NO | All |
| POLICY | CREATE | YES | YES | NO | All / Assigned |
| POLICY | READ | YES | YES | YES | All / Assigned |
| POLICY | UPDATE | YES | YES | NO | All |
| POLICY | DELETE | YES | NO | NO | All |
| RENEWAL | READ | YES | YES | YES | All / Assigned |
| RENEWAL | UPDATE | YES | YES | YES | All / Assigned |
| CLAIM | CREATE | YES | YES | YES | All / Assigned |
| CLAIM | READ | YES | YES | YES | All / Assigned |
| CLAIM | UPDATE | YES | YES | NO | All |
| INSPECTION| UPDATE | YES | YES | NO | All |
| USER | MANAGE | YES | NO | NO | All |
| REPORT | READ | YES | YES | YES | All / Own |
| ADMIN | MANAGE | YES | NO | NO | All |
