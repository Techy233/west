-- Base schema for the Lyft Clone MVP

-- Users table: Stores information about both Riders and Drivers
CREATE TYPE USER_ROLE AS ENUM ('rider', 'driver');

CREATE TABLE Users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Store hashed passwords
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role USER_ROLE NOT NULL,
    profile_picture_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drivers table: Extends Users table with driver-specific information
CREATE TABLE Drivers (
    driver_id UUID PRIMARY KEY REFERENCES Users(user_id) ON DELETE CASCADE,
    license_number VARCHAR(100) UNIQUE, -- Placeholder for actual verification process
    vehicle_plate_number VARCHAR(20) UNIQUE,
    vehicle_model VARCHAR(100),
    vehicle_color VARCHAR(50),
    vehicle_year INT,
    is_verified BOOLEAN DEFAULT FALSE, -- Admin verifies driver
    is_available BOOLEAN DEFAULT FALSE, -- Driver toggles availability
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    last_location_update TIMESTAMPTZ,
    -- Potentially add vehicle documents, insurance info later
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rides table: Stores information about each ride
CREATE TYPE RIDE_STATUS AS ENUM (
    'requested',      -- Rider has requested a ride
    'accepted',       -- Driver has accepted the ride
    'driver_arrived', -- Driver has arrived at pickup
    'ongoing',        -- Ride is in progress
    'completed',      -- Ride is completed
    'cancelled_rider',-- Ride cancelled by rider
    'cancelled_driver',-- Ride cancelled by driver
    'no_drivers_available' -- System cancelled due to no drivers
);

CREATE TABLE Rides (
    ride_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES Users(user_id),
    driver_id UUID REFERENCES Users(user_id), -- Can be NULL if not yet accepted
    pickup_address_text TEXT,
    dropoff_address_text TEXT,
    pickup_latitude DOUBLE PRECISION NOT NULL,
    pickup_longitude DOUBLE PRECISION NOT NULL,
    dropoff_latitude DOUBLE PRECISION NOT NULL,
    dropoff_longitude DOUBLE PRECISION NOT NULL,
    status RIDE_STATUS NOT NULL DEFAULT 'requested',
    estimated_fare DECIMAL(10, 2), -- Store monetary values precisely
    actual_fare DECIMAL(10, 2),
    distance_km DECIMAL(10, 2), -- Estimated or actual distance
    duration_minutes INT, -- Estimated or actual duration
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    driver_arrived_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table: Stores information about payments for rides
CREATE TYPE PAYMENT_STATUS AS ENUM ('pending', 'successful', 'failed', 'refunded');
CREATE TYPE PAYMENT_METHOD AS ENUM ('MTN_MOMO', 'TELECEL_CASH', 'AIRTELTIGO_MONEY', 'CARD', 'WALLET'); -- Card/Wallet for future

CREATE TABLE Payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES Rides(ride_id),
    payer_id UUID NOT NULL REFERENCES Users(user_id), -- Typically the rider
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GHS',
    status PAYMENT_STATUS NOT NULL DEFAULT 'pending',
    payment_method PAYMENT_METHOD NOT NULL DEFAULT 'MTN_MOMO', -- Default to MTN for MVP
    transaction_id_gateway TEXT, -- ID from the payment gateway
    gateway_response JSONB, -- Store raw response from gateway for debugging
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ChatMessages table: Stores chat messages between rider and driver for a specific ride
CREATE TABLE ChatMessages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES Rides(ride_id),
    sender_id UUID NOT NULL REFERENCES Users(user_id),
    receiver_id UUID NOT NULL REFERENCES Users(user_id),
    message_text TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ratings table: Stores ratings given by users (riders to drivers, drivers to riders)
CREATE TABLE Ratings (
    rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES Rides(ride_id),
    rater_id UUID NOT NULL REFERENCES Users(user_id),
    rated_id UUID NOT NULL REFERENCES Users(user_id),
    score INT NOT NULL CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_phone_number ON Users(phone_number);
CREATE INDEX idx_drivers_availability ON Drivers(is_available, is_verified); -- For finding available drivers
CREATE INDEX idx_rides_rider_id ON Rides(rider_id);
CREATE INDEX idx_rides_driver_id ON Rides(driver_id);
CREATE INDEX idx_rides_status ON Rides(status);
CREATE INDEX idx_payments_ride_id ON Payments(ride_id);
CREATE INDEX idx_chatmessages_ride_id ON ChatMessages(ride_id);
CREATE INDEX idx_ratings_ride_id ON Ratings(ride_id);
CREATE INDEX idx_ratings_rated_id ON Ratings(rated_id); -- For calculating average rating for a user

-- Trigger function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON Users FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_drivers BEFORE UPDATE ON Drivers FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_rides BEFORE UPDATE ON Rides FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_payments BEFORE UPDATE ON Payments FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Note: For PostGIS location-based queries (e.g., finding nearby drivers),
-- you would typically add geometry columns and spatial indexes.
-- Example:
-- SELECT AddGeometryColumn ('public','drivers','location',4326,'POINT',2);
-- CREATE INDEX idx_drivers_location ON drivers USING GIST (location);
-- This setup is more advanced and can be added when implementing location services.
-- For MVP, current_latitude and current_longitude can be used with Haversine or similar math.

-- UserDeviceTokens table: Stores FCM/APNS device tokens for users for push notifications
CREATE TYPE DEVICE_TYPE AS ENUM ('android', 'ios', 'web');

CREATE TABLE UserDeviceTokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    device_type DEVICE_TYPE, -- Type of device (android, ios, web)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_token) -- A user can have multiple tokens, but each token for a user is unique
);

CREATE INDEX idx_userdevicetokens_user_id ON UserDeviceTokens(user_id);
CREATE INDEX idx_userdevicetokens_device_token ON UserDeviceTokens(device_token); -- For quick lookup if a token needs to be invalidated


-- End of schema
