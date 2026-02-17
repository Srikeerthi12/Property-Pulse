<h1 align="center">PropertyPulse — Real Estate CRM &amp; Property Management Platform</h1>

PropertyPulse is a full-stack Real Estate Customer Relationship Management (CRM) platform designed to streamline property transactions between buyers, sellers, agents, and administrators.

The system manages the complete lifecycle of a property — from listing creation to lead generation, visit scheduling, and deal progression — using a structured workflow with role-based permissions.

Built with the **PERN** stack (PostgreSQL, Express.js, React.js, Node.js), the platform emphasizes scalability, secure authentication, and real-world business logic implementation.

---

##  Core Concept

The platform follows a CRM pipeline commonly used in real estate companies:

**Property Listing → Buyer Inquiry → Agent Interaction → Visit → Deal**

Each stage is controlled through state-machine validation to maintain data integrity and workflow consistency.

---

##  Key Features

###  Authentication &amp; Role Management

- JWT-based authentication
- Role-Based Access Control (RBAC)
- Four user roles:
	- Buyer
	- Seller
	- Agent
	- Admin
- Account activation and deactivation
- Secure password hashing using `bcrypt`
- Rate-limited login endpoints

###  Property Management

- Create, edit, and manage property listings
- Multi-image upload support
- Property moderation workflow:
	- Draft → Pending → Approved → Inactive
- Public property browsing with filters and search
- Property view tracking and activity logs
- Admin approval and rejection system

###  CRM Lead Management

- Buyer inquiries linked to properties
- Automatic or manual agent assignment
- Lead status pipeline:
	- New → Contacted → Visit Scheduled → Negotiation → Closed → Dropped
- Agent notes and interaction history
- Seller lead analytics per property
- Admin lead oversight and reassignment

###  Visit Scheduling System

- Schedule visits directly from inquiries
- Reschedule, confirm, and cancel appointments
- Visit status tracking:
	- Scheduled
	- Completed
	- Cancelled
	- No-Show
- Agent calendar interface
- Seller visit monitoring
- Admin visit management

###  File Upload Management

- Property image uploads
- Static file serving from backend
- Secure path validation to prevent traversal attacks

---

##  Workflow Architecture

**Buyer → Inquiry → Agent Assignment → Visit → Deal → Closure**

This architecture ensures controlled transitions between stages and prevents invalid operations.

---

## 🛠 Tech Stack

### Frontend

- React.js
- React Router
- Axios
- React Big Calendar
- Modern responsive UI (Tailwind &amp; custom components)

### Backend

- Node.js
- Express.js
- PostgreSQL
- JWT Authentication
- Multer (file uploads)
- Zod validation

### Database

- PostgreSQL relational schema
- Indexed queries for performance
- Audit logging for traceability

---

## 📁 Project Structure

```bash
PropertyPulse/
│
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Role-based pages (Buyer, Seller, Agent, Admin)
│   │   ├── services/           # API communication layer
│   │   ├── context/            # Auth & notification contexts
│   │   ├── utils/              # Client-side helpers
│   │   └── App.jsx
│   └── package.json
│
├── server/                     # Node.js backend
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── models/             # Database queries and logic
│   │   ├── routes/             # API route definitions
│   │   ├── middleware/         # Auth, validation, rate limiting
│   │   ├── config/             # Configuration utilities
│   │   ├── utils/              # Helpers and validators
│   │   └── app.js
│   ├── schema.sql              # Database schema
│   └── package.json
│
└── README.md
```

---

##  Prerequisites

Make sure the following are installed:

- Node.js (v18 or higher)
- PostgreSQL (v14+ recommended)
- npm or yarn

---

##  Setup Instructions

> Replace `your-repo-url` and folder name with your actual repository details.

### 1️⃣ Clone Repository

```bash
git clone &lt;your-repo-url&gt;
cd PropertyPulse
```

### 2️⃣ Backend Setup

Navigate to the server folder and install dependencies:

```bash
cd server
npm install
```

Create a `.env` file inside `server/`:

```env
PORT=5001
DATABASE_URL=postgresql://username:password@localhost:5432/propertypulse
JWT_ACCESS_SECRET=your_secret_key
CLIENT_ORIGIN=http://localhost:5173
```

Run database migrations (if applicable):

```bash
npm run db:migrate
```

Start backend server:

```bash
npm run dev
```

Health check:

```text
http://localhost:5001/health
```

### 3️⃣ Frontend Setup

Navigate to the client folder and install dependencies:

```bash
cd ../client
npm install
```

Optional `.env` inside `client/`:

```env
VITE_API_URL=http://localhost:5001/api
```

Start frontend:

```bash
npm run dev
```

If default port is busy:

```bash
npm run dev -- --port 5173
```

---

##  Security Features

- JWT token authentication
- Password hashing with `bcrypt`
- Role-based authorization
- Input validation with Zod
- Rate limiting to prevent abuse
- Secure file upload handling
- Audit logs for system actions

---

##  Current Implementation Status

**Completed:**

- Authentication &amp; User Management
- Property Management
- CRM Leads System
- Visit Scheduling

Project implemented up to **Phase 4 — CRM &amp; Visit Management**.

---

##  Future Enhancements

Planned modules:

- Deal financial management
- Payment gateway integration
- Notifications system
- Real-time messaging / chat
- Advanced analytics dashboard
#
