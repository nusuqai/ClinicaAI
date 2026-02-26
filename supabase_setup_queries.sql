-- ============================================
-- CLINIC SYSTEM - SUPABASE SCHEMA (Fixed for Auth)
-- ============================================

-- Enable UUID generation and btree_gist used for exclusion constraints
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ============================================
-- 1. USERS (Patients) - Linked to Supabase Auth
-- ============================================
-- We drop the table if it exists to recreate it with the correct auth reference.
-- Warning: This drops data in tables depending on it (appointments, medical_history, etc).
drop table if exists appointments cascade;
drop table if exists medical_history cascade;
drop table if exists doctor_suggestions cascade;
drop table if exists "users" cascade;

create table "users" (
  -- Link directly to Supabase's built-in auth system user ID
  id uuid references auth.users not null primary key,
  full_name text not null,
  email text unique not null,
  phone text,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  created_at timestamptz default now()
);

-- Note on Passwords:
-- We DO NOT store passwords in the public schema. 
-- Supabase automatically securely hashes and salts passwords (using bcrypt/argon2id) 
-- inside the hidden `auth.users` table. This provides industry-standard encryption out of the box!

-- ============================================
-- TRIGGER: Auto-create user profile on signup
-- ============================================
-- This function automatically takes the metadata we send from React during signUp 
-- and creates the row in our public "users" table.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, phone, date_of_birth, gender)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    (new.raw_user_meta_data->>'date_of_birth')::date,
    new.raw_user_meta_data->>'gender'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Attach the trigger to Supabase Auth
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================
-- 2. DOCTORS (Keep your existing schema)
-- ============================================
create table if not exists doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  specialty text not null,
  bio text,
  availability_note text,
  rating numeric(2,1) check (rating >= 0 and rating <= 5),
  photo_url text,
  created_at timestamptz default now()
);

-- ============================================
-- 3. TIME SLOTS
-- ============================================
create table if not exists time_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_booked boolean default false,
  constraint time_slots_starts_before_ends check (starts_at < ends_at)
);

alter table time_slots drop constraint if exists time_slots_no_overlap;
alter table time_slots
  add constraint time_slots_no_overlap
  exclude using gist (
    doctor_id with =,
    tstzrange(starts_at, ends_at) with &&
  );

-- ============================================
-- 4. APPOINTMENTS
-- ============================================
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references "users"(id) on delete cascade,
  doctor_id uuid not null references doctors(id) on delete cascade,
  time_slot_id uuid references time_slots(id) on delete set null,
  scheduled_at timestamptz not null,
  status text default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  reason text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================
-- 5. MEDICAL HISTORY
-- ============================================
create table if not exists medical_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references "users"(id) on delete cascade,
  condition text not null,
  diagnosed_at date,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================
-- 6. DOCTOR SUGGESTIONS (AI-Generated)
-- ============================================
create table if not exists doctor_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references "users"(id) on delete cascade,
  doctor_id uuid not null references doctors(id) on delete cascade,
  reason text not null,
  created_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_appointments_user_id on appointments(user_id);
create index if not exists idx_appointments_doctor_id on appointments(doctor_id);
create index if not exists idx_appointments_status on appointments(status);
create index if not exists idx_time_slots_doctor_id on time_slots(doctor_id);
create index if not exists idx_time_slots_is_booked on time_slots(is_booked);
create index if not exists idx_medical_history_user_id on medical_history(user_id);
create index if not exists idx_doctor_suggestions_user_id on doctor_suggestions(user_id);

-- ============================================
-- VIEWS
-- ============================================
create or replace view v_appointments as
select
  a.id,
  a.scheduled_at,
  a.status,
  a.reason,
  a.notes,
  u.full_name as patient_name,
  u.email as patient_email,
  d.full_name as doctor_name,
  d.specialty as doctor_specialty
from appointments a
join "users" u on u.id = a.user_id
join doctors d on d.id = a.doctor_id;

create or replace view v_suggestions as
select
  ds.id,
  ds.reason,
  ds.created_at,
  u.full_name as patient_name,
  u.email as patient_email,
  d.full_name as doctor_name,
  d.specialty,
  d.rating,
  d.bio
from doctor_suggestions ds
join "users" u on u.id = ds.user_id
join doctors d on d.id = ds.doctor_id;

create or replace view v_available_slots as
select
  ts.id as slot_id,
  ts.starts_at,
  ts.ends_at,
  d.full_name as doctor_name,
  d.specialty
from time_slots ts
join doctors d on d.id = ts.doctor_id
where ts.is_booked = false
  and ts.starts_at > now()
order by ts.starts_at;
