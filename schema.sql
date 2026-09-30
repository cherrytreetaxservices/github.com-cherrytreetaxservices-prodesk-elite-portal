-- ProDesk Elite Tax System — application foundation draft
create table firms (id uuid primary key, name text not null, created_at timestamptz default now());
create table profiles (id uuid primary key, firm_id uuid references firms(id), full_name text, role text check (role in ('taxpayer','preparer','reviewer','administrator','transmitter','ero')), active boolean default true);
create table taxpayers (id uuid primary key, firm_id uuid references firms(id), display_name text not null, created_at timestamptz default now());
create table tax_cases (id uuid primary key, taxpayer_id uuid references taxpayers(id), tax_year int not null, status text not null, current_stage text not null, assigned_preparer uuid references profiles(id), assigned_reviewer uuid references profiles(id), created_at timestamptz default now());
create table case_forms (id uuid primary key, case_id uuid references tax_cases(id), form_code text not null, form_name text not null, audience text, status text, submitted_at timestamptz);
create table documents (id uuid primary key, case_id uuid references tax_cases(id), category text, file_path text not null, uploaded_by uuid references profiles(id), created_at timestamptz default now());
create table workflow_events (id bigserial primary key, case_id uuid references tax_cases(id), actor_id uuid references profiles(id), event_type text not null, from_status text, to_status text, note text, created_at timestamptz default now());
create table holds (id uuid primary key, case_id uuid references tax_cases(id), hold_type text not null, reason text, is_clear boolean default false, cleared_at timestamptz);
create table engagements (id uuid primary key, case_id uuid references tax_cases(id), scope_status text, authorization_status text, authorized_at timestamptz);
create table payment_controls (id uuid primary key, case_id uuid references tax_cases(id), payment_route text, start_clear boolean default false, final_release_clear boolean default false);
create table quality_reviews (id uuid primary key, case_id uuid references tax_cases(id), reviewer_id uuid references profiles(id), status text, reviewed_at timestamptz, notes text);
create table transmissions (id uuid primary key, case_id uuid references tax_cases(id), status text, transmitted_at timestamptz, accepted_at timestamptz, rejection_note text);
create table deliveries (id uuid primary key, case_id uuid references tax_cases(id), delivered_at timestamptz, method text, ct010_complete boolean default false);
create table commissions (id uuid primary key, case_id uuid references tax_cases(id), preparer_id uuid references profiles(id), eligible_revenue numeric(12,2), commission_amount numeric(12,2), status text);
