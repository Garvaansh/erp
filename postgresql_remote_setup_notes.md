# PostgreSQL Remote Access Setup Notes (Ubuntu 24.04 -- Oracle Cloud VM)

## 1. Verify PostgreSQL Cluster

``` bash
sudo pg_lsclusters
```

Expected:

    Ver Cluster Port Status Owner
    16  main    5432 online postgres

------------------------------------------------------------------------

# 2. Configure PostgreSQL to Listen on All Interfaces

Open configuration:

``` bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Find:

    #listen_addresses = 'localhost'

Change to:

    listen_addresses = '*'

Restart PostgreSQL:

``` bash
sudo systemctl daemon-reload
sudo systemctl restart postgresql
```

------------------------------------------------------------------------

# 3. Verify PostgreSQL is Listening on All IPs

``` bash
sudo ss -nltp | grep 5432
```

Expected:

    0.0.0.0:5432
    [::]:5432

------------------------------------------------------------------------

# 4. Configure Client Authentication

``` bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Add at bottom:

    host    all    all    0.0.0.0/0    md5

Restart:

``` bash
sudo systemctl restart postgresql
```

------------------------------------------------------------------------

# 5. Check Public Server IP

``` bash
curl ifconfig.me
```

Example:

    161.118.161.118

------------------------------------------------------------------------

# 6. Verify Local PostgreSQL Connection

``` bash
nc -zv 127.0.0.1 5432
```

Expected:

    Connection succeeded

------------------------------------------------------------------------

# 7. Check Firewall Rules

``` bash
sudo iptables -L -n
```

If port 5432 is not allowed, add rule.

------------------------------------------------------------------------

# 8. Allow PostgreSQL Port

``` bash
sudo iptables -I INPUT 5 -p tcp --dport 5432 -j ACCEPT
```

Verify:

``` bash
sudo iptables -L -n
```

Expected rule:

    ACCEPT tcp -- 0.0.0.0/0 0.0.0.0/0 tcp dpt:5432

------------------------------------------------------------------------

# 9. Test External Connectivity

``` bash
nc -zv 161.118.161.118 5432
```

Expected:

    Connection succeeded

------------------------------------------------------------------------

# 10. Test PostgreSQL Login

``` bash
psql -h 161.118.161.118 -U erp_user -d reva_erp
```

Example output:

    reva_erp=>

Exit:

``` bash
\q
```

------------------------------------------------------------------------

# 11. Save Firewall Rules (Persistent)

``` bash
sudo apt install iptables-persistent -y
sudo netfilter-persistent save
```

------------------------------------------------------------------------

# 12. PostgreSQL Connection String

    postgresql://erp_user:Admin2590!@161.118.161.118:5432/reva_erp

JDBC:

    jdbc:postgresql://161.118.161.118:5432/reva_erp

------------------------------------------------------------------------

# Final Verification Commands

``` bash
sudo pg_lsclusters
sudo ss -nltp | grep 5432
sudo iptables -L -n
nc -zv 161.118.161.118 5432
psql -h 161.118.161.118 -U erp_user -d reva_erp
```

------------------------------------------------------------------------

# Result

PostgreSQL accessible at:

    161.118.161.118:5432

Database:

    reva_erp

User:

    erp_user

**Schema permissions (required for goose/migrations):**  
Grant `erp_user` permission to create objects in `public` (needed on PostgreSQL 15+):

```bash
sudo -i -u postgres
psql -d reva_erp -c "GRANT ALL ON SCHEMA public TO erp_user; GRANT CREATE ON SCHEMA public TO erp_user;"
```

Then run `migrate-all.sh` from your dev machine.

=====================



# Oracle Cloud VM + PostgreSQL Setup Guide

### Production-ready Database Server for ERP SaaS (Reva Technologies)

Author: Bhupendra Singh
Goal: Deploy a **PostgreSQL database server on Oracle Cloud Free Tier** for the ERP SaaS application.

This document provides a **complete step-by-step operational guide** including:

* Oracle Cloud VM creation
* SSH access
* PostgreSQL installation
* Firewall configuration
* Database creation
* Remote connection setup
* Validation tests

---

# 1. Infrastructure Overview

Final architecture:

```
MacBook / Developer Machine
        │
        │ SSH
        ▼
Oracle Cloud ARM VM
(Ubuntu 24.04)
        │
        │
PostgreSQL 16
        │
        │
ERP SaaS Backend (Go)
```

Oracle Free Tier resources used:

```
VM Shape: VM.Standard.A1.Flex
CPU: 1–2 OCPU
RAM: 6–12 GB
Storage: up to 200 GB
Cost: $0/month
```

---

# 2. Connect to Oracle VM via SSH

On your **local machine terminal**:

Navigate to your SSH key directory.

Example:

```
cd ~/Downloads
```

Fix key permissions:

```
chmod 400 ssh-key-2026-03-15.key
```

Connect to the VM:

```
ssh -i ssh-key-2026-03-15.key ubuntu@YOUR_PUBLIC_IP
```

Example:

```
ssh -i ssh-key-2026-03-15.key ubuntu@161.118.161.118
```

Expected output:

```
Welcome to Ubuntu 24.04
ubuntu@erp-vpc:~$
```

---

# 3. Update the Server

Update package lists and system packages.

```
sudo apt update
sudo apt upgrade -y
```

---

# 4. Install PostgreSQL

Install PostgreSQL and related utilities.

```
sudo apt install postgresql postgresql-contrib -y
```

Verify installation:

```
ls /etc/postgresql
```

Expected:

```
16
```

---

# 5. Start PostgreSQL Cluster

Check cluster status:

```
sudo pg_lsclusters
```

If status shows **down**, start the cluster.

```
sudo pg_ctlcluster 16 main start
```

Verify again:

```
sudo pg_lsclusters
```

Expected output:

```
Ver Cluster Port Status Owner
16  main    5432 online postgres
```

---

# 6. Verify PostgreSQL Port

Check if PostgreSQL is listening.

```
sudo ss -tulnp | grep 5432
```

Expected output:

```
LISTEN 0 128 127.0.0.1:5432
```

---

# 7. Configure PostgreSQL for Remote Access

Open the main configuration file.

```
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Find:

```
#listen_addresses = 'localhost'
```

Change to:

```
listen_addresses = '*'
```

Save and exit:

```
CTRL + O
ENTER
CTRL + X
```

---

# 8. Configure Client Authentication

Open authentication configuration.

```
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Add the following line at the bottom:

```
host    all             all             0.0.0.0/0               md5
```

Save and exit.

---

# 9. Restart PostgreSQL

Apply configuration changes.

```
sudo systemctl restart postgresql
```

Verify again:

```
sudo ss -tulnp | grep 5432
```

Expected output:

```
LISTEN 0 128 0.0.0.0:5432
```

---

# 10. Configure Oracle Firewall

In Oracle Cloud Console:

Navigate to:

```
Networking
Virtual Cloud Networks
vcn-erp
Subnets
subnet-erp
Security
Security Lists
Default Security List for vcn-erp
```

Click:

```
Add Ingress Rule
```

Enter:

```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 5432
Description: PostgreSQL access
```

Click:

```
Add Ingress Rule
```

---

# 11. Create ERP Database

Switch to PostgreSQL user:

```
sudo -u postgres psql
```

Create database:

```
CREATE DATABASE erp;
```

Create application user:

```
CREATE USER erp_user WITH PASSWORD 'strongpassword';
```

Grant permissions:

```
GRANT ALL PRIVILEGES ON DATABASE erp TO erp_user;
```

Exit PostgreSQL:

```
\q
```

---

# 12. Test Database Connection

From your local machine:

Install PostgreSQL client if needed.

Example test:

```
psql -h YOUR_PUBLIC_IP -U erp_user -d erp
```

Example:

```
psql -h 161.118.161.118 -U erp_user -d erp
```

If successful:

```
erp=>
```

---

# 13. PostgreSQL Connection String

Your backend application will connect using:

```
postgres://erp_user:strongpassword@YOUR_PUBLIC_IP:5432/erp
```

Example:

```
postgres://erp_user:strongpassword@161.118.161.118:5432/erp
```

---

# 14. Security Recommendations

For development environments:

```
Source CIDR: 0.0.0.0/0
```

For production environments:

Restrict access:

```
Source CIDR: BACKEND_SERVER_IP
```

Example:

```
203.192.10.25/32
```

---

# 15. Verify PostgreSQL Service

Check status:

```
sudo systemctl status postgresql
```

Expected:

```
active (running)
```

Enable auto-start:

```
sudo systemctl enable postgresql
```

---

# 16. Final Infrastructure

You now have a **production-ready database server**.

```
Cloud Provider: Oracle Cloud
Instance Type: ARM Ampere
CPU: 1–2 OCPU
RAM: 6 GB
Storage: up to 200 GB
Database: PostgreSQL 16
Public IP enabled
Firewall configured
```

Cost:

```
$0 per month
```

---

# 17. Next Steps for ERP SaaS

Recommended next tasks:

1. Design ERP database schema
2. Create migration scripts
3. Implement Go backend database layer
4. Add connection pooling
5. Configure automated backups

Typical ERP core tables:

```
tenants
users
vendors
products
inventory_transactions
purchase_orders
production_logs
scrap_records
sales_orders
invoices
```

---

# 18. Backup Strategy

Create automated database backups.

Example cron job:

```
pg_dump erp > /backup/erp_$(date +%F).sql
```

Recommended frequency:

```
Daily backups
Weekly full snapshot
```

---

# 19. Monitoring

Monitor PostgreSQL usage.

Commands:

```
sudo systemctl status postgresql
```

```
df -h
```

```
top
```

---

# Conclusion

You now have a **fully operational PostgreSQL server on Oracle Cloud Free Tier**, suitable for:

* ERP SaaS backend
* multi-tenant applications
* production workloads

This infrastructure can easily support:

```
10–50 ERP customers
```

with zero hosting cost.

---
