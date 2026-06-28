-- RapidRoute Database Schema
-- Concurrency & Synchronization Demo Application

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'operator', 'admin')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cities table
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL
);

-- Buses table
CREATE TABLE IF NOT EXISTS buses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    bus_number VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('Sleeper', 'Semi-Sleeper', 'Seater')),
    total_seats INTEGER NOT NULL,
    amenities TEXT[] DEFAULT '{}',
    operator_id UUID REFERENCES users(id),
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'temporarily_cancelled')),
    cancelled_from DATE,
    cancelled_until DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bus subscriptions table
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

-- Admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_city_id INTEGER REFERENCES cities(id),
    destination_city_id INTEGER REFERENCES cities(id),
    bus_id UUID REFERENCES buses(id),
    departure_time TIME NOT NULL,
    arrival_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    fare DECIMAL(10, 2) NOT NULL,
    travel_date DATE NOT NULL
);

-- Seats table with version column for optimistic locking
CREATE TABLE IF NOT EXISTS seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    seat_number VARCHAR(10) NOT NULL,
    deck VARCHAR(10) CHECK (deck IN ('lower', 'upper')),
    type VARCHAR(10) CHECK (type IN ('window', 'aisle')),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'held', 'booked')),
    version INTEGER DEFAULT 0,
    held_by UUID REFERENCES users(id),
    held_until TIMESTAMP,
    UNIQUE(route_id, seat_number)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    seat_ids UUID[] NOT NULL,
    passenger_names TEXT[] NOT NULL,
    total_fare DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id),
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    idempotency_key VARCHAR(255) UNIQUE,
    processed_at TIMESTAMP
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    response_body JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- Rate limit log table
CREATE TABLE IF NOT EXISTS rate_limit_log (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    ip_address VARCHAR(45),
    endpoint VARCHAR(255),
    request_time TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_routes_origin_destination ON routes(origin_city_id, destination_city_id);
CREATE INDEX IF NOT EXISTS idx_routes_travel_date ON routes(travel_date);
CREATE INDEX IF NOT EXISTS idx_seats_route_id ON seats(route_id);
CREATE INDEX IF NOT EXISTS idx_seats_status ON seats(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_idempotency ON bookings(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_bus_subscriptions_bus_id ON bus_subscriptions(bus_id);
CREATE INDEX IF NOT EXISTS idx_bus_subscriptions_operator_id ON bus_subscriptions(operator_id);
CREATE INDEX IF NOT EXISTS idx_bus_subscriptions_status ON bus_subscriptions(status);
