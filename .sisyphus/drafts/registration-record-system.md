# Draft: Registration Record System

## Requirements (confirmed)
- [Frontend]: Windows and macOS installable application
- [Backend]: Deploy to Synology DSM 7.3 Container Manager
- [Database]: MariaDB 10 (port 3306 already in use)
- [Storage]: Synology Docker directory for uploaded images/documents/videos
- [Auth]: User/admin login switch, user registration, forgot password for both roles

## Technical Decisions
- None yet

## Research Findings
- None yet

## Open Questions
- Technology stack preferences (frontend: Electron? Tauri? NW.js?; backend: Node.js? Python? Java?)
- Expected scale (number of users, concurrent uploads, file sizes)
- Specific features beyond basic CRUD: search, filtering, reporting, notifications?
- Integration with existing Synology services (e.g., LDAP, Active Directory)?
- Deployment details: Docker image base, network configuration, volume mapping
- Security considerations: HTTPS, encryption at rest, file type validation
- Compliance requirements (GDPR, etc.)?

## Scope Boundaries
- INCLUDE: User registration, login, password recovery, CRUD operations for records with file attachments, role-based access (user vs admin)
- EXCLUDE: Advanced analytics, AI-based processing, multi-tenancy beyond user/admin, offline sync capabilities