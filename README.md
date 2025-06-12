# Bedspace Management API

This API provides user authentication, listing management, photo uploads (stored in MinIO S3), and Stripe payment integration for a bedspace rental platform.

## Environment Setup

Create a `.env` file in the backend directory with the following variables:
```
MONGODB_URI=mongodb://localhost:27017/bedspace_demo
JWT_SECRET=demosecretkey
STRIPE_SECRET_KEY=sk_test_demo1234567890
PORT=3000
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=bedspace-photos
```

---

## Authentication

### Register
**POST** `/api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword",
  "role": "Tenant|Landlord|Admin"
}
```
**Rules:**
- Anyone can register as a `Tenant` (no authentication required).
- Only an **Admin** user (with a valid Admin JWT token) making the request from **localhost** can create `Landlord` or `Admin` users.
- If you try to register a `Landlord` or `Admin` from a non-localhost IP or without an Admin token, you will receive a 403 Forbidden error.

**Sample cURL for Tenant registration (open to all):**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"tenant@example.com","password":"yourpassword","role":"Tenant"}'
```

**Sample cURL for Landlord/Admin registration (admin only, from localhost):**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -d '{"email":"landlord@example.com","password":"yourpassword","role":"Landlord"}'
```

**Response:**
```json
{ "message": "User registered" }
```

### Login
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```
**Response:**
```json
{ "token": "JWT_TOKEN" }
```

---

## Listings (Landlord Only)

> All routes require `Authorization: Bearer <JWT_TOKEN>` header with a landlord token.

### View All Listings
**GET** `/api/listings`

**Response:**
```json
[
  {
    "_id": "...",
    "title": "Sample Room",
    "description": "Spacious room in city center",
    "price": 500,
    "photo": "1720631234567-room.jpg",
    "url": "http://localhost:9000/bedspace-photos/1720631234567-room.jpg",
    "landlord": "...",
    "createdAt": "2025-06-10T10:00:00.000Z"
  },
  // ...more listings
]
```

### View Single Listing
**GET** `/api/listings/:id`

**Response:**
```json
{
  "_id": "...",
  "title": "Sample Room",
  "description": "Spacious room in city center",
  "price": 500,
  "photo": "1720631234567-room.jpg",
  "url": "http://localhost:9000/bedspace-photos/1720631234567-room.jpg",
  "landlord": "...",
  "createdAt": "2025-06-10T10:00:00.000Z"
}
```

### Add Listing
**POST** `/api/listings`

**Form Data:**
- `title`: (string)
- `description`: (string)
- `price`: (number)
- `photo`: (file)

**Sample cURL:**
```bash
curl -X POST http://localhost:3000/api/listings \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "title=Sample Room" \
  -F "description=Spacious room in city center" \
  -F "price=500" \
  -F "photo=@/path/to/photo.jpg"
```
**Response:**
```json
{
  "_id": "...",
  "title": "Sample Room",
  "description": "Spacious room in city center",
  "price": 500,
  "photo": "1720631234567-room.jpg",
  "url": "http://localhost:9000/bedspace-photos/1720631234567-room.jpg",
  "landlord": "...",
  "createdAt": "2025-06-10T10:00:00.000Z"
}
```

> **Note:** The `url` field in the response always contains the direct S3 URL to download the photo, even if it was not stored in MongoDB at creation time.

### Update Listing
**PUT** `/api/listings/:id`

**Form Data:**
- `title`: (string, optional)
- `description`: (string, optional)
- `price`: (number, optional)
- `photo`: (file, optional)

**Sample cURL:**
```bash
curl -X PUT http://localhost:3000/api/listings/<listing_id> \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "title=Updated Room" \
  -F "price=600" \
  -F "photo=@/path/to/newphoto.jpg"
```
**Response:**
```json
{
  "_id": "...",
  "title": "Updated Room",
  "description": "Spacious room in city center",
  "price": 600,
  "photo": "1720631234567-newphoto.jpg",
  "url": "http://localhost:9000/bedspace-photos/1720631234567-newphoto.jpg",
  "landlord": "...",
  "createdAt": "2025-06-10T10:00:00.000Z"
}
```

### Delete Listing
**DELETE** `/api/listings/:id`

**Sample cURL:**
```bash
curl -X DELETE http://localhost:3000/api/listings/<listing_id> \
  -H "Authorization: Bearer <JWT_TOKEN>"
```
**Response:**
```json
{ "message": "Listing deleted" }
```

---

## Booking & Payments

### Create Payment Intent
**POST** `/api/listings/:id/book`

**Request Body:**
```json
{ "amount": 1000 }
```
**Response:**
```json
{ "clientSecret": "..." }
```

### Payment Success
**POST** `/api/listings/payment/success`

**Response:**
```json
{ "message": "Payment successful" }
```

---

## Admin User Management

> The following endpoints are only accessible to Admin users (must provide a valid Admin JWT token in the `Authorization` header).

#### List All Users
**GET** `/api/auth/users`

**Headers:**
- `Authorization: Bearer <ADMIN_JWT_TOKEN>`

**Response:**
```json
[
  {
    "_id": "...",
    "email": "user@example.com",
    "role": "Tenant|Landlord|Admin"
  },
  // ...more users
]
```

#### Add User
**POST** `/api/auth/users`

**Headers:**
- `Authorization: Bearer <ADMIN_JWT_TOKEN>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "newpassword",
  "role": "Tenant|Landlord|Admin"
}
```
**Response:**
```json
{ "message": "User created" }
```

#### Update User
**PUT** `/api/auth/users/:id`

**Headers:**
- `Authorization: Bearer <ADMIN_JWT_TOKEN>`
- `Content-Type: application/json`

**Request Body:** (any of the following fields)
```json
{
  "email": "updated@example.com",
  "password": "newpassword",
  "role": "Tenant|Landlord|Admin"
}
```
**Response:**
```json
{
  "_id": "...",
  "email": "updated@example.com",
  "role": "Landlord"
}
```

#### Delete User
**DELETE** `/api/auth/users/:id`

**Headers:**
- `Authorization: Bearer <ADMIN_JWT_TOKEN>`

**Response:**
```json
{ "message": "User deleted" }
```

---

## Property Assignment & Payments

#### Assign Property to Tenant (Landlord/Admin only)
**POST** `/api/payments/assign`

**Headers:**
- `Authorization: Bearer <LANDLORD_OR_ADMIN_JWT_TOKEN>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "listingId": "<listing_id>",
  "tenantId": "<tenant_user_id>"
}
```
**Response:**
```json
{ "message": "Tenant assigned to property", "listing": { ... } }
```

#### Tenant Makes Payment
**POST** `/api/payments/pay`

**Headers:**
- `Authorization: Bearer <TENANT_JWT_TOKEN>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "listingId": "<listing_id>",
  "amount": 500,
  "month": "2025-06"
}
```
**Response:**
```json
{ "message": "Payment recorded", "payment": { ... } }
```

#### Track Monthly Payments (Landlord/Admin)
**GET** `/api/payments/payments/:listingId`

**Headers:**
- `Authorization: Bearer <LANDLORD_OR_ADMIN_JWT_TOKEN>`

**Response:**
```json
[
  {
    "_id": "...",
    "tenant": { "_id": "...", "email": "tenant@example.com" },
    "listing": "...",
    "amount": 500,
    "month": "2025-06",
    "status": "Paid",
    "paidAt": "2025-06-11T10:00:00.000Z",
    "createdAt": "2025-06-11T10:00:00.000Z"
  },
  // ...more payments
]
```

#### Admin: Update Payment
**PUT** `/api/payments/payments/:paymentId`

**Headers:**
- `Authorization: Bearer <ADMIN_JWT_TOKEN>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "amount": 600,
  "status": "Paid"
}
```
**Response:**
```json
{ ...updated payment object... }
```

#### Admin: Delete Payment
**DELETE** `/api/payments/payments/:paymentId`

**Headers:**
- `Authorization: Bearer <ADMIN_JWT_TOKEN>`

**Response:**
```json
{ "message": "Payment deleted" }
```

---

## Notes
- All endpoints return JSON.
- Use a tool like Postman or cURL to test file uploads and authenticated requests.
- The file field for uploads must be named `photo`.
- Listing images are stored in MinIO S3 and accessible via the `url` field in the response.
- Make sure MongoDB, Stripe, and MinIO credentials are set in your `.env` file.

---

## Landlord/Admin Endpoints

> The following endpoints are accessible to Landlord and Admin users. All require a valid JWT token in the `Authorization` header.

### View All Tenants and Payment Status (with Month Filter)
**GET** `/api/payments/landlord/tenants-payments?month=YYYY-MM`

**Headers:**
- `Authorization: Bearer <LANDLORD_OR_ADMIN_JWT_TOKEN>`

**Query Parameters:**
- `month` (optional): Filter payments by month, e.g. `2025-06`

**Response:**
```json
[
  {
    "tenantId": "...",
    "email": "tenant@example.com",
    "listingId": "...",
    "listingTitle": "Sample Room",
    "assignedAt": "2025-06-01T10:00:00.000Z",
    "assignedListing": "...",
    "payments": [
      {
        "_id": "...",
        "tenant": "...",
        "tenantId": "...",
        "amount": 500,
        "month": "2025-06",
        "status": "Paid",
        "paidAt": "2025-06-11T10:00:00.000Z",
        "createdAt": "2025-06-11T10:00:00.000Z"
      }
      // ...more payments for this tenant in the month
    ],
    "assignmentNote": "Tenant assigned on 2025-06-01 to listing Sample Room" // Only present if no payments for the period
  }
  // ...more tenants
]
```

- If a tenant has no payments for the requested month, the response includes an `assignmentNote` with the assignment date and listing.
- If you omit the `month` parameter, you get all payment history for each tenant.

---

### Tenant Management (Admin Only)

- All tenant creation, update, and deletion operations use `tenantId`.
- When a tenant is registered, a unique `tenantId` is generated and returned in the response.
- Admins can update or delete tenants using the `tenantId` (not the MongoDB `_id`).

#### Register Tenant
**POST** `/api/auth/register`

**Request Body:**
```json
{
  "email": "tenant@example.com",
  "password": "yourpassword",
  "role": "Tenant"
}
```
**Response:**
```json
{ "message": "User registered", "tenantId": "<generated-tenant-id>" }
```

#### Update Tenant (Admin Only)
**PUT** `/api/auth/users/tenant/:tenantId`

**Headers:**
- `Authorization: Bearer <ADMIN_JWT_TOKEN>`
- `Content-Type: application/json`

**Request Body:** (any of the following fields)
```json
{
  "email": "updated@example.com",
  "password": "newpassword"
}
```
**Response:**
```json
{
  "_id": "...",
  "email": "updated@example.com",
  "role": "Tenant",
  "tenantId": "..."
}
```

#### Delete Tenant (Admin Only)
**DELETE** `/api/auth/users/tenant/:tenantId`

**Headers:**
- `Authorization: Bearer <ADMIN_JWT_TOKEN>`

**Response:**
```json
{ "message": "Tenant deleted" }
```

---

### JWT Token
- The JWT token payload always includes the `role` field for proper role-based access control.
- Example payload:
```json
{
  "userId": "...",
  "role": "Tenant|Landlord|Admin",
  "iat": 1718100000,
  "exp": 1718186400
}
```
