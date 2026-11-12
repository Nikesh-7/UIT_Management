# UIT College Management System

A role-based college portal for United Institute of Technology (UIT), Computer Science & Engineering (CSE).

## Technology
- Frontend: React, Vite, Axios, Lucide icons
- Backend: Node.js, Express, JWT, bcrypt
- Database: PostgreSQL with Prisma ORM
- Roles: ADMIN, STAFF, STUDENT

## Project structure
- `frontend/` — responsive React application
- `backend/` — Express REST API
- `backend/prisma/` — existing Prisma schema (preserved)

## Local setup (Windows PowerShell)

### 1. Database
Create a PostgreSQL database named `college_management` (or use your existing database). Do not run a reset command. Keep your existing data.

### 2. Backend
```powershell
cd N:\Documents\Management\backend
Copy-Item .env.example .env
```
Edit `backend/.env` privately and set `DATABASE_URL` and a unique `JWT_SECRET` (at least 32 characters). Do not paste secrets into chat or commit `.env`.

Install dependencies and generate Prisma Client:
```powershell
npm install
npx prisma generate
```
Start the API:
```powershell
npm start
```
Health check: `http://localhost:3000/api/health`

The existing database schema is not reset or dropped by these commands. If your database has not yet been migrated, review the schema and use a normal, reviewed migration workflow; do not use `migrate reset` or force-reset options.

### 3. Frontend
Open a second PowerShell window:
```powershell
cd N:\Documents\Management\frontend
Copy-Item .env.example .env
npm install
npm run dev
```
Open `http://localhost:5173`.

For a hosted frontend, set `VITE_API_URL` to the hosted backend API base URL, for example `https://YOUR-API-DOMAIN/api`, then rebuild.

## Role access and available workflows
- Admin: students, staff, departments, subjects, enrollments, attendance, examinations, marks, assignments, submissions, study materials, announcements and reports.
- Staff: assigned subjects, attendance, examinations, marks, assignments, submissions/grade review, study materials and announcements.
- Student: own attendance and marks, enrolled assignments, assignment submission, study materials and announcements.

Admin can enroll student profiles in subjects from the Enrollments module. Subject assignment and academic actions are restricted by backend role and assigned-subject checks.

## Deployment outline
1. Provision managed PostgreSQL and keep the connection string private.
2. Deploy `backend/` as a Node service (or use `backend/Dockerfile`). Set `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV=production`, `PORT` (provided by host), and `CORS_ALLOWED_ORIGINS` to the exact deployed frontend origin(s).
3. Deploy `frontend/` as a static Vite site (or use `frontend/Dockerfile`). Set build-time `VITE_API_URL=https://YOUR-API-DOMAIN/api`.
4. Configure HTTPS on both hosted services.
5. Confirm `/api/health`, then sign in and verify role-specific workflows using test accounts.
6. Configure scheduled database backups in the managed PostgreSQL provider.
7. For study material files, use an approved managed file-storage service and save its HTTPS file URL in the material record. This application stores file links; it does not store uploaded file binaries.

Never expose `.env`, JWT secrets, database credentials, student records or staff records in a public repository. Configure backups and access policies in the database host.

## Important security notes
- Authentication uses JWT; passwords are stored as bcrypt hashes.
- API routes enforce role permissions and staff subject ownership checks.
- CORS is restricted to `CORS_ALLOWED_ORIGINS`.
- JSON request bodies are size-limited.
- Use a unique production JWT secret and rotate any credentials that may have been shared.
