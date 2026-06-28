-- Migration: Add missing columns and tables for bus cancellation and subscription features
-- Run this if you already created the database with the old schema.sql

-- Add columns to buses table if they don't exist
ALTER TABLE buses ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'temporarily_cancelled'));
ALTER TABLE buses ADD COLUMN IF NOT EXISTS cancelled_from DATE;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS cancelled_until DATE;

-- Fix column width: 'temporarily_cancelled' is 22 chars, needs VARCHAR(30)
ALTER TABLE buses ALTER COLUMN status TYPE VARCHAR(30);

-- Create bus_subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS bus_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id UUID REFERENCES buses(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES users(id),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create admin_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Fix bookings FK: allow route deletion by setting route_id to NULL
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_route_id_fkey;
ALTER TABLE bookings ADD CONSTRAINT bookings_route_id_fkey FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL;

-- Fix seats FK to routes: ensure CASCADE works when booking FK no longer blocks
ALTER TABLE seats DROP CONSTRAINT IF EXISTS seats_route_id_fkey;
ALTER TABLE seats ADD CONSTRAINT seats_route_id_fkey FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

-- Insert default admin settings if not present
INSERT INTO admin_settings (key, value) VALUES ('subscription_price', '4000') ON CONFLICT (key) DO NOTHING;
INSERT INTO admin_settings (key, value) VALUES ('subscription_duration_days', '180') ON CONFLICT (key) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bus_subscriptions_bus_id ON bus_subscriptions(bus_id);
CREATE INDEX IF NOT EXISTS idx_bus_subscriptions_operator_id ON bus_subscriptions(operator_id);
CREATE INDEX IF NOT EXISTS idx_bus_subscriptions_status ON bus_subscriptions(status);
