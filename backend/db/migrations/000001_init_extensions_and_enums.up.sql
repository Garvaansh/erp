-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create Enums
CREATE TYPE item_category AS ENUM ('RAW', 'SEMI_FINISHED', 'FINISHED', 'SCRAP');
CREATE TYPE base_unit_type AS ENUM ('WEIGHT', 'COUNT', 'LENGTH');
CREATE TYPE location_type AS ENUM ('RAW_STORE', 'WIP', 'FINISHED_STORE', 'SCRAP_YARD');