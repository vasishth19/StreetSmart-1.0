-- Users
create table if not exists users (
  id bigint generated always as identity primary key,
  name text not null,
  email text unique not null,
  hashed_password text not null,
  reset_token text,
  reset_token_expires timestamptz,
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
