-- Users
create table if not exists users (
  id bigint generated always as identity primary key,
  name text not null,
  email text unique not null,
  hashed_password text not null,
  created_at timestamptz default now()
);

-- Community reports (civic issues)
create table if not exists reports (
  id bigint generated always as identity primary key,
  lat double precision,
  lng double precision,
  issue_type text,
  severity text,
  description text,
  status text default 'reported',
  votes int default 0,
  address text,
  anonymous boolean default true,
  reporter_contact text,
  created_at timestamptz default now()
);

-- Reviews
create table if not exists reviews (
  id bigint generated always as identity primary key,
  user_id bigint,
  user_name text,
  rating int not null,
  comment text not null,
  created_at timestamptz default now()
);

-- Parking reservations (SIH1515 — realtime street parking)
-- Zone/spot data itself is generated in-memory by the parking engine;
-- this table is the audit/history log of actual bookings.
create table if not exists parking_reservations (
  id bigint generated always as identity primary key,
  spot_id text not null,
  zone_id text not null,
  user_id bigint,
  vehicle_number text not null,
  vehicle_type text default 'car',
  duration_minutes int not null,
  price_per_hour double precision,
  estimated_total double precision,
  status text default 'confirmed',
  reserved_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- SOS alerts
create table if not exists sos_alerts (
  id bigint generated always as identity primary key,
  user_id bigint,
  lat double precision,
  lng double precision,
  accuracy double precision,
  contact_count int default 0,
  note text,
  status text default 'active',
  created_at timestamptz default now()
);
