-- RapidRoute Seed Data

-- 10 Indian Cities
INSERT INTO cities (name, state) VALUES
    ('Mumbai', 'Maharashtra'),
    ('Delhi', 'Delhi'),
    ('Bangalore', 'Karnataka'),
    ('Hyderabad', 'Telangana'),
    ('Chennai', 'Tamil Nadu'),
    ('Pune', 'Maharashtra'),
    ('Ahmedabad', 'Gujarat'),
    ('Kolkata', 'West Bengal'),
    ('Jaipur', 'Rajasthan'),
    ('Kochi', 'Kerala');

-- 5 Buses of mixed types
INSERT INTO buses (name, bus_number, type, total_seats, amenities) VALUES
    ('Rapid Express', 'MH-01-AB-1234', 'Sleeper', 40, ARRAY['AC', 'WiFi', 'USB Charging', 'Blanket']),
    ('City Sprint', 'DL-02-CD-5678', 'Semi-Sleeper', 40, ARRAY['AC', 'WiFi', 'Reading Light']),
    ('Comfort Cruiser', 'KA-03-EF-9012', 'Seater', 40, ARRAY['AC', 'Entertainment', 'Snacks']),
    ('Royal Travels', 'TN-04-GH-3456', 'Sleeper', 40, ARRAY['AC', 'WiFi', 'USB Charging', 'Curtains']),
    ('Swift Connect', 'GJ-05-IJ-7890', 'Semi-Sleeper', 40, ARRAY['AC', 'WiFi', 'Water Bottle']);

-- 8 Routes covering different city pairs for next 30 days
INSERT INTO routes (origin_city_id, destination_city_id, bus_id, departure_time, arrival_time, duration_minutes, fare, travel_date)
SELECT
    origins.id,
    destinations.id,
    buses.id,
    route_data.departure,
    route_data.arrival,
    route_data.duration,
    route_data.fare,
    CURRENT_DATE + (days.n || ' days')::INTERVAL
FROM (VALUES
    (1, 6, '08:00'::TIME, '12:30'::TIME, 270, 850.00, 1),   -- Mumbai -> Pune
    (2, 9, '21:00'::TIME, '06:00'::TIME, 540, 1200.00, 2),  -- Delhi -> Jaipur
    (3, 5, '22:00'::TIME, '06:30'::TIME, 510, 1500.00, 3),  -- Bangalore -> Chennai
    (1, 7, '20:00'::TIME, '08:00'::TIME, 720, 1800.00, 4),  -- Mumbai -> Ahmedabad
    (4, 5, '23:00'::TIME, '07:00'::TIME, 480, 1100.00, 5),  -- Hyderabad -> Chennai
    (2, 8, '19:00'::TIME, '08:00'::TIME, 780, 2200.00, 6),  -- Delhi -> Kolkata
    (3, 10, '21:30'::TIME, '08:00'::TIME, 630, 1600.00, 7), -- Bangalore -> Kochi
    (6, 1, '07:30'::TIME, '12:00'::TIME, 270, 850.00, 8)    -- Pune -> Mumbai
) AS route_data(origin_id, dest_id, departure, arrival, duration, fare, bus_id_offset)
CROSS JOIN cities origins
CROSS JOIN cities destinations
CROSS JOIN buses
CROSS JOIN generate_series(0, 29) AS days(n)
WHERE origins.id = route_data.origin_id
  AND destinations.id = route_data.dest_id
  AND buses.id = (SELECT id FROM buses ORDER BY id LIMIT 1 OFFSET (route_data.bus_id_offset - 1));

-- Generate 40 seats per route (columns A/B/C/D x 10 rows, lower/upper deck for sleeper)
-- For each route, create seats (status defaults to 'available')
INSERT INTO seats (route_id, seat_number, deck, type)
SELECT
    r.id,
    seat_data.seat_number,
    CASE
        WHEN b.type = 'Sleeper' AND seat_data.row_num <= 5 THEN 'lower'
        WHEN b.type = 'Sleeper' AND seat_data.row_num > 5 THEN 'upper'
        ELSE 'lower'
    END,
    CASE
        WHEN seat_data.col_letter IN ('A', 'D') THEN 'window'
        ELSE 'aisle'
    END
FROM routes r
JOIN buses b ON r.bus_id = b.id
CROSS JOIN (
    SELECT
        row_num,
        col_letter,
        CASE
            WHEN col_letter = 'A' THEN row_num::TEXT || 'A'
            WHEN col_letter = 'B' THEN row_num::TEXT || 'B'
            WHEN col_letter = 'C' THEN row_num::TEXT || 'C'
            WHEN col_letter = 'D' THEN row_num::TEXT || 'D'
        END AS seat_number
    FROM generate_series(1, 10) AS row_num,
         (SELECT unnest(ARRAY['A', 'B', 'C', 'D']) AS col_letter) cols
) seat_data
WHERE r.travel_date = CURRENT_DATE;  -- Only seed for today's routes initially

-- Create a demo operator user (password: operator123)
INSERT INTO users (name, email, password_hash, phone, role)
VALUES ('Bus Operator', 'operator@rapidroute.com', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkf7n2n0qXJ5p3YZKjK0l5X0g5KqS', '+91-9876543210', 'operator');

-- Create a demo customer user (password: customer123)
INSERT INTO users (name, email, password_hash, phone, role)
VALUES ('Demo User', 'demo@rapidroute.com', '$2b$10$dummy_hash_for_demo_purposes_abcdefghij1234567890', '+91-9876543211', 'customer');

-- Assign all seeded buses to the operator user
UPDATE buses SET operator_id = (SELECT id FROM users WHERE email = 'operator@rapidroute.com');
