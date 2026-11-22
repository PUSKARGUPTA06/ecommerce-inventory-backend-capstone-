# E-Commerce and Inventory Management System (Backend Capstone)

A RESTful backend built with **Node.js**, **Express.js**, **MongoDB**, **Mongoose**, **JWT Authentication**, **Role-Based Access Control (RBAC)**, **Node.js EventEmitter**, and **Socket.IO**.

---

## Core Features
- **Authentication & Security:** Password hashing with `bcryptjs`, short-lived JWT Access Tokens + rotating Refresh Tokens, `helmet` security headers, and RBAC (`customer`, `seller`, `admin`).
- **MVC + Event-Driven Architecture:** Clean separation across Routes, Middlewares, Controllers, Models, Events, and WebSocket handlers.
- **Atomic Inventory Management:** Prevents overselling under concurrent checkouts using atomic `findOneAndUpdate` (`$gte` + `$inc`) with automatic rollbacks and stock restoration on order cancellation.
- **MongoDB Aggregation Analytics:** Multi-stage aggregation pipelines for sales summaries, best-selling products (`$lookup`), and inventory valuation.
- **Real-Time Notifications:** Decoupled internal `EventEmitter` (`order:placed`, `order:status_updated`, `inventory:stock_low`) bridged to JWT-authenticated Socket.IO rooms.

---

## Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install