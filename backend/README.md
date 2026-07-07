# Focused Tab Enforcer — Backend API

A complete REST + WebSocket backend for the Focused Tab Enforcer browser extension exam monitoring system.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: MongoDB 7 (Mongoose ODM)
- **Real-time**: Socket.io
- **Auth**: JWT (access + refresh tokens), bcrypt
- **Validation**: express-validator, Joi
- **File Uploads**: multer (CSV, images)
- **Email**: Nodemailer
- **Scheduler**: node-cron
- **Logging**: Winston
- **Security**: Helmet, express-rate-limit, CORS

---

## Quick Start

### 1. Local Development

```bash
# Clone and enter backend folder
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your values

# Start MongoDB locally (requires mongod in PATH)
# OR use Docker: docker compose up mongodb -d

# Start development server
npm run dev
```

Server runs at `http://localhost:5000`

### 2. Docker (Recommended)

```bash
# Copy env file
cp .env.example .env

# Start all services (backend + MongoDB)
docker compose up --build -d

# With Mongo Express UI (dev only)
docker compose --profile dev up -d

# View logs
docker compose logs -f backend

# Stop all
docker compose down
```

| Service       | URL                          |
|---------------|------------------------------|
| Backend API   | http://localhost:5000        |
| Health check  | http://localhost:5000/health |
| Mongo Express | http://localhost:8081        |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values. Key variables:

| Variable              | Description                                 |
|-----------------------|---------------------------------------------|
| `MONGODB_URI`         | MongoDB connection string                   |
| `JWT_SECRET`          | Access token signing secret (keep secure)   |
| `JWT_REFRESH_SECRET`  | Refresh token signing secret                |
| `SMTP_*`              | Email credentials (Gmail, SendGrid, etc.)   |
| `CLIENT_URL`          | Frontend URL for CORS and password reset    |
| `EXTENSION_API_KEY_SECRET` | Secret for generating extension API keys |

---

## API Reference

All endpoints return JSON: `{ status, data?, message?, pagination? }`

### Authentication `/api/auth`

| Method | Endpoint                      | Auth | Description                  |
|--------|-------------------------------|------|------------------------------|
| POST   | `/institution/register`       | —    | Register institution          |
| POST   | `/institution/login`          | —    | Institution login             |
| POST   | `/admin/login`                | —    | Admin user login              |
| POST   | `/refresh`                    | —    | Refresh access token          |
| POST   | `/logout`                     | JWT  | Logout, invalidate token      |
| POST   | `/forgot-password`            | —    | Send reset email              |
| POST   | `/reset-password`             | —    | Reset with token              |

#### Register Institution
```http
POST /api/auth/institution/register
Content-Type: application/json

{
  "name": "University of Lagos",
  "email": "admin@unilag.edu.ng",
  "password": "SecurePass1",
  "address": "Akoka, Lagos",
  "contactPhone": "+2348012345678",
  "website": "https://unilag.edu.ng"
}
```

**Response `201`**:
```json
{
  "status": "success",
  "data": {
    "institution": { "_id": "...", "name": "...", "email": "..." },
    "accessToken": "eyJ...",
    "apiKey": "fte_abc123..."
  }
}
```

---

### Institution `/api/institution`

| Method | Endpoint              | Auth | Description                |
|--------|-----------------------|------|----------------------------|
| GET    | `/profile`            | JWT  | Get institution profile    |
| PUT    | `/profile`            | JWT  | Update profile             |
| GET    | `/stats`              | JWT  | Dashboard statistics       |
| POST   | `/regenerate-api-key` | JWT  | Regenerate extension API key |

---

### Exams `/api/exams`

| Method | Endpoint              | Auth         | Description                            |
|--------|-----------------------|--------------|----------------------------------------|
| POST   | `/`                   | JWT          | Create exam                            |
| GET    | `/`                   | JWT          | List exams (pagination, filters)       |
| GET    | `/:id`                | JWT          | Get exam details                       |
| PUT    | `/:id`                | JWT          | Update exam (draft/scheduled only)     |
| DELETE | `/:id`                | JWT+admin    | Soft delete exam                       |
| POST   | `/:id/enroll`         | JWT          | Bulk enroll students                   |
| GET    | `/:id/students`       | JWT          | List enrolled students                 |
| POST   | `/:id/start`          | JWT+admin    | Activate exam                          |
| POST   | `/:id/end`            | JWT+admin    | End exam                               |

#### Create Exam
```http
POST /api/exams
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Mathematics Final Exam 2026",
  "description": "Covers calculus and algebra",
  "scheduledDate": "2026-08-15T09:00:00Z",
  "durationMinutes": 120,
  "allowedDomains": ["examsystem.edu.ng"],
  "violationThresholds": {
    "tabSwitchSeconds": 3,
    "faceAbsenceFrames": 30,
    "multipleFaceTolerance": 1,
    "attentionAwaySeconds": 5
  }
}
```

#### Bulk Enroll Students
```http
POST /api/exams/:id/enroll
Authorization: Bearer <token>
Content-Type: application/json

{
  "studentIds": ["60d5ecb8b3e4c", "60d5ecb8b3e4d"]
}
```

---

### Students `/api/students`

| Method | Endpoint     | Auth      | Description                           |
|--------|--------------|-----------|---------------------------------------|
| POST   | `/`          | JWT       | Add single student                    |
| POST   | `/bulk`      | JWT+admin | Bulk import via CSV upload            |
| GET    | `/`          | JWT       | List students (search, pagination)    |
| GET    | `/:id`       | JWT       | Student detail + exam history         |
| PUT    | `/:id`       | JWT       | Update student                        |
| DELETE | `/:id`       | JWT+admin | Deactivate student                    |

#### Bulk Import CSV
```http
POST /api/students/bulk
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: students.csv
```

CSV format:
```
fullName,email,registrationNumber,department,level
John Doe,john@example.com,STU2026001,Computer Science,300
Jane Smith,jane@example.com,STU2026002,Mathematics,200
```

---

### Sessions / Monitoring `/api/sessions`

| Method | Endpoint          | Auth          | Description                              |
|--------|-------------------|---------------|------------------------------------------|
| POST   | `/verify`         | Public        | Verify student before exam               |
| POST   | `/start`          | Public+Token  | Start monitoring session                 |
| POST   | `/:id/heartbeat`  | Public+Token  | Extension heartbeat (every 30s)          |
| POST   | `/:id/violation`  | Public+Token  | Report violation event                   |
| POST   | `/:id/end`        | Public+Token  | End monitoring session                   |
| GET    | `/live`           | JWT           | All active sessions for institution      |
| GET    | `/:id/report`     | JWT           | Full session report with violations      |
| GET    | `/:id/timeline`   | JWT           | Chronological violation timeline         |

#### Verify Student (Extension calls this)
```http
POST /api/sessions/verify
Content-Type: application/json

{
  "examId": "EXAM-2026-ABC123",
  "email": "john@example.com",
  "registrationNumber": "STU2026001"
}
```

**Response `200`**:
```json
{
  "status": "success",
  "data": {
    "sessionToken": "eyJ...",
    "enrollmentId": "...",
    "examDetails": { "title": "...", "durationMinutes": 120 },
    "monitoringConfig": { "tabSwitchSeconds": 3, ... }
  }
}
```

#### Report Violation
```http
POST /api/sessions/:id/violation
Content-Type: application/json

{
  "sessionToken": "eyJ...",
  "eventType": "tab_switch",
  "severity": "medium",
  "timestamp": "2026-08-15T09:25:00Z",
  "duration": 5,
  "metadata": { "tabUrl": "https://google.com" }
}
```

---

### Reports `/api/reports`

| Method | Endpoint                     | Auth | Description                       |
|--------|------------------------------|------|-----------------------------------|
| GET    | `/exams/:id/summary`         | JWT  | Exam summary with violation stats |
| GET    | `/exams/:id/violations`      | JWT  | Violations list with filters      |
| GET    | `/students/:id/history`      | JWT  | Student monitoring history        |
| GET    | `/export/:examId`            | JWT  | Export to CSV or JSON             |

#### Export Exam Data
```http
GET /api/reports/export/:examId?format=csv
Authorization: Bearer <token>
```

---

### Extension API `/api/ext`

All extension endpoints require the `x-extension-key` header.

| Method | Endpoint     | Description                     |
|--------|--------------|---------------------------------|
| POST   | `/verify`    | Verify student credentials      |
| POST   | `/config`    | Get monitoring config           |
| POST   | `/heartbeat` | Send heartbeat                  |
| POST   | `/log`       | Log violation event             |

```http
POST /api/ext/verify
x-extension-key: fte_abc123...
Content-Type: application/json
```

---

## WebSocket (Socket.io)

**Namespace**: `/admin-dashboard`

**Authentication**: Pass JWT in handshake:
```js
const socket = io('http://localhost:5000/admin-dashboard', {
  auth: { token: 'eyJ...' }
});
```

### Events

| Direction | Event                     | Description                          |
|-----------|---------------------------|--------------------------------------|
| Server→   | `server:connected`        | Connection confirmed                 |
| Server→   | `server:violation-alert`  | Violation threshold exceeded         |
| Server→   | `server:session-started`  | New monitoring session started       |
| Server→   | `server:session-ended`    | Session ended                        |
| Server→   | `server:session-terminated` | Admin terminated a session         |
| Server→   | `server:heartbeat`        | Active session count every 30s       |
| Server→   | `server:alert-acknowledged` | Alert was acknowledged             |
| Client→   | `admin:join-room`         | Join institution room                |
| Client→   | `admin:acknowledge-alert` | Acknowledge an alert                 |
| Client→   | `admin:terminate-session` | Force-terminate a student session    |

### Violation Alert Payload
```json
{
  "alertId": "...",
  "enrollmentId": "...",
  "sessionId": "...",
  "studentName": "John Doe",
  "examName": "Mathematics Final",
  "violationType": "tab_switch",
  "severity": "high",
  "timestamp": "2026-08-15T09:25:00Z",
  "message": "John Doe — tab switch detected",
  "thresholdExceeded": true
}
```

---

## Cron Jobs

| Schedule       | Job                          | Description                                    |
|----------------|------------------------------|------------------------------------------------|
| Every hour     | `autoStartExams`             | Auto-starts scheduled exams past their date    |
| Every hour     | `autoEndExams`               | Auto-ends exams past duration + 15min grace    |
| Every hour     | `sendExamReminders`          | 24h reminder emails to enrolled students       |
| Daily midnight | `sendDailySummaries`         | Summary email to institution super admins      |
| Every 15min    | `cleanupStaleSessions`       | Terminates sessions with no heartbeat >10min   |

---

## Error Responses

All errors follow this format:
```json
{
  "status": "fail",
  "message": "Descriptive error message"
}
```

| Code | Meaning                                 |
|------|-----------------------------------------|
| 400  | Bad request / validation error          |
| 401  | Unauthorized / invalid token            |
| 403  | Forbidden / insufficient permissions    |
| 404  | Resource not found                      |
| 409  | Conflict (duplicate email, etc.)        |
| 422  | Unprocessable entity (validation fail)  |
| 429  | Rate limit exceeded                     |
| 500  | Internal server error                   |

---

## Postman Collection

Import the following structure into Postman:

1. Create a **Collection**: "Focused Tab Enforcer API"
2. Set **Variables**: `baseUrl = http://localhost:5000`, `token = {{accessToken}}`
3. Add folders:
   - `Auth` → all `/api/auth` endpoints
   - `Institution` → all `/api/institution` endpoints
   - `Exams` → all `/api/exams` endpoints
   - `Students` → all `/api/students` endpoints
   - `Sessions` → all `/api/sessions` endpoints
   - `Reports` → all `/api/reports` endpoints
   - `Extension API` → all `/api/ext` endpoints (with `x-extension-key` header)

4. In the **Register** request, add this **Test** script to auto-save the token:
```javascript
const res = pm.response.json();
if (res.data?.accessToken) {
  pm.collectionVariables.set('accessToken', res.data.accessToken);
  pm.collectionVariables.set('apiKey', res.data.apiKey);
}
```

---

## Security Notes

- Access tokens expire in **15 minutes** — use the refresh endpoint to rotate
- Refresh tokens are stored **hashed** in MongoDB and support a sliding window of 5 tokens
- bcrypt salt rounds: **12**
- Extension API keys are institution-scoped and can be regenerated
- All file uploads are validated (CSV only, max 5MB)
- MongoDB injection is prevented via Mongoose schema validation
- Rate limits: 100 req/15min for auth, 1000 req/15min for extension APIs
