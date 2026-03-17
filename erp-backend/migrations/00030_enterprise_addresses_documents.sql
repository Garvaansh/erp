-- +goose Up
-- Addresses, contacts, bank details, document management

CREATE TABLE IF NOT EXISTS address_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_address_types_tenant ON address_types(tenant_id);

CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    street VARCHAR(255),
    street2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    state_code VARCHAR(10),
    pincode VARCHAR(20),
    country VARCHAR(3) NOT NULL DEFAULT 'IN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_addresses_tenant ON addresses(tenant_id);

CREATE TABLE IF NOT EXISTS party_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
    address_type_id UUID NOT NULL REFERENCES address_types(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_party_addresses_vendor_type ON party_addresses(tenant_id, address_type_id, vendor_id) WHERE vendor_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_party_addresses_customer_type ON party_addresses(tenant_id, address_type_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_party_addresses_tenant ON party_addresses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_party_addresses_vendor ON party_addresses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_party_addresses_customer ON party_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_party_addresses_address ON party_addresses(address_id);

CREATE TABLE IF NOT EXISTS contact_persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    job_title VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_contact_persons_tenant ON contact_persons(tenant_id);

CREATE TABLE IF NOT EXISTS party_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_person_id UUID NOT NULL REFERENCES contact_persons(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_party_contacts_vendor_contact ON party_contacts(tenant_id, contact_person_id, vendor_id) WHERE vendor_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_party_contacts_customer_contact ON party_contacts(tenant_id, contact_person_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_party_contacts_tenant ON party_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_party_contacts_vendor ON party_contacts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_party_contacts_customer ON party_contacts(customer_id);

CREATE TABLE IF NOT EXISTS bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bank_master_id UUID REFERENCES bank_masters(id) ON DELETE SET NULL,
    account_holder VARCHAR(255) NOT NULL,
    account_number VARCHAR(60),
    iban VARCHAR(40),
    swift_code VARCHAR(20),
    branch_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, account_number, bank_master_id)
);
CREATE INDEX IF NOT EXISTS idx_bank_details_tenant ON bank_details(tenant_id);

CREATE TABLE IF NOT EXISTS party_bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bank_detail_id UUID NOT NULL REFERENCES bank_details(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_party_bank_details_vendor_type ON party_bank_details(tenant_id, bank_detail_id, vendor_id) WHERE vendor_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_party_bank_details_customer_type ON party_bank_details(tenant_id, bank_detail_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_party_bank_details_tenant ON party_bank_details(tenant_id);
CREATE INDEX IF NOT EXISTS idx_party_bank_details_vendor_id ON party_bank_details(vendor_id);
CREATE INDEX IF NOT EXISTS idx_party_bank_details_customer_id ON party_bank_details(customer_id);

CREATE TABLE IF NOT EXISTS document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_document_types_tenant ON document_types(tenant_id);

CREATE TABLE IF NOT EXISTS document_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_type_id UUID NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
    document_number VARCHAR(50),
    description VARCHAR(500),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_document_headers_tenant ON document_headers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_headers_type ON document_headers(document_type_id);

CREATE TABLE IF NOT EXISTS document_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_header_id UUID NOT NULL REFERENCES document_headers(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, document_header_id, file_name)
);
CREATE INDEX IF NOT EXISTS idx_document_attachments_document ON document_attachments(document_header_id);

CREATE TABLE IF NOT EXISTS document_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_header_id UUID NOT NULL REFERENCES document_headers(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,  -- VENDOR, CUSTOMER, PRODUCT, PURCHASE_ORDER, etc.
    entity_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, document_header_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_document_links_document ON document_links(document_header_id);
CREATE INDEX IF NOT EXISTS idx_document_links_entity ON document_links(entity_type, entity_id);

-- +goose Down
DROP TABLE IF EXISTS document_links;
DROP TABLE IF EXISTS document_attachments;
DROP TABLE IF EXISTS document_headers;
DROP TABLE IF EXISTS document_types;
DROP TABLE IF EXISTS party_bank_details;
DROP TABLE IF EXISTS bank_details;
DROP TABLE IF EXISTS party_contacts;
DROP TABLE IF EXISTS contact_persons;
DROP TABLE IF EXISTS party_addresses;
DROP TABLE IF EXISTS addresses;
DROP TABLE IF EXISTS address_types;
