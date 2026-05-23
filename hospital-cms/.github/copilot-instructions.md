# Project: Hospital Management System

## What This Is
A production-grade hospital CRM with 5 user roles: 
PATIENT, DOCTOR, RECEPTIONIST, LAB_STAFF, ADMIN.

## Backend Stack
- Node.js 20 + Express.js + TypeScript
- Prisma ORM with PostgreSQL
- Redis for caching, OTP, rate limiting
- BullMQ for background job queues
- JWT access tokens (15min) + refresh tokens (7 days)
- AWS S3 with signed URLs for file storage
- Socket.io for real-time notifications
- Zod for all input validation
- Winston for structured logging
- bcrypt with cost factor 12 for passwords

## Frontend Stack
- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- TanStack Query for server state
- Zustand for client state
- React Hook Form + Zod for forms
- Axios with interceptors for API calls

## Non-Negotiable Rules
1. Every backend route must have Zod validation
2. Every backend route must have auth middleware
3. Every sensitive route must have RBAC middleware
4. Every data mutation must call auditLog() utility
5. Never store files in the database or local disk
6. Never return passwords or tokens in API responses
7. All S3 file access via signed URLs only, 
   expiry 15 minutes
8. Prisma for ALL database operations, 
   no raw SQL unless absolutely necessary
9. All background tasks go through BullMQ, 
   never block the request
10. TypeScript strict mode, no 'any' types

## Module Structure Pattern
Every backend module must have exactly:
- moduleName.routes.ts   — Express router
- moduleName.controller.ts — Request/response handling
- moduleName.service.ts  — Business logic
- moduleName.schema.ts   — Zod validation schemas
- moduleName.types.ts    — TypeScript interfaces

## Auth Pattern
- Access token in Authorization header as Bearer token
- Refresh token in httpOnly cookie
- Token payload: { userId, role, email }
- RBAC middleware signature: 
  requireRole(...roles: Role[])

## Error Handling Pattern
All controllers use this pattern:
try {
  const result = await service.method()
  res.json({ success: true, data: result })
} catch (error) {
  next(error)
}

Global error handler returns:
{
  success: false,
  error: {
    code: string,
    message: string
  }
}

## API Response Format
Success: { success: true, data: any }
Error: { success: false, error: { code, message } }
Paginated: { 
  success: true, 
  data: any[], 
  pagination: { 
    total, page, limit, totalPages 
  } 
}