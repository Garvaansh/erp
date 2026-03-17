# ERP Workspace — User Guide

This guide explains how to use the ERP web application: creating a workspace, signing in, and working with the main modules.

---

## Table of contents

1. [Getting started](#1-getting-started)
2. [Interface overview](#2-interface-overview)
3. [Modules](#3-modules)
4. [Company profile & settings](#4-company-profile--settings)
5. [Tips & shortcuts](#5-tips--shortcuts)

---

## 1. Getting started

### Creating a workspace (Sign up)

If your organization does not yet have a workspace:

1. Open the app and go to **Sign up** (or visit `/signup`).
2. Fill in:
   - **Workspace / Company name** — Your organization name (e.g. “Acme Corp”).
   - **First name** and **Last name** — For the first (admin) user.
   - **Email address** — Used to sign in later.
   - **Password** — At least 6 characters; keep it secure.
3. Click **Create workspace**.
4. After success, you are redirected to the **Sign in** page. A green message confirms the workspace was created. Your **Workspace ID** may be pre-filled; if not, save it from the success response or your records—you will need it to sign in.

The first user is automatically an **Admin** for that workspace. Document number series (PO, SO, Invoices, GRN, Work Orders, Vendor Invoices) and default roles are set up automatically.

### Signing in

1. Open the app (root URL, e.g. `http://localhost:3000`).
2. Enter:
   - **Workspace ID (Tenant UID)** — The UUID for your organization (e.g. from signup or from your admin).
   - **Email address** — Your login email.
   - **Password** — Your account password.
3. Click **Access Portal**.

You are taken to the **Overview** dashboard. If you don’t have a Workspace ID, either create a new workspace (Sign up) or ask your workspace admin.

---

## 2. Interface overview

After sign-in you see:

- **Sidebar (left)** — Lists all modules. Click a module to open it. The ERP logo at the top links to the Overview dashboard.
- **Header (top right)** — Theme toggle (light/dark), **Mock data** toggle, and **Sign out** (at the bottom of the sidebar).
- **Main content** — The selected module’s page (tables, forms, filters, etc.).

### Mock data toggle

In the header, **Mock data (1L)** lets you switch between:

- **OFF** — Real data for your workspace (default).
- **ON** — Sample data (e.g. large datasets for demos). Use this for testing and training without affecting live data.

---

## 3. Modules

Use the sidebar to open any of these areas.

| Module | Purpose |
|--------|--------|
| **Overview** | Executive dashboard: sales revenue, production output, inventory valuation, and quick links. |
| **Products** | Product catalog: add, edit, delete products; set SKU, price, category, reorder points, UOM, HSN/SAC, GST rate; bulk import (Excel); QR codes. |
| **Inventory** | Stock levels, batches, and inventory movements across warehouses. |
| **Stock Coil** | Coil stock and tracking (for manufacturing/coil-based operations). |
| **Coil Consumption** | Track coil usage in production. |
| **Purchase History** | History of purchases and related data. |
| **Vendors** | Supplier master: add and manage vendor details. |
| **Purchase Orders** | Create and manage purchase orders (POs). |
| **Goods Receipts** | Record goods received (GRN) against POs. |
| **Vendor Invoices** | Record and manage vendor invoices. |
| **Customers** | Customer master: add and manage customer details. |
| **Sales Orders** | Create and manage sales orders (SOs). |
| **Invoices** | Create and manage customer invoices; inventory is reduced on shipment. |
| **Work Orders** | Manufacturing work orders: production, BOMs, and production logs. |
| **Requisitions** | Internal requisitions (e.g. material requests). |
| **Shipments** | Shipment and delivery tracking. |
| **Warehouse Structure** | Define and manage warehouses and locations. |
| **Reports** | Dashboards, inventory valuation, and other reports (with optional export). |
| **Audit Logs** | View audit trail of changes in the system. |
| **Company Profile** | Workspace and company settings (see below). |

Most list pages support **search**, **filters**, and **pagination**. Use **Add** / **Create** (or similar) to create new records; use row actions (e.g. edit, delete) where available.

---

## 4. Company profile & settings

Open **Company Profile** (or **Settings**) from the sidebar to manage:

- **Tenant settings** — Display name, fiscal year start, base currency, locale, timezone.
- **Company details** — Company name, address (line 1 & 2, city, state, pincode, country), contact email and phone.
- **Tax & compliance** — GST number, TAN (India).
- **Save** — Apply changes; some fields may be used on invoices and reports.

Keep company and tax details up to date for correct invoicing and reporting.

---

## 5. Tips & shortcuts

- **Theme** — Use the theme toggle in the header to switch between light and dark mode.
- **Sign out** — Click **Sign out** at the bottom of the sidebar to log out securely.
- **Workspace ID** — Store your Workspace ID (tenant UUID) in a safe place; you need it every time you sign in from a new device or browser.
- **Password** — If you forget your password, contact your workspace admin; self-service password reset may be added in a future release.
- **Demo/training** — Turn **Mock data** ON to explore the app with sample data without affecting real records.
- **Mobile** — The app is responsive; on small screens the sidebar may collapse or be available via a menu depending on implementation.

---

## Need help?

- **New workspace:** Use **Sign up** from the login page.
- **Existing workspace:** Get your **Workspace ID** and login details from your administrator.
- **Technical docs:** See the main [README](../README.md) and backend docs (e.g. [Product vision](../erp-backend/docs/PRODUCT_VISION.md), [Tenant onboarding](TENANT_ONBOARDING.md)) for architecture and API details.
